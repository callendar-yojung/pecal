import { useTranslation } from 'react-i18next'
import { format, addMonths, subMonths } from 'date-fns'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useCalendarStore, useViewStore } from '../../stores'
import { Button } from '../common'

interface CalendarHeaderProps {
  onToggleDrawer: () => void
}

export function CalendarHeader({ onToggleDrawer }: CalendarHeaderProps) {
  const { t, i18n } = useTranslation()
  const { selectedDate, setSelectedDate } = useCalendarStore()
  const { openTaskCreate } = useViewStore()

  const goToPrevMonth = () => {
    setSelectedDate(subMonths(selectedDate, 1))
  }

  const goToNextMonth = () => {
    setSelectedDate(addMonths(selectedDate, 1))
  }

  const goToToday = () => {
    setSelectedDate(new Date())
  }

  const monthDisplay =
    i18n.language === 'ko'
      ? t('calendar.month', {
          year: format(selectedDate, 'yyyy'),
          month: format(selectedDate, 'M'),
        })
      : format(selectedDate, 'MMMM yyyy')

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <button
          data-tauri-drag-region
          onMouseDown={(e) => {
            e.preventDefault()
            getCurrentWindow().startDragging()
          }}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-grab active:cursor-grabbing"
          title="Drag to move"
        >
          <svg
            className="w-5 h-5 text-gray-400 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8h16M4 16h16"
            />
          </svg>
        </button>
        <button
          onClick={goToPrevMonth}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <svg
            className="w-5 h-5 text-gray-600 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white min-w-[180px] text-center">
          {monthDisplay}
        </h2>
        <button
          onClick={goToNextMonth}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <svg
            className="w-5 h-5 text-gray-600 dark:text-gray-400"
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
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => openTaskCreate(selectedDate)}>
          {t('calendar.add')}
        </Button>
        <Button variant="secondary" size="sm" onClick={goToToday}>
          {t('calendar.today')}
        </Button>
        <button
          onClick={onToggleDrawer}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Task summary"
        >
          <svg
            className="w-5 h-5 text-gray-600 dark:text-gray-400"
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
    </div>
  )
}
