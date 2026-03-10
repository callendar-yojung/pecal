import { apiClient } from './client'
import type { AuthResponse, RefreshTokenResponse, MeResponse } from '../types'

type AccountResponse = {
  member_id: number
  provider: string
  email: string | null
  phone_number: string | null
  nickname: string | null
  profile_image_url: string | null
  privacy_consent?: boolean
  marketing_consent?: boolean
}

export type LoginSessionItem = {
  session_id: string
  provider: string
  client_platform: string
  client_name: string
  app_version?: string | null
  user_agent?: string | null
  created_at: string
  last_seen_at: string
  current: boolean
}

export const authApi = {
  loginWithPassword: (loginId: string, password: string) =>
    apiClient.post<AuthResponse>('/api/auth/external/local/login', {
      login_id: loginId,
      password,
    }),

  registerWithPassword: (
    loginId: string,
    password: string,
    nickname: string,
    email: string,
  ) =>
    apiClient.post<AuthResponse>('/api/auth/external/local/register', {
      login_id: loginId,
      password,
      nickname,
      email,
    }),

  sendRegisterVerificationCode: (email: string) =>
    apiClient.post<{ success: boolean }>('/api/auth/local/email/send-code', {
      email,
    }),

  verifyRegisterVerificationCode: (email: string, code: string) =>
    apiClient.post<{ success: boolean }>('/api/auth/local/email/verify-code', {
      email,
      code,
    }),

  checkLocalAvailability: (params: { loginId?: string; nickname?: string }) => {
    const query = new URLSearchParams()
    if (params.loginId) query.set('login_id', params.loginId)
    if (params.nickname) query.set('nickname', params.nickname)
    return apiClient.get<{
      loginId?: { available: boolean; message: string }
      nickname?: { available: boolean; message: string }
    }>(`/api/auth/local/availability?${query.toString()}`)
  },

  loginWithKakao: (accessToken: string) => {
    console.log('🔑 Kakao Login API Call:', {
      accessToken: accessToken.substring(0, 20) + '...',
      endpoint: '/api/auth/external/kakao',
    })

    return apiClient.post<AuthResponse>('/api/auth/external/kakao', {
      access_token: accessToken,
    })
  },

  refreshToken: (refreshToken: string) =>
    apiClient.post<RefreshTokenResponse>('/api/auth/external/refresh', {
      refresh_token: refreshToken,
    }),
  logout: (refreshToken: string | null) =>
    apiClient.post<{ success: boolean }>('/api/auth/external/logout', {
      refresh_token: refreshToken,
    }),

  getMe: () => apiClient.get<MeResponse>('/api/auth/external/me'),
  getAccount: () => apiClient.get<AccountResponse>('/api/me/account'),
  getSessions: () => apiClient.get<{ sessions?: LoginSessionItem[] }>('/api/me/sessions'),
  revokeSession: (sessionId: string) =>
    apiClient.delete<{ success: boolean }>(`/api/me/sessions/${sessionId}`),

  updateAccount: (data: {
    nickname?: string
    profile_image_url?: string | null
    privacy_consent?: boolean
    marketing_consent?: boolean
  }) =>
    apiClient.patch<{ success: boolean }>('/api/me/account', data),

  checkNickname: (nickname: string) =>
    apiClient.get<{ available: boolean }>(
      `/api/me/account/nickname-check?nickname=${encodeURIComponent(nickname)}`
    ),
}
