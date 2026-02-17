import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import { CalendarHeader } from './CalendarHeader'
import { CalendarGrid } from './CalendarGrid'
import { TaskDrawer } from './TaskDrawer'
import { useWorkspaceStore, useCalendarStore } from '../../stores'
import { taskApi } from '../../api'
import { isTauriApp } from '../../utils/tauri'
import { parseApiDateTime } from '../../utils/datetime'
import { getErrorMessage } from '../../utils/error'

export function Calendar() {
  const { t } = useTranslation()
  const { selectedWorkspaceId } = useWorkspaceStore()
  const { setEvents, setLoading, setError, clearEvents, error } = useCalendarStore()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const toggleDrawer = useCallback(() => setIsDrawerOpen((prev) => !prev), [])
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), [])

  useEffect(() => {
    const fetchEvents = async () => {
      if (!selectedWorkspaceId) {
        clearEvents()
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await taskApi.getTasks(selectedWorkspaceId)
        setEvents(response.tasks)

        if (isTauriApp()) {
          if (response.tasks.length === 0) {
            await invoke('clear_workspace_task_alarms', { workspaceId: selectedWorkspaceId })
          } else {
            await invoke('sync_task_alarms', {
              alarms: response.tasks.map((task) => ({
                task_id: task.id,
                workspace_id: task.workspace_id,
                title: task.title,
                start_at_unix: Math.floor(parseApiDateTime(task.start_time).getTime() / 1000),
                reminder_minutes_before: 10,
                is_enabled: task.status !== 'done',
              })),
            })
          }
        }
      } catch (err) {
        const message = getErrorMessage(err, t('common.error'))
        console.error('Calendar fetch failed:', message)
        setError(message)
        clearEvents()
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [selectedWorkspaceId, setEvents, setLoading, setError, clearEvents, t])

  if (!selectedWorkspaceId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">
          {t('workspace.select')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 p-4">
      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-xs text-red-600 dark:text-red-300">
          {error}
        </div>
      )}
      <CalendarHeader onToggleDrawer={toggleDrawer} />
      <CalendarGrid />
      <TaskDrawer isOpen={isDrawerOpen} onClose={closeDrawer} />
    </div>
  )
}
