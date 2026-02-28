import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import { CalendarHeader } from './CalendarHeader'
import { CalendarGrid } from './CalendarGrid'
import { TaskDrawer } from './TaskDrawer'
import { useWorkspaceStore, useCalendarStore, useViewStore } from '../../stores'
import { calendarApi, taskApi } from '../../api'
import { isTauriApp } from '../../utils/tauri'
import { parseApiDateTime } from '../../utils/datetime'
import { getErrorMessage } from '../../utils/error'
import type { Task } from '../../types'

export function Calendar() {
  const { t } = useTranslation()
  const { selectedWorkspaceId } = useWorkspaceStore()
  const { openTaskDetail } = useViewStore()
  const { selectedDate, setEvents, setLoading, setError, clearEvents, setSelectedDate, error } = useCalendarStore()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const toggleDrawer = useCallback(() => setIsDrawerOpen((prev) => !prev), [])
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), [])
  const openDrawerForDate = useCallback(
    (date: Date) => {
      setSelectedDate(date)
      setIsDrawerOpen(true)
    },
    [setSelectedDate],
  )
  const openTaskDetailWithRefresh = useCallback(
    async (task: Task) => {
      try {
        const detail = await taskApi.getTaskById(task.id)
        openTaskDetail(detail ?? task)
      } catch {
        openTaskDetail(task)
      }
    },
    [openTaskDetail],
  )

  useEffect(() => {
    const fetchEvents = async () => {
      if (!selectedWorkspaceId) {
        clearEvents()
        return
      }

      setLoading(true)
      setError(null)

      try {
        const year = selectedDate.getFullYear()
        const month = selectedDate.getMonth() + 1
        const res = await calendarApi.getMonthlyTasks(selectedWorkspaceId, year, month)

        const byId = new Map<number, Task>()
        for (const row of res.tasksByDate ?? []) {
          for (const item of row.tasks ?? []) {
            if (byId.has(item.id)) continue
            byId.set(item.id, {
              id: item.id,
              title: item.title,
              start_time: item.start_time,
              end_time: item.end_time,
              color: item.color ?? '#93c5fd',
              status: 'todo',
              content: '',
              reminder_minutes: null,
              rrule: null,
              tag_ids: [],
              created_at: item.start_time,
              updated_at: item.end_time || item.start_time,
              created_by: 0,
              updated_by: 0,
              workspace_id: selectedWorkspaceId,
            })
          }
        }
        const allTasks = Array.from(byId.values()).sort(
          (a, b) => parseApiDateTime(a.start_time).getTime() - parseApiDateTime(b.start_time).getTime(),
        )

        setEvents(allTasks)

        if (isTauriApp()) {
          if (allTasks.length === 0) {
            await invoke('clear_workspace_task_alarms', { workspaceId: selectedWorkspaceId })
          } else {
            await invoke('sync_task_alarms', {
              alarms: allTasks.map((task) => ({
                task_id: task.id,
                workspace_id: task.workspace_id,
                title: task.title,
                start_at_unix: Math.floor(parseApiDateTime(task.start_time).getTime() / 1000),
                reminder_minutes_before: Math.max(0, Number(task.reminder_minutes ?? 10)),
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
  }, [selectedWorkspaceId, selectedDate, setEvents, setLoading, setError, clearEvents, t])

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
      <CalendarGrid onOpenMore={openDrawerForDate} onOpenTaskDetail={openTaskDetailWithRefresh} />
      <TaskDrawer isOpen={isDrawerOpen} onClose={closeDrawer} onOpenTaskDetail={openTaskDetailWithRefresh} />
    </div>
  )
}
