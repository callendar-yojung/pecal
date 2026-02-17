import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWorkspaceStore, useViewStore } from '../../stores'
import { taskApi } from '../../api'
import type { Task } from '../../types'
import { getErrorMessage } from '../../utils/error'

const PAGE_SIZE = 15

const STATUS_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  todo: {
    dot: 'bg-gray-400',
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    label: 'status.todo',
  },
  in_progress: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    label: 'status.inProgress',
  },
  done: {
    dot: 'bg-green-500',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    label: 'status.done',
  },
}

type SortOrder = 'DESC' | 'ASC'

export function TaskListView() {
  const { t } = useTranslation()
  const { selectedWorkspaceId } = useWorkspaceStore()
  const { openTaskDetail } = useViewStore()

  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchTasks = useCallback(async () => {
    if (!selectedWorkspaceId) {
      setTasks([])
      setTotal(0)
      setTotalPages(1)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await taskApi.getTasksPaginated({
        workspace_id: selectedWorkspaceId,
        page,
        limit: PAGE_SIZE,
        sort_by: 'created_at',
        sort_order: sortOrder,
        search: search || undefined,
      })
      setTasks(res.tasks || [])
      setTotal(res.total || 0)
      setTotalPages(res.totalPages || 1)
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
      setError(getErrorMessage(err, t('common.error')))
      setTasks([])
    } finally {
      setIsLoading(false)
    }
  }, [selectedWorkspaceId, page, sortOrder, search, t])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // Reset page when search or sort changes
  useEffect(() => {
    setPage(1)
  }, [search, sortOrder, selectedWorkspaceId])

  // Debounced search
  const handleSearchInput = (value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(value)
    }, 400)
  }

  if (!selectedWorkspaceId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">{t('workspace.select')}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          {t('sidebar.tasks')}
          <span className="ml-2 text-sm font-normal text-gray-400">({total})</span>
        </h2>
      </div>

      {/* Search & Sort bar */}
      <div className="flex items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder={t('task.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(''); setSearch('') }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Sort */}
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as SortOrder)}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="DESC">{t('task.sortNewest')}</option>
          <option value="ASC">{t('task.sortOldest')}</option>
        </select>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 text-red-400">
            <p className="text-sm">{error}</p>
            <button
              onClick={fetchTasks}
              className="mt-3 px-4 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {t('task.retry')}
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">{search ? t('task.noSearchResults') : t('sidebar.noTasks')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2 px-3">
                  {t('event.title')}
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2 px-3 w-28">
                  {t('event.status')}
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2 px-3 w-40">
                  {t('event.startTime')}
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2 px-3 w-40">
                  {t('event.endTime')}
                </th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const statusKey = (task.status || 'todo').toLowerCase()
                const style = STATUS_STYLES[statusKey] || STATUS_STYLES.todo
                return (
                  <tr
                    key={task.id}
                    onClick={() => openTaskDetail(task)}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
                        <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                          {task.title}
                        </span>
                        {task.color && (
                          <div
                            className="w-3 h-3 rounded flex-shrink-0"
                            style={{ backgroundColor: task.color }}
                          />
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${style.badge}`}>
                        {t(style.label)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-500 dark:text-gray-400">
                      {formatDateTime(task.start_time)}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-500 dark:text-gray-400">
                      {formatDateTime(task.end_time)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[60px] text-center">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
