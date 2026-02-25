import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { fetch } from '@tauri-apps/plugin-http'
import { open } from '@tauri-apps/plugin-shell'
import { useAuthStore, useThemeStore } from '../../stores'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const DEFAULT_DEEPLINK_SCHEME = import.meta.env.DEV
  ? 'deskcal-dev://auth/callback'
  : 'deskcal://auth/callback'
const APP_DEEPLINK_SCHEME = import.meta.env.VITE_APP_DEEPLINK_SCHEME || DEFAULT_DEEPLINK_SCHEME

type OAuthProvider = 'kakao' | 'google' | 'apple'

function getMergedParams(url: URL): URLSearchParams {
  const merged = new URLSearchParams(url.search)

  if (url.hash.startsWith('#')) {
    const hashParams = new URLSearchParams(url.hash.slice(1))
    hashParams.forEach((value, key) => {
      if (!merged.has(key)) {
        merged.set(key, value)
      }
    })
  }

  return merged
}

export function LoginPage() {
  const { t } = useTranslation()
  const { setAuth } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const appWindow = getCurrentWindow()

  const [isLoading, setIsLoading] = useState<OAuthProvider | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const pendingProviderRef = useRef<OAuthProvider | null>(null)

  useEffect(() => {
    let unlistenFn: (() => void) | null = null

    listen<string>('deep-link://new-url', async (event) => {
      try {
        const url = new URL(event.payload)
        if (url.hostname !== 'auth' || url.pathname !== '/callback') {
          return
        }

        const params = getMergedParams(url)
        const accessToken = params.get('accessToken')
        const refreshToken = params.get('refreshToken')
        const memberId = params.get('memberId')
        const nickname = params.get('nickname')
        const email = params.get('email')
        const providerParam = params.get('provider') as OAuthProvider | null
        const errorParam = params.get('error')

        if (errorParam) {
          setError(`Login failed: ${errorParam}`)
          setStatusMessage(null)
          setIsLoading(null)
          pendingProviderRef.current = null
          return
        }

        const resolvedProvider = providerParam || pendingProviderRef.current || 'kakao'

        if (!accessToken || !refreshToken || !memberId) {
          setError('Invalid login response: missing required parameters')
          setStatusMessage(null)
          setIsLoading(null)
          pendingProviderRef.current = null
          return
        }

        setStatusMessage(t('auth.loginSuccess', '로그인 성공! 앱으로 이동 중...'))
        sessionStorage.setItem('pecal_login_success', '1')

        setAuth(
          {
            memberId: Number(memberId),
            nickname: nickname || 'User',
            email: email || undefined,
            provider: resolvedProvider,
          },
          accessToken,
          refreshToken,
        )

        setError(null)
        setIsLoading(null)
        pendingProviderRef.current = null

        await appWindow.show().catch(() => {})
        await appWindow.setFocus().catch(() => {})
      } catch (err) {
        console.error('Failed to process deep link callback:', err)
        setError('Failed to process login callback')
        setStatusMessage(null)
        setIsLoading(null)
        pendingProviderRef.current = null
      }
    })
      .then((fn) => {
        unlistenFn = fn
      })
      .catch((err) => {
        console.error('Failed to register deep link listener:', err)
      })

    return () => {
      if (unlistenFn) unlistenFn()
    }
  }, [appWindow, setAuth, t])

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    setIsLoading(provider)
    setError(null)
    setStatusMessage(
      t('auth.waitingForBrowser', 'Browser opened. Complete login and return to the app...'),
    )
    pendingProviderRef.current = provider

    try {
      const callbackUrl = APP_DEEPLINK_SCHEME
      const response = await fetch(
        `${API_BASE_URL}/api/auth/${provider}/start?callback=${encodeURIComponent(callbackUrl)}`
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Backend returned ${response.status}`)
      }

      const { authUrl } = await response.json()
      if (!authUrl) throw new Error('No authUrl in response')

      try {
        await open(authUrl)
      } catch (openErr) {
        console.error('Failed to open auth URL via shell plugin:', openErr)
        window.open(authUrl, '_blank')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(`${t('auth.loginFailed')} (${errorMessage})`)
      setStatusMessage(null)
      setIsLoading(null)
      pendingProviderRef.current = null
    }
  }

  const handleCancelLogin = () => {
    setIsLoading(null)
    setError(null)
    setStatusMessage(null)
    pendingProviderRef.current = null
  }

  const handleCloseApp = async () => {
    try {
      await appWindow.close()
    } catch (err) {
      console.error('Failed to close app:', err)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <button
            onClick={handleCloseApp}
            className="absolute right-3 top-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={t('auth.closeApp', 'Close app')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pecal</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">{t('auth.loginDescription')}</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
            </div>
          )}

          {statusMessage && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-400 text-center">{statusMessage}</p>
            </div>
          )}

          <button
            onClick={() => handleOAuthLogin('kakao')}
            disabled={!!isLoading}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#FEE500] hover:bg-[#FDD800] text-[#191919] font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading === 'kakao' ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#191919]" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3C6.477 3 2 6.463 2 10.691c0 2.678 1.785 5.035 4.478 6.378-.143.521-.921 3.358-.953 3.585 0 0-.019.159.084.22.103.06.226.013.226.013.298-.041 3.449-2.259 3.993-2.648.714.103 1.453.156 2.172.156 5.523 0 10-3.463 10-7.704S17.523 3 12 3z" />
                </svg>
                <span>{t('auth.kakaoLogin')}</span>
              </>
            )}
          </button>

          <button
            onClick={() => handleOAuthLogin('google')}
            disabled={!!isLoading}
            className="mt-3 w-full flex items-center justify-center gap-3 px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl border border-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading === 'google' ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.3-1.5 3.8-5.1 3.8-3.1 0-5.6-2.6-5.6-5.6S8.9 6.4 12 6.4c1.8 0 3 .8 3.7 1.5l2.5-2.5C16.7 3.8 14.6 2.8 12 2.8 7.7 2.8 4.2 6.3 4.2 10.6S7.7 18.4 12 18.4c5.2 0 6.5-3.6 6.5-5.4 0-.4 0-.7-.1-1H12z" />
                  <path fill="#34A853" d="M12 18.4c2.6 0 4.7-.8 6.3-2.1l-2.5-2.1c-.7.5-1.7.9-3.8.9-3.1 0-5.6-2.6-5.6-5.6H4.2v2.1C5.7 15.9 8.6 18.4 12 18.4z" />
                  <path fill="#4A90E2" d="M18.4 13c.1-.3.1-.6.1-1s0-.7-.1-1H12v2h6.4z" />
                  <path fill="#FBBC05" d="M6.4 10.6c0-.7.2-1.4.5-2l-2.6-2C3.6 8 3.2 9.3 3.2 10.6s.4 2.6 1.1 3.7l2.6-2c-.3-.6-.5-1.3-.5-2z" />
                </svg>
                <span>{t('auth.googleLogin', 'Continue with Google')}</span>
              </>
            )}
          </button>

          <button
            onClick={() => handleOAuthLogin('apple')}
            disabled={!!isLoading}
            className="mt-3 w-full flex items-center justify-center gap-3 px-6 py-3 bg-black hover:bg-black/90 text-white font-medium rounded-xl border border-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading === 'apple' ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M16.365 1.43c0 1.14-.465 2.254-1.203 3.064-.773.842-2.023 1.49-3.173 1.455-.147-1.104.43-2.265 1.174-3.044.803-.835 2.177-1.486 3.202-1.475zM20.93 17.06c-.66 1.44-.97 2.081-1.82 3.386-1.19 1.825-2.868 4.102-4.947 4.118-1.847.016-2.324-1.21-4.832-1.2-2.508.013-3.033 1.223-4.879 1.207-2.078-.016-3.667-2.073-4.857-3.898C-3.9 14.98-.4 8.35 4.56 8.28c1.93-.03 3.152 1.33 4.317 1.33 1.165 0 2.948-1.644 4.974-1.4.849.036 3.233.342 4.765 2.58-3.863 2.114-3.24 7.56 2.313 8.27z" />
                </svg>
                <span>{t('auth.appleLogin', 'Continue with Apple')}</span>
              </>
            )}
          </button>

          {isLoading && (
            <button
              onClick={handleCancelLogin}
              className="mt-3 w-full px-6 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors"
            >
              {t('auth.cancelLogin', 'Cancel login')}
            </button>
          )}

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
          </div>

          <div className="flex items-center justify-center">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {theme === 'light' ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                  </svg>
                  <span>{t('theme.dark')}</span>
                </>
              ) : theme === 'dark' ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  <span>{t('theme.pink')}</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 21s-7-4.35-7-10a4 4 0 017-2.65A4 4 0 0119 11c0 5.65-7 10-7 10z"
                    />
                  </svg>
                  <span>{t('theme.light')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
