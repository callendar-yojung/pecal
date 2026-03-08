import { fetch } from '@tauri-apps/plugin-http'
import { ApiError, createRequestCoordinator, isRetryableStatus, mapStatusToApiCode, toApiError } from '@repo/api-client'
import { resolveApiBaseUrl } from '../lib/apiBaseUrl'

const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL, 'https://pecal.site')
const IS_DEV = import.meta.env.DEV

function getDesktopClientName() {
  if (typeof navigator === 'undefined') return 'Desktop'
  const agent = navigator.userAgent.toLowerCase()
  if (agent.includes('mac os x') || agent.includes('macintosh')) return 'Mac'
  if (agent.includes('windows')) return 'Windows PC'
  if (agent.includes('linux')) return 'Linux PC'
  return 'Desktop'
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

function sanitizeHeaders(headers: Record<string, string>) {
  const sanitized = { ...headers }
  if (sanitized.Authorization) {
    sanitized.Authorization = 'Bearer [REDACTED]'
  }
  return sanitized
}

function logDebug(message: string, payload?: unknown) {
  if (!IS_DEV) return
  if (payload === undefined) {
    console.log(message)
    return
  }
  console.log(message, payload)
}

class ApiClient {
  private baseUrl: string
  private accessToken: string | null = null
  private refreshHandler: (() => Promise<{ accessToken: string; refreshToken?: string }>) | null = null
  private coordinator = createRequestCoordinator()

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  setAccessToken(token: string | null) {
    this.accessToken = token
  }

  getAccessToken() {
    return this.accessToken
  }

  setRefreshHandler(handler: () => Promise<{ accessToken: string; refreshToken?: string }>) {
    this.refreshHandler = handler
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
    const { method = 'GET', body, headers = {} } = options

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Client-Platform': 'desktop',
      'X-Client-Name': getDesktopClientName(),
      'X-App-Version': import.meta.env.VITE_APP_VERSION || 'unknown',
      ...headers,
    }

    if (this.accessToken) {
      requestHeaders['Authorization'] = `Bearer ${this.accessToken}`
    }

    const url = `${this.baseUrl}${endpoint}`

    logDebug('🚀 API Request:', {
      method,
      url,
      headers: sanitizeHeaders(requestHeaders),
      hasBody: body !== undefined,
    })

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      })

      logDebug('📥 API Response Status:', {
        url,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      })

      // 응답 본문 읽기 (에러가 있든 없든)
      const responseText = await response.text()

      if (!response.ok) {
        if (
          response.status === 401 &&
          this.refreshHandler &&
          !isRetry &&
          !endpoint.includes('/api/auth/external/refresh')
        ) {
          try {
            const refreshed = await this.refreshHandler()
            if (refreshed?.accessToken) {
              this.setAccessToken(refreshed.accessToken)
              return this.request<T>(endpoint, options, true)
            }
          } catch (refreshError) {
            console.error('❌ Token refresh failed:', refreshError)
          }
        }

        let errorMessage = `API Error: ${response.status} ${response.statusText}`

        try {
          const errorData = JSON.parse(responseText)
          logDebug('❌ API Error Data:', errorData)
          errorMessage = errorData.error || errorData.message || errorMessage
        } catch {
          logDebug('❌ Failed to parse error response')
        }

        throw new ApiError({
          message: errorMessage,
          status: response.status,
          code: mapStatusToApiCode(response.status),
          retryable: isRetryableStatus(response.status),
          source: 'desktop',
          details: responseText,
        })
      }

      // 성공 응답 파싱
      try {
        const data = JSON.parse(responseText)
        logDebug('✅ API Success Data')
        return data
      } catch {
        logDebug('❌ Failed to parse success response')
        throw new ApiError({
          message: 'Invalid JSON response',
          status: response.status,
          code: 'REQUEST_FAILED',
          retryable: false,
          source: 'desktop',
          details: responseText,
        })
      }
    } catch (error) {
      const normalizedError = toApiError(error, 'desktop')

      console.error('❌ API Request Failed:', {
        url,
        error: normalizedError.message,
        stack: normalizedError.stack,
      })
      throw normalizedError
    }
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  getCached<T>(
    cacheKey: string,
    endpoint: string,
    opts?: { cacheMs?: number; dedupe?: boolean; retries?: number },
  ): Promise<T> {
    return this.coordinator.run(
      cacheKey,
      () => this.get<T>(endpoint),
      {
        cacheMs: opts?.cacheMs ?? 0,
        dedupe: opts?.dedupe ?? true,
        retries: opts?.retries ?? 1,
      },
    )
  }

  post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body })
  }

  patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PATCH', body })
  }

  put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body })
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  invalidateCache(prefix?: string) {
    this.coordinator.invalidate(prefix)
  }

  async upload<T>(endpoint: string, file: File, fields: Record<string, string>, isRetry = false): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    // Content-Type은 설정하지 않음 — Tauri fetch가 FormData boundary를 자동 생성
    const headers: Record<string, string> = {}

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    logDebug('🚀 API Upload:', {
      url,
      fileName: file.name,
      fileSize: file.size,
      fields,
      hasAuthHeader: Boolean(headers.Authorization),
    })

    // File을 메모리로 읽어 Blob으로 변환 (Tauri IPC 호환)
    const arrayBuffer = await file.arrayBuffer()
    const blob = new Blob([arrayBuffer], { type: file.type || 'application/octet-stream' })

    const formData = new FormData()
    formData.append('file', blob, file.name)
    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value)
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      })

      logDebug('📥 API Upload Response Status:', {
        url,
        status: response.status,
        ok: response.ok,
      })

      const responseText = await response.text()

      if (!response.ok) {
        if (
          response.status === 401 &&
          this.refreshHandler &&
          !isRetry &&
          !endpoint.includes('/api/auth/external/refresh')
        ) {
          try {
            const refreshed = await this.refreshHandler()
            if (refreshed?.accessToken) {
              this.setAccessToken(refreshed.accessToken)
              return this.upload<T>(endpoint, file, fields, true)
            }
          } catch (refreshError) {
            console.error('❌ Token refresh failed:', refreshError)
          }
        }

        let errorMessage = `API Error: ${response.status} ${response.statusText}`
        try {
          const errorData = JSON.parse(responseText)
          errorMessage = errorData.error || errorData.message || errorMessage
        } catch {
          // ignore parse error
        }
        throw new ApiError({
          message: errorMessage,
          status: response.status,
          code: mapStatusToApiCode(response.status),
          retryable: isRetryableStatus(response.status),
          source: 'desktop',
          details: responseText,
        })
      }

      const data = JSON.parse(responseText)
      logDebug('✅ API Upload Success')
      return data
    } catch (error) {
      const normalizedError = toApiError(error, 'desktop')

      console.error('❌ API Upload Failed:', {
        url,
        error: normalizedError.message,
      })
      throw normalizedError
    }
  }
}

export const apiClient = new ApiClient(API_BASE_URL)
