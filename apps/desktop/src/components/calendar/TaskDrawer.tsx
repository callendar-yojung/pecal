import { useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { format, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useCalendarStore, useViewStore } from '../../stores'
import type { TaskStatus } from '../../types'
import { parseApiDateTime } from '../../utils/datetime'

interface TaskDrawerProps {
  isOpen: boolean
  onClose: () => void
}

const statusConfig: Record<
  string,
  { labelKey: string; bg: string; text: string }
> = {
  todo: {
    labelKey: 'status.todo',
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-600 dark:text-gray-300',
  },
  in_progress: {
    labelKey: 'status.inProgress',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
  },
  done: {
    labelKey: 'status.done',
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-300',
  },
}

export function TaskDrawer({ isOpen, onClose }: TaskDrawerProps) {
  const { t, i18n } = useTranslation()
  const { selectedDate, events } = useCalendarStore()
  const { openTaskDetail } = useViewStore()
  const drawerRef = useRef<HTMLDivElement>(null)

  const tasksForDate = useMemo(() => {
    return events
      .filter((event) => isSameDay(parseApiDateTime(event.start_time), selectedDate))
      .sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
      )
  }, [events, selectedDate])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const formatTime = (dateStr: string) => format(parseApiDateTime(dateStr), 'h:mm a')

  const dateHeader =
    i18n.language === 'ko'
      ? format(selectedDate, 'yyyy년 M월 d일 (EEEE)', { locale: ko })
      : format(selectedDate, 'MMMM d, yyyy')

  return (
    <>
      {/* Backdrop - click to close, doesn't block calendar */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 z-40 h-full w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {dateHeader}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {tasksForDate.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
              {t('drawer.noTasks')}
            </p>
          ) : (
            tasksForDate.map((task) => {
              const status = (task.status || 'todo') as TaskStatus
              const config = statusConfig[status] || statusConfig.todo

              return (
                <button
                  key={task.id}
                  onClick={() => {
                    openTaskDetail(task)
                    onClose()
                  }}
                  className="w-full text-left p-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {task.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatTime(task.start_time)} – {formatTime(task.end_time)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${config.bg} ${config.text}`}
                    >
                      {t(config.labelKey)}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
