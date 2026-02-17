import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { taskApi } from '../../api'
import { useAuthStore, useViewStore, useWorkspaceStore } from '../../stores'
import type { Task } from '../../types'

export function OverviewView() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { selectedWorkspaceId } = useWorkspaceStore()
  const { openTaskDetail } = useViewStore()

  const [isLoading, setIsLoading] = useState(false)
  const [recentTasks, setRecentTasks] = useState<Task[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [todoCount, setTodoCount] = useState(0)
  const [inProgressCount, setInProgressCount] = useState(0)
  const [doneCount, setDoneCount] = useState(0)

  useEffect(() => {
    if (!selectedWorkspaceId) {
      setRecentTasks([])
      setTotalCount(0)
      setTodoCount(0)
      setInProgressCount(0)
      setDoneCount(0)
      return
    }

    const fetchOverview = async () => {
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
        setRecentTasks(recent.tasks || [])
      } catch (err) {
        console.error('Failed to load overview data:', err)
        setRecentTasks([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchOverview()
  }, [selectedWorkspaceId])

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
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">{t('workspace.select')}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-gray-50 dark:bg-gray-900 p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
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

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {t('overview.recentTasks')}
          </h2>
          {isLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
          ) : recentTasks.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('overview.noRecentTasks')}</p>
          ) : (
            <div className="space-y-2">
              {recentTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => openTaskDetail(task)}
                  className="w-full text-left rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{task.title}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                      {formatDate(task.start_time)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
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
