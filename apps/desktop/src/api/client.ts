import { fetch } from '@tauri-apps/plugin-http'
import { ApiError, isRetryableStatus, mapStatusToApiCode, toApiError } from '@repo/api-client'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://pecal.site'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

class ApiClient {
  private baseUrl: string
  private accessToken: string | null = null
  private refreshHandler: (() => Promise<{ accessToken: string; refreshToken?: string }>) | null = null

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
      ...headers,
    }

    if (this.accessToken) {
      requestHeaders['Authorization'] = `Bearer ${this.accessToken}`
    }

    const url = `${this.baseUrl}${endpoint}`

    console.log('🚀 API Request:', {
      method,
      url,
      headers: requestHeaders,
      body: body ? JSON.stringify(body, null, 2) : undefined,
    })

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      })

      console.log('📥 API Response Status:', {
        url,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      })

      // 응답 본문 읽기 (에러가 있든 없든)
      const responseText = await response.text()
      console.log('📄 API Response Body:', responseText)

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
          console.error('❌ API Error Data:', errorData)
          errorMessage = errorData.error || errorData.message || errorMessage
        } catch (parseError) {
          console.error('❌ Failed to parse error response:', responseText)
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
        console.log('✅ API Success Data:', data)
        return data
      } catch (parseError) {
        console.error('❌ Failed to parse success response:', responseText)
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

  async upload<T>(endpoint: string, file: File, fields: Record<string, string>, isRetry = false): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    // Content-Type은 설정하지 않음 — Tauri fetch가 FormData boundary를 자동 생성
    const headers: Record<string, string> = {}

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    console.log('🚀 API Upload:', { url, fileName: file.name, fileSize: file.size, fields })

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

      console.log('📥 API Upload Response Status:', {
        url,
        status: response.status,
        ok: response.ok,
      })

      const responseText = await response.text()
      console.log('📄 API Upload Response Body:', responseText)

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
      console.log('✅ API Upload Success:', data)
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
