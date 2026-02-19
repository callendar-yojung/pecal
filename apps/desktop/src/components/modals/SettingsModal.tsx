import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import { useModalStore, useAuthStore, useThemeStore, useWorkspaceStore } from '../../stores'
import { authApi, fileApi, usageApi, subscriptionApi } from '../../api'
import { SettingsBillingTab } from './SettingsBillingTab'
import type {
  UsageData,
  Subscription,
  SubscriptionStatus,
} from '../../types'

type SettingsTab = 'profile' | 'system' | 'billing' | 'planUsage'
interface UserPreferences {
  theme: string
  language: string
  timezone: string
  notifications_enabled: boolean
}

export function SettingsModal() {
  const { t } = useTranslation()
  const { openedModal, closeModal } = useModalStore()
  const [tab, setTab] = useState<SettingsTab>('profile')

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    if (openedModal === 'SETTINGS') {
      document.addEventListener('keydown', handleEscape)
    }
    return () => document.removeEventListener('keydown', handleEscape)
  }, [openedModal, closeModal])

  if (openedModal !== 'SETTINGS') return null

  const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      key: 'profile',
      label: t('settings.profile'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      key: 'system',
      label: t('settings.system'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      key: 'billing',
      label: t('settings.billing'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 10h18M7 15h1m4 0h1m8-7H3m18 12H3a2 2 0 01-2-2V8a2 2 0 012-2h18a2 2 0 012 2v8a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      key: 'planUsage',
      label: t('settings.planUsage'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 flex overflow-hidden" style={{ height: '460px' }}>
        {/* 왼쪽 사이드바 */}
        <div className="w-44 shrink-0 bg-gray-50 dark:bg-gray-900/60 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="px-4 py-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {t('settings.title')}
            </h2>
          </div>
          <nav className="flex-1 px-2 space-y-0.5">
            {tabs.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors whitespace-nowrap ${
                  tab === item.key
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* 오른쪽 컨텐츠 */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {tabs.find((t) => t.key === tab)?.label}
            </h3>
            <button
              onClick={closeModal}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {tab === 'profile' ? (
              <ProfileTab />
            ) : tab === 'system' ? (
              <SystemTab />
            ) : tab === 'billing' ? (
              <SettingsBillingTab />
            ) : (
              <PlanUsageTab />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 프로필 탭 ──────────────────────────────────────────────────

function ProfileTab() {
  const { t } = useTranslation()
  const { user, updateUser, logout } = useAuthStore()
  const { closeModal } = useModalStore()

  const [nickname, setNickname] = useState(user?.nickname || '')
  const [isSaving, setIsSaving] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<'idle' | 'ok' | 'taken'>('idle')
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(user?.profileImageUrl || null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemovingImage, setIsRemovingImage] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!user) return null

  const handleSaveNickname = async () => {
    const trimmed = nickname.trim()
    if (!trimmed || trimmed === user.nickname) {
      setNickname(user.nickname)
      return
    }
    setIsSaving(true)
    try {
      await authApi.updateAccount({ nickname: trimmed })
      updateUser({ nickname: trimmed })
      setCheckResult('idle')
    } catch (err) {
      console.error('Failed to update nickname:', err)
      setNickname(user.nickname)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCheckNickname = async () => {
    const trimmed = nickname.trim()
    if (!trimmed) return
    setIsChecking(true)
    setCheckResult('idle')
    try {
      const response = await authApi.checkNickname(trimmed)
      setCheckResult(response.available ? 'ok' : 'taken')
    } catch (err) {
      console.error('Failed to check nickname:', err)
      setCheckResult('idle')
    } finally {
      setIsChecking(false)
    }
  }

  const handleNicknameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSaveNickname()
  }

  const handleUploadProfileImage = async (file: File) => {
    if (!user?.memberId) return
    setIsUploading(true)
    try {
      const uploadRes = await fileApi.uploadFile(file, 'personal', user.memberId)
      const nextUrl = uploadRes.file.file_path
      await authApi.updateAccount({ profile_image_url: nextUrl })
      setProfileImageUrl(nextUrl)
      updateUser({ profileImageUrl: nextUrl })
    } catch (err) {
      console.error('Failed to upload profile image:', err)
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveProfileImage = async () => {
    setIsRemovingImage(true)
    try {
      await authApi.updateAccount({ profile_image_url: null })
      setProfileImageUrl(null)
      updateUser({ profileImageUrl: null })
    } catch (err) {
      console.error('Failed to remove profile image:', err)
    } finally {
      setIsRemovingImage(false)
    }
  }

  const handleLogout = () => {
    closeModal()
    logout()
  }

  return (
    <div className="space-y-5">
      {/* 아바타 + 닉네임 */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center text-white text-xl font-bold shrink-0 overflow-hidden">
          {profileImageUrl ? (
            <img src={profileImageUrl} alt={nickname || 'User'} className="w-full h-full object-cover" />
          ) : (
            (nickname || user.nickname)?.charAt(0) || 'U'
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <input
              ref={inputRef}
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value)
                setCheckResult('idle')
              }}
              onKeyDown={handleNicknameKeyDown}
              disabled={isSaving}
              className="min-w-0 flex-1 px-2 py-1 text-sm border border-blue-400 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              onClick={handleCheckNickname}
              disabled={isChecking || !nickname.trim()}
              className="shrink-0 whitespace-nowrap px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {isChecking ? '...' : t('settings.checkNickname')}
            </button>
          </div>
          {checkResult === 'ok' && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">{t('settings.nicknameAvailable')}</p>
          )}
          {checkResult === 'taken' && (
            <p className="text-xs text-red-500 mt-1">{t('settings.nicknameTaken')}</p>
          )}
          {user.email && (
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {user.email}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <label className="whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
          {isUploading ? t('settings.uploadingImage') : t('settings.uploadImage')}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={isUploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleUploadProfileImage(file)
            }}
          />
        </label>
        {profileImageUrl && (
          <button
            onClick={handleRemoveProfileImage}
            disabled={isRemovingImage}
            className="whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {isRemovingImage ? '...' : t('settings.removeImage')}
          </button>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSaveNickname}
          disabled={isSaving || !nickname.trim()}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? '...' : t('event.save')}
        </button>
      </div>

      {/* 계정 정보 */}
      <div className="space-y-2 pt-2">
        <InfoRow label={t('settings.provider')} value={user.provider} />
        <InfoRow label={t('settings.memberId')} value={`#${user.memberId}`} />
      </div>

      {/* 로그아웃 */}
      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {t('auth.logout')}
        </button>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
      <span className="max-w-[65%] break-words text-right text-xs text-gray-600 dark:text-gray-300">{value}</span>
    </div>
  )
}

// ── 시스템 설정 탭 ──────────────────────────────────────────────

function SystemTab() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useThemeStore()
  const [autostart, setAutostart] = useState(false)
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)

  useEffect(() => {
    invoke<boolean>('get_autostart')
      .then(setAutostart)
      .catch(console.error)

    invoke<UserPreferences>('get_user_preferences')
      .then(setPreferences)
      .catch(console.error)
  }, [])

  const toggleAutostart = async () => {
    try {
      const result = await invoke<boolean>('set_autostart', { enabled: !autostart })
      setAutostart(result)
    } catch (err) {
      console.error('Failed to toggle autostart:', err)
    }
  }

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'ko' ? 'en' : 'ko')
  }

  const toggleNotifications = async () => {
    if (!preferences) return
    const next = {
      ...preferences,
      notifications_enabled: !preferences.notifications_enabled,
    }

    try {
      const saved = await invoke<UserPreferences>('save_user_preferences', { preferences: next })
      setPreferences(saved)
      await invoke('set_alarm_notifications_enabled', { enabled: saved.notifications_enabled })
    } catch (error) {
      console.error('Failed to update notification preference:', error)
    }
  }

  return (
    <div className="space-y-1">
      <SettingRow
        icon={
          theme === 'light' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : theme === 'dark' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 21s-7-4.35-7-10a4 4 0 017-2.65A4 4 0 0119 11c0 5.65-7 10-7 10z" />
            </svg>
          )
        }
        label={t('settings.theme')}
        action={
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'pink')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <option value="light">{t('theme.light')}</option>
            <option value="dark">{t('theme.dark')}</option>
            <option value="pink">{t('theme.pink')}</option>
          </select>
        }
      />

      <SettingRow
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
        }
        label={t('settings.language')}
        action={
          <button
            onClick={toggleLanguage}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {i18n.language === 'ko' ? 'English' : '한국어'}
          </button>
        }
      />

      <SettingRow
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        }
        label={t('autostart.label')}
        action={
          <button
            onClick={toggleAutostart}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              autostart ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                autostart ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        }
      />

      <SettingRow
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        }
        label={t('settings.notifications')}
        action={
          <button
            onClick={toggleNotifications}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              preferences?.notifications_enabled
                ? 'bg-blue-500'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                preferences?.notifications_enabled
                  ? 'translate-x-5'
                  : 'translate-x-0.5'
              }`}
            />
          </button>
        }
      />

    </div>
  )
}

function SettingRow({
  icon,
  label,
  action,
}: {
  icon: React.ReactNode
  label: string
  action: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-3 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
      <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
        <span className="text-gray-400 dark:text-gray-500">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      {action}
    </div>
  )
}

// ── Plan & Usage 탭 ─────────────────────────────────────────────

function formatBytes(bytes: number): string {
  const normalized = Number(bytes)
  if (!Number.isFinite(normalized) || normalized <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(normalized) / Math.log(k))
  return parseFloat((normalized / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function getBarColor(ratio: number): string {
  if (ratio >= 0.9) return 'bg-red-500'
  if (ratio >= 0.7) return 'bg-yellow-500'
  return 'bg-green-500'
}

function getStatusStyle(status: SubscriptionStatus | null): { bg: string; text: string } {
  switch (status) {
    case 'active': return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' }
    case 'trialing': return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' }
    case 'canceled': return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' }
    case 'expired': return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' }
    default: return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300' }
  }
}

function getStatusLabel(status: SubscriptionStatus | null, t: (key: string) => string): string {
  switch (status) {
    case 'active': return t('settings.plan.active')
    case 'trialing': return t('settings.plan.trialing')
    case 'canceled': return t('settings.plan.canceled')
    case 'expired': return t('settings.plan.expired')
    default: return t('settings.plan.noPlan')
  }
}

function PlanBadge({ planName, subscription, workspaceName }: {
  planName: string
  subscription: Subscription | null
  workspaceName: string
}) {
  const { t } = useTranslation()
  const isBasic = !subscription || subscription.status === 'expired' || subscription.status === 'canceled'
  const displayPlan = isBasic ? t('settings.plan.basic') : planName
  const statusStyle = getStatusStyle(subscription?.status ?? null)

  return (
    <div className={`p-3 rounded-lg border ${
      isBasic
        ? 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600'
        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
    }`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.plan.current')}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className={`text-sm font-semibold ${
              isBasic ? 'text-gray-700 dark:text-gray-200' : 'text-blue-700 dark:text-blue-300'
            }`}>{displayPlan}</p>
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
              {getStatusLabel(subscription?.status ?? null, t)}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.plan.workspace')}</p>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[120px]">{workspaceName}</p>
        </div>
      </div>
      {subscription && subscription.status === 'active' && subscription.expires_at && (
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
          <InfoRow
            label={t('settings.plan.expiresAt')}
            value={new Date(subscription.expires_at).toLocaleDateString()}
          />
        </div>
      )}
    </div>
  )
}

function UsageSection({ label, used, limit, detail, formatFn }: {
  label: string
  used: number
  limit: number
  detail?: string
  formatFn?: (v: number) => string
}) {
  const ratio = limit > 0 ? used / limit : 0
  const fmt = formatFn || String
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {fmt(used)} / {fmt(limit)}
          {detail && <span className="ml-1.5 text-gray-400 dark:text-gray-500">({detail})</span>}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getBarColor(ratio)}`}
          style={{ width: `${Math.min(ratio * 100, 100)}%` }}
        />
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="flex flex-col items-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700/40">
      <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</span>
      <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight text-center">{label}</span>
      {sub && <span className="text-[9px] text-gray-400 dark:text-gray-500">{sub}</span>}
    </div>
  )
}

function PlanUsageTab() {
  const { t } = useTranslation()
  const { selectedWorkspaceId, currentMode } = useWorkspaceStore()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedWorkspaceId) return
    setLoading(true)
    setError(null)

    const fetchUsage = usageApi.getUsage(selectedWorkspaceId).then(setUsage)
    const fetchSub = subscriptionApi.getSubscription()
      .then((res) => setSubscription(res.subscription))
      .catch(() => setSubscription(null))

    Promise.all([fetchUsage, fetchSub])
      .catch(() => setError(t('common.error')))
      .finally(() => setLoading(false))
  }, [selectedWorkspaceId, t])

  if (!selectedWorkspaceId) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400 dark:text-gray-500">
        {t('settings.usage.noWorkspace')}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400 dark:text-gray-500">
        {t('common.loading')}
      </div>
    )
  }

  if (error || !usage) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-red-400">
        {error || t('common.error')}
      </div>
    )
  }

  const isTeam = currentMode === 'TEAM'
  const planName = subscription?.plan_name || usage.plan.plan_name

  return (
    <div className="space-y-4">
      <PlanBadge planName={planName} subscription={subscription} workspaceName={usage.workspace_name} />

      <UsageSection
        label={t('settings.usage.storage')}
        used={usage.storage.used_bytes}
        limit={usage.storage.limit_bytes}
        detail={t('settings.usage.files', { count: usage.storage.file_count })}
        formatFn={formatBytes}
      />

      {isTeam && (
        <UsageSection
          label={t('settings.usage.members')}
          used={usage.members.current}
          limit={usage.members.max}
        />
      )}

      {/* Task Activity */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('settings.usage.tasks')}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {t('settings.usage.totalTasks', { count: usage.tasks.total })}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <StatCard label={t('settings.usage.created')} value={usage.tasks.created_this_month} sub={t('settings.usage.thisMonth')} />
          <StatCard label={t('settings.usage.completed')} value={usage.tasks.completed_this_month} sub={t('settings.usage.thisMonth')} />
          <StatCard label={t('settings.usage.todo')} value={usage.tasks.todo} />
          <StatCard label={t('settings.usage.inProgress')} value={usage.tasks.in_progress} />
        </div>
      </div>

      <InfoRow label={t('settings.plan.maxFileSize')} value={formatBytes(usage.plan.max_file_size_bytes)} />
    </div>
  )
}
