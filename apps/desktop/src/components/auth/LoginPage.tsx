import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { fetch } from '@tauri-apps/plugin-http'
import { authApi } from '../../api'
import { openExternal } from '../../lib/openExternal'
import { useAuthStore, useThemeStore } from '../../stores'
import { resolveApiBaseUrl } from '../../lib/apiBaseUrl'

const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL, 'https://pecal.site')
const DEFAULT_DEEPLINK_SCHEME = import.meta.env.DEV
  ? 'deskcal-dev://auth/callback'
  : 'deskcal://auth/callback'
const APP_DEEPLINK_SCHEME = import.meta.env.VITE_APP_DEEPLINK_SCHEME || DEFAULT_DEEPLINK_SCHEME

type OAuthProvider = 'kakao' | 'google' | 'apple'
type AvailabilityState = 'idle' | 'available' | 'taken'
type LocalMode = 'login' | 'register' | 'findId' | 'resetPassword'
type AuthPanel = 'entry' | 'local' | 'social'

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
  const [authPanel, setAuthPanel] = useState<AuthPanel>('entry')
  const [localMode, setLocalMode] = useState<LocalMode>('login')
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
  const [findingLoginId, setFindingLoginId] = useState(false)
  const [sendingResetCode, setSendingResetCode] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [submittingLocal, setSubmittingLocal] = useState(false)
  const [loginIdCheck, setLoginIdCheck] = useState<AvailabilityState>('idle')
  const [nicknameCheck, setNicknameCheck] = useState<AvailabilityState>('idle')
  const [emailVerified, setEmailVerified] = useState(false)
  const [emailVerifiedTarget, setEmailVerifiedTarget] = useState('')
  const [verificationExpiresAt, setVerificationExpiresAt] = useState<number | null>(null)
  const [verificationRemainingSeconds, setVerificationRemainingSeconds] = useState(0)
  const pendingProviderRef = useRef<OAuthProvider | null>(null)
  const isAuthPending = isLoading !== null || submittingLocal

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

  const registerMode = localMode === 'register'
  const resetMode = localMode === 'resetPassword'
  const passwordValid = (!registerMode && !resetMode) || isValidRegisterPassword(password)
  const passwordConfirmed = (!registerMode && !resetMode) || password === passwordConfirm
  const submitDisabled =
    (localMode === 'login' && (!loginId.trim() || !password.trim())) ||
    (localMode === 'register' &&
      (!loginId.trim() ||
        !password.trim() ||
        !passwordValid ||
        !passwordConfirm.trim() ||
        !passwordConfirmed ||
        !nickname.trim() ||
        !email.trim() ||
        !emailVerified ||
        emailVerifiedTarget !== email.trim().toLowerCase() ||
        loginIdCheck !== 'available' ||
        nicknameCheck !== 'available')) ||
    (localMode === 'findId' && !email.trim()) ||
    (localMode === 'resetPassword' &&
      (!loginId.trim() ||
        !email.trim() ||
        !verificationCode.trim() ||
        !password.trim() ||
        !passwordConfirm.trim() ||
        !passwordValid ||
        !passwordConfirmed))

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

  const openLocalPanel = (nextMode: LocalMode = 'login') => {
    setAuthPanel('local')
    setLocalMode(nextMode)
    setError(null)
    setStatusMessage(null)
  }

  const openSocialPanel = () => {
    setAuthPanel('social')
    setError(null)
    setStatusMessage(null)
  }


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
      const response = await fetch(requestUrl)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Backend returned ${response.status}`)
      }

      const { authUrl } = await response.json()
      if (!authUrl) throw new Error('No authUrl in response')

      await openExternal(authUrl)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(`${t('auth.loginFailed')} (${errorMessage})`)
      setStatusMessage(null)
      setIsLoading(null)
      pendingProviderRef.current = null
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
        if (!available) setError(t('auth.loginIdTaken', '이미 사용 중인 아이디입니다.'))
      } else {
        const available = result.nickname?.available ?? false
        setNicknameCheck(available ? 'available' : 'taken')
        if (!available) setError(t('auth.nicknameTaken', '이미 사용 중인 닉네임입니다.'))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message || t('auth.availabilityCheckFailed', '중복 확인을 완료해 주세요.'))
    } finally {
      if (field === 'loginId') setCheckingLoginId(false)
      else setCheckingNickname(false)
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

  const sendResetCode = async () => {
    setError(null)
    setStatusMessage(null)
    setSendingResetCode(true)
    try {
      const response = await authApi.sendPasswordResetCode(loginId.trim(), email.trim())
      setVerificationExpiresAt(Date.now() + EMAIL_VERIFICATION_TTL_SECONDS * 1000)
      setStatusMessage(response.message || t('auth.resetCodeSent', '비밀번호 찾기 코드를 보냈습니다.'))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message || t('auth.loginFailed'))
    } finally {
      setSendingResetCode(false)
    }
  }

  const handleLocalSubmit = async () => {
    setIsLoading(null)
    setSubmittingLocal(true)
    setError(null)
    setStatusMessage(null)

    try {
      if (localMode === 'login') {
        const response = await authApi.loginWithPassword(loginId, password)
        setAuth(response.user, response.accessToken, response.refreshToken)
        return
      }

      if (localMode === 'findId') {
        setFindingLoginId(true)
        const response = await authApi.findLoginId(email.trim())
        setStatusMessage(response.message || t('auth.findIdSent', '아이디 안내 메일을 보냈습니다.'))
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

      if (localMode === 'resetPassword') {
        setResettingPassword(true)
        if (verificationRemainingSeconds <= 0) {
          setError(t('auth.verificationExpired', '인증 코드가 만료되었습니다. 다시 요청해 주세요.'))
          return
        }
        await authApi.resetPassword({
          loginId,
          email,
          code: verificationCode,
          password,
        })
        setStatusMessage(t('auth.resetPasswordSuccess', '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.'))
        setLocalMode('login')
        setPassword('')
        setPasswordConfirm('')
        setVerificationCode('')
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
    } finally {
      setFindingLoginId(false)
      setResettingPassword(false)
      setSubmittingLocal(false)
    }
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

          {authPanel === 'entry' ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => openLocalPanel('login')}
                disabled={isAuthPending}
                className="w-full rounded-xl bg-gray-900 px-4 py-4 text-base font-semibold text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-gray-900"
              >
                {t('auth.entryLocal')}
              </button>
              <button
                type="button"
                onClick={openSocialPanel}
                disabled={isAuthPending}
                className="flex w-full items-center gap-3 rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-4 text-base font-semibold text-gray-900 dark:text-white transition-colors hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                <span className="min-w-0 flex-1 truncate text-left">{t('auth.entrySocial')}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FEE500] shadow-sm ring-1 ring-black/5">
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-[#191919]" aria-hidden="true">
                      <path d="M12 4C7.03 4 3 7.13 3 11c0 2.5 1.67 4.68 4.18 5.92L6.3 20.6a.6.6 0 0 0 .88.66l4.28-2.69c.18.01.36.03.54.03 4.97 0 9-3.13 9-7s-4.03-7-9-7Z" />
                    </svg>
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-600">
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden="true">
                      <path fill="#EA4335" d="M12 10.2v3.92h5.45c-.24 1.26-.97 2.33-2.05 3.05l3.32 2.57c1.94-1.79 3.05-4.43 3.05-7.57 0-.72-.07-1.42-.2-2.1H12Z" />
                      <path fill="#34A853" d="M12 21c2.76 0 5.08-.91 6.77-2.46l-3.32-2.57c-.92.62-2.1.98-3.45.98-2.65 0-4.89-1.79-5.69-4.19l-3.43 2.65A10.23 10.23 0 0 0 12 21Z" />
                      <path fill="#4A90E2" d="M6.31 12.76A6.13 6.13 0 0 1 6 10.8c0-.68.12-1.34.31-1.96L2.88 6.19A10.23 10.23 0 0 0 1.8 10.8c0 1.65.4 3.21 1.08 4.61l3.43-2.65Z" />
                      <path fill="#FBBC05" d="M12 4.66c1.5 0 2.85.52 3.92 1.53l2.94-2.94C17.07 1.64 14.76.6 12 .6 7.98.6 4.5 2.9 2.88 6.19l3.43 2.65c.8-2.4 3.04-4.18 5.69-4.18Z" />
                    </svg>
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black shadow-sm ring-1 ring-black/10">
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-white" aria-hidden="true">
                      <path d="M16.37 12.54c.02 2.21 1.94 2.95 1.96 2.96-.02.05-.31 1.08-1.03 2.15-.62.92-1.27 1.84-2.29 1.86-1 .02-1.32-.59-2.46-.59-1.14 0-1.5.57-2.44.61-1 .04-1.76-1-2.39-1.92-1.29-1.86-2.28-5.25-.95-7.58.66-1.16 1.84-1.9 3.12-1.92.98-.02 1.9.66 2.46.66.56 0 1.62-.81 2.73-.69.47.02 1.78.19 2.62 1.42-.07.04-1.56.91-1.53 3.04ZM14.73 5.55c.52-.63.88-1.5.78-2.37-.75.03-1.66.5-2.2 1.13-.49.57-.92 1.45-.81 2.3.84.06 1.71-.43 2.23-1.06Z" />
                    </svg>
                  </span>
                </span>
              </button>
            </div>
          ) : null}

          {authPanel === 'local' ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setAuthPanel('entry')
                  setError(null)
                  setStatusMessage(null)
                }}
                className="inline-flex items-center gap-2 self-start rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                <span aria-hidden="true">←</span>
                {t('auth.entryBack')}
              </button>

              <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 dark:bg-gray-700 p-1">
                {[
                  ['login', t('auth.localLogin')],
                  ['register', t('auth.localRegister')],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setLocalMode(key as LocalMode)
                      setError(null)
                      setStatusMessage(null)
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      localMode === key
                        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                {localMode !== 'findId' ? (
                  <input
                    value={loginId}
                    onChange={(event) => {
                      setLoginId(event.target.value)
                      setLoginIdCheck('idle')
                    }}
                    placeholder={t('auth.loginIdPlaceholder', '아이디를 입력하세요')}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white outline-none"
                  />
                ) : null}

                {localMode === 'register' ? (
                  <>
                    <button type="button" onClick={() => checkAvailability('loginId')} disabled={checkingLoginId || !loginId.trim()} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800">
                      {checkingLoginId ? t('auth.checking', '확인 중...') : t('auth.checkLoginId', '아이디 중복 확인')}
                    </button>
                    {loginIdCheck === 'available' ? (
                      <p className="text-sm font-medium text-emerald-600">{t('auth.loginIdAvailable', '사용 가능한 아이디입니다.')}</p>
                    ) : null}
                    {loginIdCheck === 'taken' ? (
                      <p className="text-sm font-medium text-rose-600">{t('auth.loginIdTaken', '이미 사용 중인 아이디입니다.')}</p>
                    ) : null}
                  </>
                ) : null}

                {(localMode === 'login' || localMode === 'register' || localMode === 'resetPassword') ? (
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={t('auth.passwordPlaceholder', '비밀번호를 입력하세요')}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white outline-none"
                  />
                ) : null}

                {(localMode === 'register' || localMode === 'resetPassword') ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('auth.passwordRule')}</p>
                ) : null}

                {(localMode === 'register' || localMode === 'resetPassword') ? (
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(event) => setPasswordConfirm(event.target.value)}
                    placeholder={t('auth.passwordConfirmPlaceholder', '비밀번호를 다시 입력하세요')}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white outline-none"
                  />
                ) : null}
                {(localMode === 'register' || localMode === 'resetPassword') && !passwordConfirmed && passwordConfirm ? (
                  <p className="text-xs text-red-500">{t('auth.passwordMismatch')}</p>
                ) : null}

                {(localMode === 'register' || localMode === 'findId' || localMode === 'resetPassword') ? (
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
                ) : null}

                {localMode === 'register' ? (
                  <button type="button" onClick={sendVerificationCode} disabled={sendingCode || !email.trim()} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800">
                    {sendingCode ? t('auth.checking', '확인 중...') : t('auth.sendVerificationCode')}
                  </button>
                ) : null}

                {localMode === 'resetPassword' ? (
                  <button type="button" onClick={sendResetCode} disabled={sendingResetCode || !loginId.trim() || !email.trim()} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800">
                    {sendingResetCode ? t('auth.checking', '확인 중...') : t('auth.sendResetCode')}
                  </button>
                ) : null}

                {verificationExpiresAt && (localMode === 'register' || localMode === 'resetPassword') ? (
                  <p className={`text-xs ${verificationRemainingSeconds > 0 ? 'text-gray-500 dark:text-gray-400' : 'text-red-500'}`}>
                    {verificationRemainingSeconds > 0 ? t('auth.verificationExpiresIn', { time: formatCountdown(verificationRemainingSeconds) }) : t('auth.verificationExpired')}
                  </p>
                ) : null}

                {(localMode === 'register' || localMode === 'resetPassword') ? (
                  <input
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value)}
                    placeholder={t('auth.verificationCodePlaceholder', '인증 코드를 입력하세요')}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white outline-none"
                  />
                ) : null}

                {localMode === 'register' ? (
                  <button type="button" onClick={verifyEmailCode} disabled={verifyingCode || !email.trim() || !verificationCode.trim()} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800">
                    {verifyingCode ? t('auth.checking', '확인 중...') : t('auth.verifyVerificationCode')}
                  </button>
                ) : null}

                {localMode === 'register' && emailVerified && emailVerifiedTarget === email.trim().toLowerCase() ? (
                  <p className="text-xs text-green-600">{t('auth.verificationVerified')}</p>
                ) : null}

                {localMode === 'register' ? (
                  <>
                    <input
                      value={nickname}
                      onChange={(event) => {
                        setNickname(event.target.value)
                        setNicknameCheck('idle')
                      }}
                      placeholder={t('auth.nicknamePlaceholder', '닉네임을 입력하세요')}
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white outline-none"
                    />
                    <button type="button" onClick={() => checkAvailability('nickname')} disabled={checkingNickname || !nickname.trim()} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800">
                      {checkingNickname ? t('auth.checking', '확인 중...') : t('auth.checkNickname', '닉네임 중복 확인')}
                    </button>
                    {nicknameCheck === 'available' ? (
                      <p className="text-sm font-medium text-emerald-600">{t('auth.nicknameAvailable', '사용 가능한 닉네임입니다.')}</p>
                    ) : null}
                    {nicknameCheck === 'taken' ? (
                      <p className="text-sm font-medium text-rose-600">{t('auth.nicknameTaken', '이미 사용 중인 닉네임입니다.')}</p>
                    ) : null}
                  </>
                ) : null}

                <button
                  type="button"
                  disabled={submitDisabled || isAuthPending || findingLoginId || resettingPassword}
                  onClick={() => void handleLocalSubmit()}
                  className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-900"
                >
                  {isAuthPending || findingLoginId || resettingPassword
                    ? t('auth.processing', '처리 중...')
                    : localMode === 'login'
                      ? t('auth.localLoginAction', '로그인')
                      : localMode === 'register'
                        ? t('auth.localRegisterAction', '회원가입')
                        : localMode === 'findId'
                          ? t('auth.findIdAction', '아이디 찾기')
                          : t('auth.resetPasswordAction', '비밀번호 찾기')}
                </button>

                {localMode === 'login' ? (
                  <div className="flex items-center justify-between pt-1 text-sm text-gray-500 dark:text-gray-400">
                    <button type="button" onClick={() => setLocalMode('findId')} className="hover:text-gray-900 dark:hover:text-white">
                      {t('auth.findId')}
                    </button>
                    <button type="button" onClick={() => setLocalMode('resetPassword')} className="hover:text-gray-900 dark:hover:text-white">
                      {t('auth.resetPassword')}
                    </button>
                  </div>
                ) : null}

                {localMode === 'register' ? (
                  <div className="flex items-center justify-between pt-1 text-sm text-gray-500 dark:text-gray-400">
                    <button type="button" onClick={() => setLocalMode('findId')} className="hover:text-gray-900 dark:hover:text-white">
                      {t('auth.findId')}
                    </button>
                    <button type="button" onClick={() => setLocalMode('resetPassword')} className="hover:text-gray-900 dark:hover:text-white">
                      {t('auth.resetPassword')}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {authPanel === 'social' ? (
            <div className="space-y-3">
              <button type="button" onClick={() => setAuthPanel('entry')} className="inline-flex items-center gap-2 self-start rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                <span aria-hidden="true">←</span>
                {t('auth.entryBack')}
              </button>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">{t('auth.socialDescription')}</p>
              <button type="button" onClick={() => handleOAuthLogin('kakao')} disabled={isAuthPending} className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#FEE500] px-4 py-3 font-medium text-[#3C1E1E] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                <span className="flex h-8 w-8 items-center justify-center rounded-full">
                  <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-[#191919]" aria-hidden="true">
                    <path d="M12 4C7.03 4 3 7.13 3 11c0 2.5 1.67 4.68 4.18 5.92L6.3 20.6a.6.6 0 0 0 .88.66l4.28-2.69c.18.01.36.03.54.03 4.97 0 9-3.13 9-7s-4.03-7-9-7Z" />
                  </svg>
                </span>
                <span>{isLoading === 'kakao' ? t('auth.loading', '로딩 중...') : t('auth.kakaoLogin', '카카오로 계속하기')}</span>
              </button>
              <button type="button" onClick={() => handleOAuthLogin('google')} disabled={isAuthPending} className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 font-medium text-gray-900 dark:text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white ring-1 ring-gray-200 dark:ring-gray-600">
                  <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden="true">
                    <path fill="#EA4335" d="M12 10.2v3.92h5.45c-.24 1.26-.97 2.33-2.05 3.05l3.32 2.57c1.94-1.79 3.05-4.43 3.05-7.57 0-.72-.07-1.42-.2-2.1H12Z" />
                    <path fill="#34A853" d="M12 21c2.76 0 5.08-.91 6.77-2.46l-3.32-2.57c-.92.62-2.1.98-3.45.98-2.65 0-4.89-1.79-5.69-4.19l-3.43 2.65A10.23 10.23 0 0 0 12 21Z" />
                    <path fill="#4A90E2" d="M6.31 12.76A6.13 6.13 0 0 1 6 10.8c0-.68.12-1.34.31-1.96L2.88 6.19A10.23 10.23 0 0 0 1.8 10.8c0 1.65.4 3.21 1.08 4.61l3.43-2.65Z" />
                    <path fill="#FBBC05" d="M12 4.66c1.5 0 2.85.52 3.92 1.53l2.94-2.94C17.07 1.64 14.76.6 12 .6 7.98.6 4.5 2.9 2.88 6.19l3.43 2.65c.8-2.4 3.04-4.18 5.69-4.18Z" />
                  </svg>
                </span>
                <span>{isLoading === 'google' ? t('auth.loading', '로딩 중...') : t('auth.googleLogin', '구글로 계속하기')}</span>
              </button>
              <button type="button" onClick={() => handleOAuthLogin('apple')} disabled={isAuthPending} className="flex w-full items-center justify-center gap-3 rounded-xl bg-black px-4 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                <span className="flex h-8 w-8 items-center justify-center rounded-full">
                  <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-white" aria-hidden="true">
                    <path d="M16.37 12.54c.02 2.21 1.94 2.95 1.96 2.96-.02.05-.31 1.08-1.03 2.15-.62.92-1.27 1.84-2.29 1.86-1 .02-1.32-.59-2.46-.59-1.14 0-1.5.57-2.44.61-1 .04-1.76-1-2.39-1.92-1.29-1.86-2.28-5.25-.95-7.58.66-1.16 1.84-1.9 3.12-1.92.98-.02 1.9.66 2.46.66.56 0 1.62-.81 2.73-.69.47.02 1.78.19 2.62 1.42-.07.04-1.56.91-1.53 3.04ZM14.73 5.55c.52-.63.88-1.5.78-2.37-.75.03-1.66.5-2.2 1.13-.49.57-.92 1.45-.81 2.3.84.06 1.71-.43 2.23-1.06Z" />
                  </svg>
                </span>
                <span>{isLoading === 'apple' ? t('auth.loading', '로딩 중...') : t('auth.appleLogin', 'Apple로 계속하기')}</span>
              </button>
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {theme === 'dark' ? t('theme.light', '라이트') : t('theme.dark', '다크')}
            </button>
          </div>
        </div>
      </div>
      {isAuthPending ? (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/45">
          <div className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/95 px-4 py-3 text-sm font-medium text-gray-800 shadow-xl dark:border-white/10 dark:bg-gray-900/95 dark:text-gray-100">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 dark:border-gray-600 dark:border-t-blue-400" />
            <span>{t('auth.processing', '처리 중...')}</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
