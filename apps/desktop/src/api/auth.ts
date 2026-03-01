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

export const authApi = {
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

  getMe: () => apiClient.get<MeResponse>('/api/auth/external/me'),
  getAccount: () => apiClient.get<AccountResponse>('/api/me/account'),

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
