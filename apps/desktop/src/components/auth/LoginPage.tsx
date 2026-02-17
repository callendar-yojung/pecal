import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-shell'
import { fetch } from '@tauri-apps/plugin-http'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useAuthStore, useThemeStore } from '../../stores'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const DEFAULT_DEEPLINK_SCHEME = import.meta.env.DEV ? 'deskcal-dev://auth/callback' : 'deskcal://auth/callback'
const APP_DEEPLINK_SCHEME = import.meta.env.VITE_APP_DEEPLINK_SCHEME || DEFAULT_DEEPLINK_SCHEME

export function LoginPage() {
  const { t } = useTranslation()
  const { setAuth } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const [isLoading, setIsLoading] = useState<'kakao' | 'google' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingProvider, setPendingProvider] = useState<'kakao' | 'google' | null>(null)
  const appWindow = getCurrentWindow()

  // Deep link 리스너 설정
  useEffect(() => {
    console.log('🔗 Deep link 리스너 등록 중...')
    let unlistenFn: (() => void) | null = null

    // 비동기로 리스너 등록
    listen<string>('deep-link://new-url', (event) => {
      console.log('═══════════════════════════════════════════════════')
      console.log('📥 Deep link 수신:', event.payload)
      console.log('═══════════════════════════════════════════════════')

      try {
        const url = new URL(event.payload)

        // deskcal://auth/callback 체크
        if (url.hostname !== 'auth' || url.pathname !== '/callback') {
          console.log('❌ 잘못된 deep link 경로:', url.hostname, url.pathname)
          return
        }

        // 백엔드에서 보낸 파라미터 추출
        const accessToken = url.searchParams.get('accessToken')
        const refreshToken = url.searchParams.get('refreshToken')
        const memberId = url.searchParams.get('memberId')
        const nickname = url.searchParams.get('nickname')
        const email = url.searchParams.get('email')
        const providerParam = url.searchParams.get('provider')
        const errorParam = url.searchParams.get('error')

        // 에러 처리
        if (errorParam) {
          console.error('❌ 로그인 에러:', errorParam)
          setError(`Login failed: ${errorParam}`)
          setIsLoading(null)
          return
        }

        const resolvedProvider =
          (providerParam as 'kakao' | 'google') || pendingProvider || 'kakao'

        // 필수 파라미터 체크
        if (!accessToken || !refreshToken || !memberId) {
          console.error('❌ 필수 파라미터 누락:', {
            accessToken: !!accessToken,
            refreshToken: !!refreshToken,
            memberId: !!memberId,
          })
          setError('Invalid login response: missing required parameters')
          setIsLoading(null)
          return
        }

        console.log('✅ 로그인 성공:', {
          memberId,
          nickname,
          email: email || 'N/A',
          provider: resolvedProvider,
        })

        // Member 객체 생성 및 인증 설정
        setAuth(
          {
            memberId: Number(memberId),
            nickname: nickname || 'User',
            email: email || undefined,
            provider: resolvedProvider,
          },
          accessToken,
          refreshToken
        )

        setError(null)
        setIsLoading(null)
        setPendingProvider(null)
      } catch (err) {
        console.error('❌ Deep link 파싱 에러:', err)
        setError('Failed to process login callback')
        setIsLoading(null)
        setPendingProvider(null)
      }
    }).then((fn) => {
      unlistenFn = fn
      console.log('✅ Deep link 리스너 등록 완료')
    }).catch((err) => {
      console.error('❌ Deep link 리스너 등록 실패:', err)
    })

    return () => {
      if (unlistenFn) {
        unlistenFn()
        console.log('🔗 Deep link 리스너 해제')
      }
    }
  }, [setAuth, pendingProvider])

  const handleCloseApp = async () => {
    try {
      await appWindow.close()
    } catch (err) {
      console.error('Failed to close app:', err)
    }
  }

  const handleOAuthLogin = async (provider: 'kakao' | 'google') => {
    console.log(`🚀 ${provider} 로그인 시작`)
    setIsLoading(provider)
    setError(null)
    setPendingProvider(provider)

    try {
      // 백엔드에서 OAuth URL 가져오기
      console.log('📡 백엔드에서 OAuth URL 요청 중...')

      const callbackUrl = APP_DEEPLINK_SCHEME
      console.log('🔗 Callback URL:', callbackUrl)

      const response = await fetch(
        `${API_BASE_URL}/api/auth/${provider}/start?callback=${encodeURIComponent(callbackUrl)}`
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Backend returned ${response.status}`)
      }

      const { authUrl } = await response.json()

      if (!authUrl) {
        throw new Error('No authUrl in response')
      }

      // 로그인 페이지 열기
      console.log('🌐 로그인 페이지 열기:', authUrl)
      try {
        await open(authUrl)
        console.log('✅ 브라우저 오픈 완료. 로그인 대기 중...')
      } catch (openError) {
        console.error('❌ open() 실패:', openError)
        console.log('🔄 window.open으로 fallback 시도...')
        window.open(authUrl, '_blank')
      }
    } catch (err) {
      console.error('❌ 로그인 실패:', err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(`${t('auth.loginFailed')} (${errorMessage})`)
      setIsLoading(null)
      setPendingProvider(null)
    }
  }

  const handleCancelLogin = () => {
    setIsLoading(null)
    setError(null)
    setPendingProvider(null)
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
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Pecal
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              {t('auth.loginDescription')}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400 text-center">
                {error}
              </p>
            </div>
          )}

          {/* Loading state info */}
          {isLoading && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-400 text-center">
                {t(
                  'auth.waitingForBrowser',
                  'Browser opened. Complete login and return to the app...'
                )}
              </p>
            </div>
          )}

          {/* Kakao Login Button */}
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

          {/* Google Login Button */}
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

          {isLoading && (
            <button
              onClick={handleCancelLogin}
              className="mt-3 w-full px-6 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors"
            >
              {t('auth.cancelLogin', 'Cancel login')}
            </button>
          )}

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
          </div>

          {/* Theme Toggle */}
          <div className="flex items-center justify-center">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {theme === 'light' ? (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
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
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
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
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
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
