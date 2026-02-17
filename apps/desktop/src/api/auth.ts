import { apiClient } from './client'
import type { AuthResponse, RefreshTokenResponse, MeResponse } from '../types'

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

  updateAccount: (data: { nickname?: string; profile_image_url?: string | null }) =>
    apiClient.patch<{ success: boolean }>('/api/me/account', data),

  checkNickname: (nickname: string) =>
    apiClient.get<{ available: boolean }>(
      `/api/me/account/nickname-check?nickname=${encodeURIComponent(nickname)}`
    ),
}
