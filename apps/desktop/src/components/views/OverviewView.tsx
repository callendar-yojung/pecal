import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { taskApi } from '../../api'
import { useAuthStore, useViewStore, useWorkspaceStore } from '../../stores'
import type { Task } from '../../types'
import { emitTaskStatusChanged, onTaskStatusChanged } from '../../lib/taskStatusSync'
import { dedupeTasksById, isRecurringTask } from '../../utils/taskRecurrence'

function normalizeStatus(status?: string): Task['status'] {
  const value = String(status ?? '').toLowerCase()
  if (value === 'done') return 'done'
  if (value === 'in_progress') return 'in_progress'
  return 'todo'
}

export function OverviewView() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { selectedWorkspaceId } = useWorkspaceStore()
  const { openTaskDetail } = useViewStore()

  const [isLoading, setIsLoading] = useState(false)
  const [recentTasks, setRecentTasks] = useState<Task[]>([])
  const [recurringTasks, setRecurringTasks] = useState<Task[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [todoCount, setTodoCount] = useState(0)
  const [inProgressCount, setInProgressCount] = useState(0)
  const [doneCount, setDoneCount] = useState(0)
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<number>>(new Set())

  const applyTaskStatusLocally = useCallback((taskId: number, prevStatus: Task['status'], nextStatus: Task['status']) => {
    if (prevStatus === nextStatus) return

    setRecentTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status: nextStatus } : task))
    )
    setRecurringTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status: nextStatus } : task))
    )

    if (prevStatus === 'done' && nextStatus !== 'done') {
      setDoneCount((v) => Math.max(0, v - 1))
      if (nextStatus === 'todo') setTodoCount((v) => v + 1)
      if (nextStatus === 'in_progress') setInProgressCount((v) => v + 1)
      return
    }

    if (prevStatus !== 'done' && nextStatus === 'done') {
      setDoneCount((v) => v + 1)
      if (prevStatus === 'todo') setTodoCount((v) => Math.max(0, v - 1))
      if (prevStatus === 'in_progress') setInProgressCount((v) => Math.max(0, v - 1))
      return
    }

    if (prevStatus === 'todo' && nextStatus === 'in_progress') {
      setTodoCount((v) => Math.max(0, v - 1))
      setInProgressCount((v) => v + 1)
      return
    }

    if (prevStatus === 'in_progress' && nextStatus === 'todo') {
      setInProgressCount((v) => Math.max(0, v - 1))
      setTodoCount((v) => v + 1)
    }
  }, [])

  const fetchOverview = useCallback(async () => {
    if (!selectedWorkspaceId) return
    setIsLoading(true)
    try {
      const [all, recent] = await Promise.all([
        taskApi.getTasks(selectedWorkspaceId),
        taskApi.getTasksPaginated({
          workspace_id: selectedWorkspaceId,
          page: 1,
          limit: 5,
          sort_by: 'created_at',
          sort_order: 'DESC',
        }),
      ])

      const tasks = all.tasks || []
      setTotalCount(tasks.length)
      setTodoCount(tasks.filter((task) => (task.status || 'todo') === 'todo').length)
      setInProgressCount(tasks.filter((task) => task.status === 'in_progress').length)
      setDoneCount(tasks.filter((task) => task.status === 'done').length)
      setRecentTasks((recent.tasks || []).filter((task) => !isRecurringTask(task)))
      setRecurringTasks(
        dedupeTasksById(tasks.filter((task) => isRecurringTask(task)))
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
          .slice(0, 8)
      )
    } catch (err) {
      console.error('Failed to load overview data:', err)
      setRecentTasks([])
      setRecurringTasks([])
    } finally {
      setIsLoading(false)
    }
  }, [selectedWorkspaceId])

  useEffect(() => {
    if (!selectedWorkspaceId) {
      setRecentTasks([])
      setRecurringTasks([])
      setTotalCount(0)
      setTodoCount(0)
      setInProgressCount(0)
      setDoneCount(0)
      return
    }
    void fetchOverview()
  }, [fetchOverview, selectedWorkspaceId])

  const handleToggleDone = useCallback(
    async (task: Task) => {
      if (!selectedWorkspaceId || pendingTaskIds.has(task.id)) return
      const prevStatus = normalizeStatus(task.status)
      const nextStatus = (prevStatus === 'done' ? 'todo' : 'done') as Task['status']
      applyTaskStatusLocally(task.id, prevStatus, nextStatus)
      emitTaskStatusChanged({
        taskId: task.id,
        prevStatus,
        nextStatus,
        source: 'overview',
      })
      setPendingTaskIds((prev) => {
        const next = new Set(prev)
        next.add(task.id)
        return next
      })
      try {
        await taskApi.updateTask({
          task_id: task.id,
          status: nextStatus === 'done' ? 'DONE' : 'TODO',
        })
      } catch (err) {
        console.error('Failed to toggle task status from overview:', err)
        applyTaskStatusLocally(task.id, nextStatus, prevStatus)
        emitTaskStatusChanged({
          taskId: task.id,
          prevStatus: nextStatus,
          nextStatus: prevStatus,
          source: 'overview',
        })
      } finally {
        setPendingTaskIds((prev) => {
          const next = new Set(prev)
          next.delete(task.id)
          return next
        })
      }
    },
    [applyTaskStatusLocally, selectedWorkspaceId, pendingTaskIds]
  )

  useEffect(() => {
    const off = onTaskStatusChanged(({ taskId, prevStatus, nextStatus, source }) => {
      if (source === 'overview') return
      applyTaskStatusLocally(taskId, prevStatus, nextStatus)
    })
    return off
  }, [applyTaskStatusLocally])

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      }),
    []
  )

  if (!selectedWorkspaceId) {
    return (
      <div className="flex flex-1 items-center justify-center bg-transparent">
        <p className="text-gray-500 dark:text-gray-400">{t('workspace.select')}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-transparent p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="app-hero-card p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('overview.welcome', { name: user?.nickname || 'User' })}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{todayLabel}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <StatCard label={t('overview.totalTasks')} value={totalCount} />
          <StatCard label={t('status.todo')} value={todoCount} />
          <StatCard label={t('status.inProgress')} value={inProgressCount} />
          <StatCard label={t('status.done')} value={doneCount} />
        </div>

        <div className="app-glass-card p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {t('overview.recentTasks')}
          </h2>
          {isLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
          ) : recentTasks.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('overview.noRecentTasks')}</p>
          ) : (
            <div className="space-y-2">
              {recentTasks.map((task) => {
                const isDone = normalizeStatus(task.status) === 'done'
                const isToggling = pendingTaskIds.has(task.id)
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700/30"
                  >
                    <button
                      type="button"
                      onClick={() => void handleToggleDone(task)}
                      disabled={isToggling}
                      className={`h-5 w-5 shrink-0 rounded border transition-colors ${
                        isDone
                          ? 'border-emerald-500 bg-emerald-500'
                          : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800'
                      } ${isToggling ? 'opacity-60 cursor-not-allowed' : 'hover:border-emerald-400'}`}
                      aria-label={isDone ? t('status.done') : t('status.todo')}
                    >
                      {isDone ? <span className="block text-center text-[11px] leading-4 text-white">✓</span> : null}
                    </button>

                    <button
                      type="button"
                      onClick={() => openTaskDetail(task)}
                      className="min-w-0 flex-1 text-left hover:bg-gray-100/80 dark:hover:bg-gray-700 rounded-md px-1 py-1 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-sm truncate ${
                            isDone
                              ? 'text-gray-500 dark:text-gray-400 line-through'
                              : 'text-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {task.title}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                          {formatDate(task.start_time)}
                        </span>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="app-glass-card p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">반복 일정</h2>
          {isLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
          ) : recurringTasks.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">예정된 반복 일정이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {recurringTasks.map((task) => {
                const isDone = normalizeStatus(task.status) === 'done'
                return (
                  <button
                    key={task.id}
                    onClick={() => openTaskDetail(task)}
                    className="w-full text-left rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm truncate ${
                          isDone ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        {task.title}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                        {formatDate(task.start_time)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="app-glass-card px-4 py-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
    </div>
  )
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}
