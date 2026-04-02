import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { authApi, notificationsApi } from './api'
import { openExternal } from './lib/openExternal'

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
    let cancelled = false
    let timer: number | null = null
    const seenNotificationIds = new Set<number>()

    const showSystemNotification = (title: string, body: string) => {
      if (typeof Notification === 'undefined') return
      if (Notification.permission === 'granted') {
        new Notification(title, { body })
        return
      }
      if (Notification.permission !== 'denied') {
        void Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification(title, { body })
          }
        })
      }
    }

    const syncReminderNotifications = async (initial = false) => {
      try {
        const response = await notificationsApi.getNotifications(30)
        const items = Array.isArray(response.notifications)
          ? response.notifications
          : []
        const reminderItems = items.filter((item) => item.type === 'TASK_REMINDER')
        if (initial) {
          reminderItems.forEach((item) => {
            seenNotificationIds.add(item.notification_id)
          })
          return
        }
        reminderItems
          .slice()
          .reverse()
          .forEach((item) => {
            if (seenNotificationIds.has(item.notification_id)) return
            seenNotificationIds.add(item.notification_id)
            if (item.is_read === 1) return
            showSystemNotification(item.title || t('alarm.title'), item.message || '')
          })
      } catch (error) {
        console.error('Failed to sync task reminder notifications:', error)
      }
    }

    void syncReminderNotifications(true).then(() => {
      if (cancelled) return
      timer = window.setInterval(() => {
        void syncReminderNotifications(false)
      }, 15000)
    })

    return () => {
      cancelled = true
      if (timer) {
        window.clearInterval(timer)
      }
    }
  }, [t])

  return (
    <div className="app-canvas flex h-screen flex-col overflow-hidden bg-[#f8fafc] dark:bg-gray-950">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden p-4 pt-2 gap-4">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white/75 backdrop-blur-xl shadow-[0_12px_40px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-gray-900/60">
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
  const [consentFlowStarted, setConsentFlowStarted] = useState(false)
  const [consentCompletedOnWeb, setConsentCompletedOnWeb] = useState(false)

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

  const checkPrivacyConsent = useCallback(async () => {
    if (!isAuthenticated) {
      setPrivacyConsentRequired(false)
      setConsentLoading(false)
      setConsentCompletedOnWeb(false)
      return
    }
    setConsentLoading(true)
    try {
      const account = await authApi.getAccount() as AccountWithConsent
      const required = !account.privacy_consent
      setPrivacyConsentRequired(required)
      if (!required) {
        setConsentCompletedOnWeb(false)
        setConsentFlowStarted(false)
      }
    } catch (error) {
      console.error('Failed to check privacy consent:', error)
      setPrivacyConsentRequired(false)
    } finally {
      setConsentLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    void checkPrivacyConsent()
  }, [checkPrivacyConsent])

  useEffect(() => {
    if (!privacyConsentRequired) return
    const onFocus = () => { void checkPrivacyConsent() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [privacyConsentRequired, checkPrivacyConsent])

  useEffect(() => {
    if (!isAuthenticated || !privacyConsentRequired || !consentFlowStarted || consentCompletedOnWeb) return
    let cancelled = false
    const timer = window.setInterval(async () => {
      try {
        const account = await authApi.getAccount() as AccountWithConsent
        if (!cancelled && account.privacy_consent) {
          setConsentCompletedOnWeb(true)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to poll privacy consent:', error)
        }
      }
    }, 2000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [isAuthenticated, privacyConsentRequired, consentFlowStarted, consentCompletedOnWeb])

  const openConsentPage = () => {
    const locale = i18n.language === 'ko' ? 'ko' : 'en'
    const callback = encodeURIComponent(`/${locale}/consent/desktop-complete`)
    const token = encodeURIComponent(accessToken ?? '')
    setConsentFlowStarted(true)
    setConsentCompletedOnWeb(false)
    void openExternal(
      `https://pecal.site/${locale}/consent?token=${token}&callback=${callback}`,
    )
  }

  const finishConsentFlow = async () => {
    await checkPrivacyConsent()
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
            {consentCompletedOnWeb && (
              <button
                type="button"
                onClick={() => void finishConsentFlow()}
                disabled={consentLoading}
                className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {t('status.done')}
              </button>
            )}
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
