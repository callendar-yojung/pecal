import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Member } from '../types'
import { apiClient, authApi } from '../api'

interface AuthState {
  user: Member | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean

  setAuth: (user: Member, accessToken: string, refreshToken: string) => void
  updateUser: (partial: Partial<Member>) => void
  logout: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      const refreshSession = async () => {
        const refreshToken = get().refreshToken
        if (!refreshToken) {
          throw new Error('No refresh token available')
        }

        const response = await authApi.refreshToken(refreshToken)
        const nextAccessToken = response.accessToken
        const nextRefreshToken = response.refreshToken || refreshToken

        apiClient.setAccessToken(nextAccessToken)
        set({
          accessToken: nextAccessToken,
          refreshToken: nextRefreshToken,
          isAuthenticated: true,
        })

        return { accessToken: nextAccessToken, refreshToken: nextRefreshToken }
      }

      apiClient.setRefreshHandler(refreshSession)

      return {
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,

      setAuth: (user, accessToken, refreshToken) => {
        apiClient.setAccessToken(accessToken)
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        })
      },

      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),

      logout: () => {
        apiClient.setAccessToken(null)
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        })
      },

      setLoading: (isLoading) => set({ isLoading }),
    }
  },
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          apiClient.setAccessToken(state.accessToken)
        }
        if (state) {
          state.setLoading(false)
        }
      },
    }
  )
)
