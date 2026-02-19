import { useMemo, useState } from 'react'
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
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  const goToPrevMonth = () => {
    setSelectedDate(subMonths(selectedDate, 1))
  }

  const goToNextMonth = () => {
    setSelectedDate(addMonths(selectedDate, 1))
  }

  const goToToday = () => {
    setSelectedDate(new Date())
    setIsPickerOpen(false)
  }

  const currentYear = selectedDate.getFullYear()
  const years = useMemo(() => {
    return Array.from({ length: 31 }, (_, idx) => currentYear - 15 + idx)
  }, [currentYear])
  const months =
    i18n.language === 'ko'
      ? ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const handleYearSelect = (year: number) => {
    const next = new Date(selectedDate)
    next.setFullYear(year)
    next.setDate(1)
    setSelectedDate(next)
  }

  const handleMonthSelect = (monthIndex: number) => {
    const next = new Date(selectedDate)
    next.setMonth(monthIndex)
    next.setDate(1)
    setSelectedDate(next)
    setIsPickerOpen(false)
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
        <div className="relative">
          <button
            onClick={() => setIsPickerOpen((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xl font-semibold text-gray-900 dark:text-white min-w-[180px] justify-center rounded-lg px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <span>{monthDisplay}</span>
            <svg
              className={`w-4 h-4 transition-transform ${isPickerOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isPickerOpen && (
            <div className="absolute top-full left-1/2 mt-2 -translate-x-1/2 z-50 w-[320px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-3">
              <div className="mb-2 flex items-center justify-end">
                <button
                  onClick={() => setIsPickerOpen(false)}
                  className="rounded-md p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label="Close picker"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6l-12 12" />
                  </svg>
                </button>
              </div>
              <div className="mb-3">
                <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {i18n.language === 'ko' ? '연도' : 'Year'}
                </div>
                <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {years.map((year) => {
                    const isSelected = year === currentYear
                    return (
                      <button
                        key={year}
                        onClick={() => handleYearSelect(year)}
                        className={`rounded-md px-2 py-1 text-xs transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                      >
                        {year}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {i18n.language === 'ko' ? '월' : 'Month'}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {months.map((monthLabel, monthIndex) => {
                    const isSelected = monthIndex === selectedDate.getMonth()
                    return (
                      <button
                        key={monthLabel}
                        onClick={() => handleMonthSelect(monthIndex)}
                        className={`rounded-md px-2 py-1 text-xs transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                      >
                        {monthLabel}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
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
