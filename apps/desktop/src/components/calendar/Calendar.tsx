import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addDays, format, startOfWeek } from 'date-fns'
import { CalendarHeader } from './CalendarHeader'
import { CalendarGrid } from './CalendarGrid'
import { TaskDrawer } from './TaskDrawer'
import { CalendarTableView } from './CalendarTableView'
import { useWorkspaceStore, useCalendarStore, useViewStore } from '../../stores'
import { calendarApi, taskApi } from '../../api'
import { parseApiDateTime } from '../../utils/datetime'
import { getErrorMessage } from '../../utils/error'
import type { Task } from '../../types'

export function Calendar() {
  const { t } = useTranslation()
  const { selectedWorkspaceId } = useWorkspaceStore()
  const { openTaskDetail } = useViewStore()
  const { selectedDate, setSelectedDate, events, setEvents, setLoading, setError, clearEvents, error } = useCalendarStore()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'year' | 'table'>('month')

  const toggleDrawer = useCallback(() => setIsDrawerOpen((prev) => !prev), [])
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), [])
  const occursOnDate = useCallback((task: Task, date: Date) => {
    const start = parseApiDateTime(task.start_time)
    const end = parseApiDateTime(task.end_time || task.start_time)
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)
    return start <= dayEnd && end >= dayStart
  }, [])

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

  const dayTasks = events.filter((task) => occursOnDate(task, selectedDate))
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 })
  const weekDays = Array.from({ length: 7 }, (_, idx) => addDays(weekStart, idx))
  const weekTasksByDay = weekDays.map((day) => ({
    day,
    tasks: events.filter((task) => occursOnDate(task, day)),
  }))
  const year = selectedDate.getFullYear()
  const monthStats = Array.from({ length: 12 }, (_, month) => {
    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999)
    const count = events.filter((task) => {
      const start = parseApiDateTime(task.start_time)
      const end = parseApiDateTime(task.end_time || task.start_time)
      return start <= monthEnd && end >= monthStart
    }).length
    return { month, count }
  })

  const renderBody = () => {
    if (viewMode === 'month') {
      return <CalendarGrid onOpenTaskDetail={openTaskDetailWithRefresh} />
    }

    if (viewMode === 'day') {
      return (
        <div className="h-full overflow-y-auto p-4 space-y-2">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{format(selectedDate, 'yyyy-MM-dd')}</div>
          {dayTasks.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">{t('calendar.empty')}</div>
          ) : (
            dayTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => void openTaskDetailWithRefresh(task)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                {task.title}
              </button>
            ))
          )}
        </div>
      )
    }

    if (viewMode === 'week') {
      return (
        <div className="h-full overflow-y-auto p-4 grid grid-cols-7 gap-2">
          {weekTasksByDay.map(({ day, tasks }) => (
            <div key={day.toISOString()} className="rounded-xl border border-slate-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">{format(day, 'EEE d')}</div>
              <div className="space-y-1">
                {tasks.slice(0, 3).map((task) => (
                  <button
                    key={`${task.id}-${day.toISOString()}`}
                    onClick={() => void openTaskDetailWithRefresh(task)}
                    className="w-full h-6 truncate rounded-md border border-slate-200 px-2 text-left text-[11px] font-medium text-slate-700 dark:border-gray-700 dark:text-gray-200"
                  >
                    {task.title}
                  </button>
                ))}
                {tasks.length > 3 && (
                  <div className="text-[11px] font-semibold text-slate-400">+{tasks.length - 3} more</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (viewMode === 'table') {
      return <CalendarTableView selectedDate={selectedDate} events={events} onOpenTaskDetail={openTaskDetailWithRefresh} />
    }

    return (
      <div className="h-full overflow-y-auto p-4 grid grid-cols-4 gap-3">
        {monthStats.map(({ month, count }) => (
          <button
            key={month}
            onClick={() => {
              setSelectedDate(new Date(year, month, 1))
              setViewMode('month')
            }}
            className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
            <div className="text-sm font-bold text-slate-800 dark:text-gray-100">{format(new Date(year, month, 1), 'MMM')}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-gray-400">{count} tasks</div>
          </button>
        ))}
      </div>
    )
  }

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

        const byOccurrence = new Map<string, Task>()
        for (const row of res.tasksByDate ?? []) {
          for (const item of row.tasks ?? []) {
            const occurrenceKey = `${item.id}::${item.start_time}::${item.end_time || item.start_time}`
            if (byOccurrence.has(occurrenceKey)) continue
            byOccurrence.set(occurrenceKey, {
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
        const allTasks = Array.from(byOccurrence.values()).sort(
          (a, b) => parseApiDateTime(a.start_time).getTime() - parseApiDateTime(b.start_time).getTime(),
        )

        setEvents(allTasks)
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
    <div className="flex-1 flex flex-col bg-[#f8fafc] dark:bg-gray-950 p-4">
      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-xs text-red-600 dark:text-red-300">
          {error}
        </div>
      )}
      <CalendarHeader
        onToggleDrawer={toggleDrawer}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
      />
      <div className="flex-1 min-h-0 rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-gray-700/70 dark:bg-gray-900">
        {renderBody()}
      </div>
      <TaskDrawer isOpen={isDrawerOpen} onClose={closeDrawer} onOpenTaskDetail={openTaskDetailWithRefresh} />
    </div>
  )
}
