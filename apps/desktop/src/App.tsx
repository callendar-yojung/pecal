import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listen } from '@tauri-apps/api/event'
import { ask } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { Sidebar } from './components/sidebar'
import { Calendar } from './components/calendar'
import { TaskListView, FileListView, MemoView, TaskCreateView, TeamManageView, TaskExportView, OverviewView, TaskDetailView } from './components/views'
import { TitleBar } from './components/common'
import {
  EventEditModal,
  EventCreateModal,
  TeamCreateModal,
  SettingsModal,
  NotificationsModal,
  AlarmHistoryModal,
} from './components/modals'
import { LoginPage } from './components/auth'
import { useWorkspaces } from './hooks'
import { useThemeStore, useAuthStore, useViewStore } from './stores'
import { isTauriApp } from './utils/tauri'

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

      <EventEditModal />
      <EventCreateModal />
      <TeamCreateModal />
      <SettingsModal />
      <NotificationsModal />
      <AlarmHistoryModal />
    </div>
  )
}

function App() {
  const { theme } = useThemeStore()
  const { isAuthenticated, isLoading } = useAuthStore()
  const [showLoginSuccess, setShowLoginSuccess] = useState(false)

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
      {showLoginSuccess && (
        <div className="fixed top-4 right-4 z-[100] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-lg dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
          로그인 성공!
        </div>
      )}
    </>
  )
}

export default App
