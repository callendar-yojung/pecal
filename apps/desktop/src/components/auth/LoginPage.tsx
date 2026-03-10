import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { fetch } from '@tauri-apps/plugin-http'
import { open } from '@tauri-apps/plugin-shell'
import { authApi } from '../../api'
import { useAuthStore, useThemeStore } from '../../stores'
import { resolveApiBaseUrl } from '../../lib/apiBaseUrl'

const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL, 'http://localhost:3000')
const DEFAULT_DEEPLINK_SCHEME = import.meta.env.DEV
  ? 'deskcal-dev://auth/callback'
  : 'deskcal://auth/callback'
const APP_DEEPLINK_SCHEME = import.meta.env.VITE_APP_DEEPLINK_SCHEME || DEFAULT_DEEPLINK_SCHEME

type OAuthProvider = 'kakao' | 'google' | 'apple'
type AvailabilityState = 'idle' | 'available' | 'taken'

const EMAIL_VERIFICATION_TTL_SECONDS = 3 * 60

function isValidRegisterPassword(password: string) {
  return password.length >= 8 && /[^A-Za-z0-9]/.test(password)
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remain = seconds % 60
  return `${minutes}:${String(remain).padStart(2, '0')}`
}

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
  const [localMode, setLocalMode] = useState<'login' | 'register'>('login')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [checkingLoginId, setCheckingLoginId] = useState(false)
  const [checkingNickname, setCheckingNickname] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [verifyingCode, setVerifyingCode] = useState(false)
  const [loginIdCheck, setLoginIdCheck] = useState<AvailabilityState>('idle')
  const [nicknameCheck, setNicknameCheck] = useState<AvailabilityState>('idle')
  const [emailVerified, setEmailVerified] = useState(false)
  const [emailVerifiedTarget, setEmailVerifiedTarget] = useState('')
  const [verificationExpiresAt, setVerificationExpiresAt] = useState<number | null>(null)
  const [verificationRemainingSeconds, setVerificationRemainingSeconds] = useState(0)
  const pendingProviderRef = useRef<OAuthProvider | null>(null)

  useEffect(() => {
    if (!verificationExpiresAt) {
      setVerificationRemainingSeconds(0)
      return
    }

    const updateRemaining = () => {
      const remain = Math.max(0, Math.ceil((verificationExpiresAt - Date.now()) / 1000))
      setVerificationRemainingSeconds(remain)
    }

    updateRemaining()
    const timer = window.setInterval(updateRemaining, 1000)
    return () => window.clearInterval(timer)
  }, [verificationExpiresAt])

  const passwordValid = localMode === 'login' || isValidRegisterPassword(password)
  const passwordConfirmed = localMode === 'login' || password === passwordConfirm
  const registerReady =
    localMode === 'login' ||
    (loginId.trim().length > 0 &&
      password.trim().length > 0 &&
      email.trim().length > 0 &&
      nickname.trim().length > 0 &&
      passwordValid &&
      passwordConfirmed &&
      emailVerified &&
      emailVerifiedTarget === email.trim().toLowerCase() &&
      loginIdCheck === 'available' &&
      nicknameCheck === 'available')

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
      const requestUrl = `${API_BASE_URL}/api/auth/${provider}/start?callback=${encodeURIComponent(callbackUrl)}`
      let response: Awaited<ReturnType<typeof fetch>>
      try {
        response = await fetch(requestUrl)
      } catch (networkError) {
        throw new Error(`Network request failed: ${requestUrl}`)
      }

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

  const handleLocalSubmit = async () => {
    setIsLoading(null)
    setError(null)
    setStatusMessage(null)

    try {
      if (localMode === 'login') {
        const response = await authApi.loginWithPassword(loginId, password)
        setAuth(response.user, response.accessToken, response.refreshToken)
        return
      }

      if (!passwordConfirmed) {
        setError(t('auth.passwordMismatch', '비밀번호 확인이 일치하지 않습니다.'))
        return
      }
      if (!passwordValid) {
        setError(t('auth.passwordRule', '비밀번호는 8자 이상이며 특수문자를 포함해야 합니다.'))
        return
      }

      if (loginIdCheck !== 'available' || nicknameCheck !== 'available') {
        setError(t('auth.availabilityCheckFailed', '중복 확인을 완료해 주세요.'))
        return
      }
      if (!emailVerified || emailVerifiedTarget !== email.trim().toLowerCase()) {
        setError(t('auth.verificationRequired', '이메일 인증을 완료해 주세요.'))
        return
      }

      const response = await authApi.registerWithPassword(loginId, password, nickname, email)
      setAuth(response.user, response.accessToken, response.refreshToken)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message || t('auth.loginFailed'))
    }
  }

  const checkAvailability = async (field: 'loginId' | 'nickname') => {
    if (field === 'loginId') {
      if (!loginId.trim()) {
        setError(t('auth.loginIdPlaceholder', '아이디를 입력하세요'))
        return
      }
      setCheckingLoginId(true)
    } else {
      if (!nickname.trim()) {
        setError(t('auth.nicknamePlaceholder', '닉네임을 입력하세요'))
        return
      }
      setCheckingNickname(true)
    }

    setError(null)

    try {
      const result = await authApi.checkLocalAvailability({
        loginId: field === 'loginId' ? loginId.trim() : undefined,
        nickname: field === 'nickname' ? nickname.trim() : undefined,
      })

      if (field === 'loginId') {
        const available = result.loginId?.available ?? false
        setLoginIdCheck(available ? 'available' : 'taken')
        if (!available) {
          setError(t('auth.loginIdTaken', '이미 사용 중인 아이디입니다.'))
        }
      } else {
        const available = result.nickname?.available ?? false
        setNicknameCheck(available ? 'available' : 'taken')
        if (!available) {
          setError(t('auth.nicknameTaken', '이미 사용 중인 닉네임입니다.'))
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message || t('auth.availabilityCheckFailed', '중복 확인을 완료해 주세요.'))
    } finally {
      if (field === 'loginId') {
        setCheckingLoginId(false)
      } else {
        setCheckingNickname(false)
      }
    }
  }

  const sendVerificationCode = async () => {
    setError(null)
    setStatusMessage(null)
    setSendingCode(true)
    try {
      await authApi.sendRegisterVerificationCode(email.trim())
      setEmailVerified(false)
      setEmailVerifiedTarget('')
      setVerificationCode('')
      setVerificationExpiresAt(Date.now() + EMAIL_VERIFICATION_TTL_SECONDS * 1000)
      setStatusMessage(t('auth.verificationCodeSent', '인증 코드를 보냈습니다.'))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message || t('auth.loginFailed'))
    } finally {
      setSendingCode(false)
    }
  }

  const verifyEmailCode = async () => {
    setError(null)
    setStatusMessage(null)
    setVerifyingCode(true)
    try {
      if (verificationRemainingSeconds <= 0) {
        setError(t('auth.verificationExpired', '인증 코드가 만료되었습니다. 다시 요청해 주세요.'))
        return
      }
      const normalizedEmail = email.trim().toLowerCase()
      await authApi.verifyRegisterVerificationCode(normalizedEmail, verificationCode.trim())
      setEmailVerified(true)
      setEmailVerifiedTarget(normalizedEmail)
      setStatusMessage(t('auth.verificationVerified', '이메일 인증이 완료되었습니다.'))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setEmailVerified(false)
      setEmailVerifiedTarget('')
      setError(message || t('auth.loginFailed'))
    } finally {
      setVerifyingCode(false)
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
            <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4 border border-gray-200 dark:border-gray-700 bg-white">
              <img src="/icon.png" alt="Pecal icon" className="w-full h-full object-cover" />
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

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 dark:bg-gray-700 p-1 mb-4">
            <button
              type="button"
              onClick={() => setLocalMode('login')}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                localMode === 'login'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-300'
              }`}
            >
              {t('auth.localLogin', '일반 로그인')}
            </button>
            <button
              type="button"
              onClick={() => setLocalMode('register')}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                localMode === 'register'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-300'
              }`}
            >
              {t('auth.localRegister', '회원가입')}
            </button>
          </div>

          <div className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <input
              value={loginId}
              onChange={(event) => {
                setLoginId(event.target.value)
                setLoginIdCheck('idle')
              }}
              placeholder={t('auth.loginIdPlaceholder', '아이디를 입력하세요')}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white outline-none"
            />
            {localMode === 'register' ? (
              <button
                type="button"
                onClick={() => checkAvailability('loginId')}
                disabled={checkingLoginId || !loginId.trim()}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {checkingLoginId
                  ? t('auth.checking', '확인 중...')
                  : t('auth.checkLoginId', '아이디 중복 확인')}
              </button>
            ) : null}
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('auth.passwordPlaceholder', '비밀번호를 입력하세요')}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white outline-none"
            />
            {localMode === 'register' ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('auth.passwordRule', '비밀번호는 8자 이상이며 특수문자를 포함해야 합니다.')}
              </p>
            ) : null}
            {localMode === 'register' ? (
              <>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  placeholder={t('auth.passwordConfirmPlaceholder', '비밀번호를 다시 입력하세요')}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white outline-none"
                />
                {!passwordConfirmed ? (
                  <p className="text-xs text-red-500">{t('auth.passwordMismatch', '비밀번호 확인이 일치하지 않습니다.')}</p>
                ) : null}
                <input
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setEmailVerified(false)
                    setEmailVerifiedTarget('')
                    setVerificationExpiresAt(null)
                  }}
                  placeholder={t('auth.emailPlaceholder', '이메일을 입력하세요')}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white outline-none"
                />
                <button
                  type="button"
                  onClick={sendVerificationCode}
                  disabled={sendingCode || !email.trim()}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {sendingCode
                    ? t('auth.checking', '확인 중...')
                    : t('auth.sendVerificationCode', '인증 코드 보내기')}
                </button>
                {verificationExpiresAt && !emailVerified ? (
                  <p
                    className={`text-xs ${
                      verificationRemainingSeconds > 0
                        ? 'text-gray-500 dark:text-gray-400'
                        : 'text-red-500'
                    }`}
                  >
                    {verificationRemainingSeconds > 0
                      ? t('auth.verificationExpiresIn', { time: formatCountdown(verificationRemainingSeconds) })
                      : t('auth.verificationExpired', '인증 코드가 만료되었습니다. 다시 요청해 주세요.')}
                  </p>
                ) : null}
                <input
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  placeholder={t('auth.verificationCodePlaceholder', '인증 코드를 입력하세요')}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white outline-none"
                />
                <button
                  type="button"
                  onClick={verifyEmailCode}
                  disabled={verifyingCode || !email.trim() || !verificationCode.trim()}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {verifyingCode
                    ? t('auth.checking', '확인 중...')
                    : t('auth.verifyVerificationCode', '인증 코드 확인')}
                </button>
                {emailVerified && emailVerifiedTarget === email.trim().toLowerCase() ? (
                  <p className="text-xs text-green-600">
                    {t('auth.verificationVerified', '이메일 인증이 완료되었습니다.')}
                  </p>
                ) : null}
                <input
                  value={nickname}
                  onChange={(event) => {
                    setNickname(event.target.value)
                    setNicknameCheck('idle')
                  }}
                  placeholder={t('auth.nicknamePlaceholder', '닉네임을 입력하세요')}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => checkAvailability('nickname')}
                  disabled={checkingNickname || !nickname.trim()}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {checkingNickname
                    ? t('auth.checking', '확인 중...')
                    : t('auth.checkNickname', '닉네임 중복 확인')}
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={handleLocalSubmit}
              disabled={!loginId.trim() || !password.trim() || !registerReady}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {localMode === 'login'
                ? t('auth.localLoginAction', '로그인')
                : t('auth.localRegisterAction', '회원가입')}
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white dark:bg-gray-800 px-3 text-xs text-gray-400">
                {t('auth.orDivider', '또는')}
              </span>
            </div>
          </div>

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
