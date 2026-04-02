import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format, addDays, addMonths, addWeeks, addYears, subDays, subMonths, subWeeks, subYears } from 'date-fns'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useCalendarStore, useViewStore } from '../../stores'
import { Button } from '../common'

interface CalendarHeaderProps {
  onToggleDrawer: () => void
  viewMode: 'day' | 'week' | 'month' | 'year' | 'table'
  onChangeViewMode: (mode: 'day' | 'week' | 'month' | 'year' | 'table') => void
}

export function CalendarHeader({ onToggleDrawer, viewMode, onChangeViewMode }: CalendarHeaderProps) {
  const { t, i18n } = useTranslation()
  const { selectedDate, setSelectedDate } = useCalendarStore()
  const { openTaskCreate } = useViewStore()
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  const goToPrev = () => {
    if (viewMode === 'day') {
      setSelectedDate(subDays(selectedDate, 1))
      return
    }
    if (viewMode === 'week' || viewMode === 'table') {
      setSelectedDate(subWeeks(selectedDate, 1))
      return
    }
    if (viewMode === 'year') {
      setSelectedDate(subYears(selectedDate, 1))
      return
    }
    setSelectedDate(subMonths(selectedDate, 1))
  }

  const goToNext = () => {
    if (viewMode === 'day') {
      setSelectedDate(addDays(selectedDate, 1))
      return
    }
    if (viewMode === 'week' || viewMode === 'table') {
      setSelectedDate(addWeeks(selectedDate, 1))
      return
    }
    if (viewMode === 'year') {
      setSelectedDate(addYears(selectedDate, 1))
      return
    }
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
    <div className="sticky top-0 z-20 mb-4 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-gray-700/70 dark:bg-gray-900/80">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            data-tauri-drag-region
            onMouseDown={(e) => {
              e.preventDefault()
              getCurrentWindow().startDragging()
            }}
            className="cursor-grab rounded-lg p-2 transition-colors hover:bg-slate-100 active:cursor-grabbing dark:hover:bg-gray-800"
            title="Drag to move"
          >
            <svg className="pointer-events-none h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </button>
          <button
            onClick={goToPrev}
            className="rounded-lg p-2 transition-colors hover:bg-slate-100 dark:hover:bg-gray-800"
          >
            <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="relative">
            <button
              onClick={() => setIsPickerOpen((prev) => !prev)}
              className="inline-flex min-w-[190px] items-center justify-center gap-1 rounded-lg px-3 py-1 text-xl font-extrabold tracking-tight text-slate-900 transition-colors hover:bg-slate-100 dark:text-white dark:hover:bg-gray-800"
            >
              <span>{monthDisplay}</span>
              <svg
                className={`h-4 w-4 transition-transform ${isPickerOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isPickerOpen && (
              <div className="absolute left-1/2 top-full z-50 mt-2 w-[320px] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900">
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
                  <div className="grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto pr-1">
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
            onClick={goToNext}
            className="rounded-lg p-2 transition-colors hover:bg-slate-100 dark:hover:bg-gray-800"
          >
            <svg className="h-5 w-5 text-slate-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={goToToday}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('calendar.today')}
          </button>
        </div>

        <div className="hidden items-center rounded-xl bg-slate-100 p-1 md:flex">
          {[
            { key: 'day', label: i18n.language === 'ko' ? '일' : 'Day' },
            { key: 'week', label: i18n.language === 'ko' ? '주' : 'Week' },
            { key: 'month', label: i18n.language === 'ko' ? '월' : 'Month' },
            { key: 'table', label: i18n.language === 'ko' ? '표' : 'Table' },
            { key: 'year', label: i18n.language === 'ko' ? '년' : 'Year' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => onChangeViewMode(item.key as 'day' | 'week' | 'month' | 'year' | 'table')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                viewMode === item.key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative hidden lg:block">
            <input
              type="text"
              placeholder={i18n.language === 'ko' ? '일정 찾기...' : 'Find event...'}
              className="h-9 w-56 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <Button variant="primary" size="sm" onClick={() => openTaskCreate(selectedDate)}>
            {t('calendar.add')}
          </Button>
          <button
            onClick={onToggleDrawer}
            className="rounded-lg p-2 transition-colors hover:bg-slate-100 dark:hover:bg-gray-800"
            title="Task summary"
          >
            <svg className="h-5 w-5 text-slate-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
