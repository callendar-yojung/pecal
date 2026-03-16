import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listen } from '@tauri-apps/api/event'
import { ask } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { Sidebar } from './components/sidebar'
import { Calendar } from './components/calendar'
import { TaskListView, FileListView, MemoView, TaskCreateView, TeamManageView, TaskExportView, OverviewView, TaskDetailView, TaskEditView } from './components/views'
import { TitleBar } from './components/common'
import {
  EventCreateModal,
  TeamCreateModal,
  SettingsModal,
  NotificationsModal,
  AlarmHistoryModal,
} from './components/modals'
import { LoginPage } from './components/auth'
import { useWorkspaces } from './hooks'
import { useThemeStore, useAuthStore, useViewStore } from './stores'
import { authApi } from './api'
import { isTauriApp } from './utils/tauri'
import { openExternal } from './lib/openExternal'

interface AlarmTriggeredPayload {
  alarm_id: string
  task_id: number
  workspace_id: number
  title: string
  message: string
  scheduled_start_at_unix: number
}

interface UserPreferences {
  theme: string
  language: string
  timezone: string
  notifications_enabled: boolean
}

interface AccountWithConsent {
  privacy_consent?: boolean
}

function MainContent() {
  const { activeView } = useViewStore()

  switch (activeView) {
    case 'overview':
      return <OverviewView />
    case 'tasks':
      return <TaskListView />
    case 'files':
      return <FileListView />
    case 'memo':
      return <MemoView />
    case 'task_create':
      return <TaskCreateView />
    case 'team_manage':
      return <TeamManageView />
    case 'task_export':
      return <TaskExportView />
    case 'task_detail':
      return <TaskDetailView />
    case 'task_edit':
      return <TaskEditView />
    default:
      return <Calendar />
  }
}

function AppContent() {
  const { t } = useTranslation()
  useWorkspaces()

  useEffect(() => {
    if (!isTauriApp()) return

    let unlisten: (() => void) | undefined

    const setup = async () => {
      try {
        const preferences = await invoke<UserPreferences>('get_user_preferences')
        await invoke('set_alarm_notifications_enabled', {
          enabled: preferences.notifications_enabled,
        })
      } catch (error) {
        console.error('Failed to sync alarm notification preference:', error)
      }

      try {
        unlisten = await listen<AlarmTriggeredPayload>('alarm://trigger', async (event) => {
          const payload = event.payload

          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(payload.title, { body: payload.message })
          } else if (
            typeof Notification !== 'undefined' &&
            Notification.permission !== 'denied'
          ) {
            Notification.requestPermission().then((permission) => {
              if (permission === 'granted') {
                new Notification(payload.title, { body: payload.message })
              }
            })
          }

          const snooze = await ask(
            `${payload.message}\n\n${t('alarm.snoozePrompt')}`,
            {
              title: t('alarm.title'),
              okLabel: t('alarm.snooze5m'),
              cancelLabel: t('alarm.dismiss'),
            }
          )

          if (snooze) {
            await invoke('snooze_alarm', { alarm_id: payload.alarm_id, minutes: 5 })
          } else {
            await invoke('dismiss_alarm', { alarm_id: payload.alarm_id })
          }
        })
      } catch (error) {
        console.error('Failed to register alarm listener:', error)
      }
    }

    setup()

    return () => {
      if (unlisten) unlisten()
    }
  }, [t])

  return (
    <div className="app-canvas flex h-screen flex-col overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-900">
      <TitleBar />
      <div className="flex flex-1 gap-3 overflow-hidden p-3 pt-0">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-black/5 bg-white/45 backdrop-blur-sm dark:border-white/10 dark:bg-gray-900/35">
          <MainContent />
        </main>
      </div>

      <EventCreateModal />
      <TeamCreateModal />
      <SettingsModal />
      <NotificationsModal />
      <AlarmHistoryModal />
    </div>
  )
}

function App() {
  const { t, i18n } = useTranslation()
  const { theme } = useThemeStore()
  const { isAuthenticated, isLoading, logout, accessToken } = useAuthStore()
  const [showLoginSuccess, setShowLoginSuccess] = useState(false)
  const [privacyConsentRequired, setPrivacyConsentRequired] = useState(false)
  const [consentLoading, setConsentLoading] = useState(true)

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'pink')
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    }
    if (theme === 'pink') {
      document.documentElement.classList.add('pink')
    }
  }, [theme])

  useEffect(() => {
    if (!isAuthenticated) return

    const flag = sessionStorage.getItem('pecal_login_success')
    if (flag !== '1') return

    sessionStorage.removeItem('pecal_login_success')
    setShowLoginSuccess(true)

    const id = window.setTimeout(() => {
      setShowLoginSuccess(false)
    }, 2200)

    return () => window.clearTimeout(id)
  }, [isAuthenticated])

  const checkPrivacyConsent = async () => {
    if (!isAuthenticated) {
      setPrivacyConsentRequired(false)
      setConsentLoading(false)
      return
    }
    setConsentLoading(true)
    try {
      const account = await authApi.getAccount() as AccountWithConsent
      setPrivacyConsentRequired(!account.privacy_consent)
    } catch (error) {
      console.error('Failed to check privacy consent:', error)
      setPrivacyConsentRequired(false)
    } finally {
      setConsentLoading(false)
    }
  }

  useEffect(() => {
    void checkPrivacyConsent()
  }, [isAuthenticated])

  useEffect(() => {
    if (!privacyConsentRequired) return
    const onFocus = () => { void checkPrivacyConsent() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [privacyConsentRequired, isAuthenticated])

  const openConsentPage = () => {
    const locale = i18n.language === 'ko' ? 'ko' : 'en'
    const callback = encodeURIComponent(`/${locale}/consent/desktop-complete`)
    const token = encodeURIComponent(accessToken ?? '')
    void openExternal(
      `https://pecal.site/${locale}/consent?token=${token}&callback=${callback}`,
    )
  }

  // Show loading spinner while checking auth (but not during OAuth callback)
  const urlParams = new URLSearchParams(window.location.search)
  const hasOAuthCode = urlParams.has('code')

  if (isLoading && !hasOAuthCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    )
  }

  // Show login page if not authenticated (handles OAuth callback too)
  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <>
      <AppContent />
      {!consentLoading && privacyConsentRequired && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {t('settings.privacyConsentRequiredTitle')}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {t('settings.privacyConsentRequiredDesc')}
            </p>
            <button
              type="button"
              onClick={openConsentPage}
              disabled={consentLoading}
              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-700 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200"
            >
              {t('settings.privacyConsentOpenPage')}
            </button>
            <button
              type="button"
              onClick={logout}
              disabled={consentLoading}
              className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-700 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200"
            >
              {t('auth.logout')}
            </button>
          </div>
        </div>
      )}
      {showLoginSuccess && (
        <div className="fixed top-4 right-4 z-[100] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-lg dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
          로그인 성공!
        </div>
      )}
    </>
  )
}

export default App
