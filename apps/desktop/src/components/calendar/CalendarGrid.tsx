import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns'
import { useCalendarStore, useViewStore } from '../../stores'
import type { Task } from '../../types'
import { parseApiDateTime } from '../../utils/datetime'

export function CalendarGrid() {
  const { i18n } = useTranslation()
  const { selectedDate, events } = useCalendarStore()
  const { openTaskCreate, openTaskDetail } = useViewStore()

  const days = useMemo(() => {
    const monthStart = startOfMonth(selectedDate)
    const monthEnd = endOfMonth(monthStart)
    const calendarStart = startOfWeek(monthStart, {
      weekStartsOn: i18n.language === 'ko' ? 0 : 0,
    })
    const calendarEnd = endOfWeek(monthEnd, {
      weekStartsOn: i18n.language === 'ko' ? 0 : 0,
    })

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [selectedDate, i18n.language])

  const weekDays =
    i18n.language === 'ko'
      ? ['일', '월', '화', '수', '목', '금', '토']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const getEventsForDay = (day: Date): Task[] => {
    return events
      .filter((event) => {
        const eventDate = parseApiDateTime(event.start_time)
        return isSameDay(eventDate, day)
      })
      .sort((a, b) => {
        return new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      })
  }

  const getReadableTextColor = (hexColor?: string) => {
    if (!hexColor || !hexColor.startsWith('#')) return '#1f2937'
    const hex = hexColor.replace('#', '')
    const normalized = hex.length === 3
      ? hex.split('').map((c) => c + c).join('')
      : hex
    const r = parseInt(normalized.slice(0, 2), 16)
    const g = parseInt(normalized.slice(2, 4), 16)
    const b = parseInt(normalized.slice(4, 6), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.6 ? '#1f2937' : '#ffffff'
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700">
        {weekDays.map((day, index) => (
          <div
            key={day}
            className={`px-2 py-3 text-center text-sm font-medium bg-gray-50 dark:bg-gray-800 ${
              index === 0
                ? 'text-red-500'
                : index === 6
                  ? 'text-blue-500'
                  : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-7 grid-rows-6 gap-px bg-gray-200 dark:bg-gray-700">
        {days.map((day) => {
          const dayEvents = getEventsForDay(day)
          const isCurrentMonth = isSameMonth(day, selectedDate)
          const dayOfWeek = day.getDay()

          return (
            <div
              key={day.toISOString()}
              onClick={() => isCurrentMonth && openTaskCreate(day)}
              className={`group min-h-[100px] p-2 transition-colors ${
                isCurrentMonth
                  ? 'bg-white dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer'
                  : 'bg-white dark:bg-gray-900 opacity-40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                    isToday(day)
                      ? 'bg-blue-500 text-white'
                      : dayOfWeek === 0
                        ? 'text-red-500'
                        : dayOfWeek === 6
                          ? 'text-blue-500'
                          : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {format(day, 'd')}
                </span>
                {isCurrentMonth && (
                  <span className="w-5 h-5 flex items-center justify-center rounded-full text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </span>
                )}
              </div>

              <div className="space-y-1 overflow-y-auto max-h-[60px]">
                {dayEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      openTaskDetail(event)
                    }}
                    className="w-full text-left px-2 py-1 text-xs rounded truncate transition-opacity hover:opacity-90"
                    style={{
                      backgroundColor: event.color || '#93c5fd',
                      color: getReadableTextColor(event.color),
                    }}
                  >
                    {event.title}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
