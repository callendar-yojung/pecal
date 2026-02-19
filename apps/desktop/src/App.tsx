import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listen } from '@tauri-apps/api/event'
import { ask } from '@tauri-apps/plugin-dialog'
import { check } from '@tauri-apps/plugin-updater'
import { exit, relaunch } from '@tauri-apps/plugin-process'
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
  const hasCheckedUpdateRef = useRef(false)
  const [requiredUpdateVersion, setRequiredUpdateVersion] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateProgress, setUpdateProgress] = useState<number | null>(null)

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

  useEffect(() => {
    if (!isTauriApp()) return
    if (hasCheckedUpdateRef.current) return
    hasCheckedUpdateRef.current = true

    const runRequiredUpdate = async () => {
      try {
        const update = await check()
        if (!update) return

        setRequiredUpdateVersion(update.version)
        setUpdateError(null)
        setIsUpdating(true)
        setUpdateProgress(0)

        let downloadedBytes = 0
        let totalBytes = 0

        await update.downloadAndInstall((event) => {
          if (event.event === 'Started') {
            totalBytes = event.data.contentLength ?? 0
            setUpdateProgress(0)
          } else if (event.event === 'Progress') {
            downloadedBytes += event.data.chunkLength
            if (totalBytes > 0) {
              setUpdateProgress(Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)))
            }
          } else if (event.event === 'Finished') {
            setUpdateProgress(100)
          }
        })

        await relaunch()
      } catch (error) {
        console.error('Required update failed:', error)
        setUpdateError(error instanceof Error ? error.message : String(error))
        setIsUpdating(false)
      }
    }

    runRequiredUpdate()
  }, [])

  if (requiredUpdateVersion) {
    return (
      <div className="app-canvas flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
        <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white/90 p-6 shadow-xl dark:border-white/10 dark:bg-gray-900/80">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('update.requiredTitle')}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {t('update.requiredDescription', { version: requiredUpdateVersion })}
          </p>

          {isUpdating && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-blue-600 dark:text-blue-300">
                {t('update.downloading')}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${updateProgress ?? 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{updateProgress ?? 0}%</p>
            </div>
          )}

          {updateError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
              {t('update.failed')}: {updateError}
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-2">
            {updateError && (
              <button
                onClick={() => {
                  hasCheckedUpdateRef.current = false
                  setRequiredUpdateVersion(null)
                  setUpdateError(null)
                  setIsUpdating(false)
                  setUpdateProgress(null)
                }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {t('update.retry')}
              </button>
            )}
            <button
              onClick={() => exit(1)}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
            >
              {t('update.quit')}
            </button>
          </div>
        </div>
      </div>
    )
  }

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

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'pink')
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    }
    if (theme === 'pink') {
      document.documentElement.classList.add('pink')
    }
  }, [theme])

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

  return <AppContent />
}

export default App
