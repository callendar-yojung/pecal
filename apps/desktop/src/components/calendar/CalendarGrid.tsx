import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  addDays,
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
} from 'date-fns'
import { useCalendarStore, useViewStore } from '../../stores'
import type { Task } from '../../types'
import { parseApiDateTime } from '../../utils/datetime'

interface CalendarGridProps {
  onOpenMore?: (date: Date) => void
  onOpenTaskDetail?: (task: Task) => void
}

export function CalendarGrid({ onOpenMore, onOpenTaskDetail }: CalendarGridProps) {
  const MAX_VISIBLE_TASKS_PER_DAY = 5
  const MIN_VISIBLE_TASKS_PER_DAY = 1
  const EVENT_ROW_HEIGHT = 24
  const DAY_HEADER_HEIGHT = 36
  const DAY_CELL_PADDING = 16
  const { i18n } = useTranslation()
  const { selectedDate, events } = useCalendarStore()
  const { openTaskCreate, openTaskDetail } = useViewStore()
  const gridRef = useRef<HTMLDivElement>(null)
  const [visibleTaskLimit, setVisibleTaskLimit] = useState(MAX_VISIBLE_TASKS_PER_DAY)

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

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    if (!days.length) return map

    const visibleStart = days[0]
    const visibleEnd = days[days.length - 1]

    const toStartOfDay = (date: Date) => {
      const d = new Date(date)
      d.setHours(0, 0, 0, 0)
      return d
    }

    for (const event of events) {
      const eventStartRaw = parseApiDateTime(event.start_time)
      const eventEndRaw = parseApiDateTime(event.end_time || event.start_time)
      const eventStart = toStartOfDay(eventStartRaw)
      const eventEnd = toStartOfDay(eventEndRaw)
      const rangeStart = eventStart > visibleStart ? eventStart : visibleStart
      const rangeEnd = eventEnd < visibleEnd ? eventEnd : visibleEnd

      if (rangeStart > rangeEnd) continue

      for (let cursor = new Date(rangeStart); cursor <= rangeEnd; cursor = addDays(cursor, 1)) {
        const dateKey = format(cursor, 'yyyy-MM-dd')
        const existing = map.get(dateKey)
        if (existing) {
          existing.push(event)
        } else {
          map.set(dateKey, [event])
        }
      }
    }

    for (const [dateKey, list] of map.entries()) {
      map.set(
        dateKey,
        list.sort((a, b) => {
          return parseApiDateTime(a.start_time).getTime() - parseApiDateTime(b.start_time).getTime()
        }),
      )
    }

    return map
  }, [events, days])

  const getEventMarkerState = (event: Task, day: Date) => {
    const eventStart = format(parseApiDateTime(event.start_time), 'yyyy-MM-dd')
    const eventEnd = format(parseApiDateTime(event.end_time || event.start_time), 'yyyy-MM-dd')
    const cell = format(day, 'yyyy-MM-dd')
    const isStart = eventStart === cell
    const isEnd = eventEnd === cell
    const isSingle = isStart && isEnd
    return { isStart, isEnd, isSingle }
  }

  const markerLabel = (event: Task, day: Date) => {
    const state = getEventMarkerState(event, day)
    if (state.isSingle) return '•'
    if (state.isStart) return '↘'
    if (state.isEnd) return '↗'
    return '━'
  }

  const eventShapeClass = (event: Task, day: Date) => {
    const state = getEventMarkerState(event, day)
    if (state.isSingle) return 'rounded-full'
    if (state.isStart) return 'rounded-l-full rounded-r-md'
    if (state.isEnd) return 'rounded-r-full rounded-l-md'
    return 'rounded-md'
  }

  const getEventStyle = (event: Task) => {
    const color = event.color || '#93c5fd'
    return {
      backgroundColor: `${color}40`,
      borderColor: `${color}88`,
      color: getReadableTextColor(color),
    }
  }

  const getEventTitle = (event: Task, day: Date) => {
    return `${markerLabel(event, day)} ${event.title}`
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

  useEffect(() => {
    const element = gridRef.current
    if (!element) return

    const updateVisibleTaskLimit = () => {
      const gridHeight = element.clientHeight
      const gridWidth = element.clientWidth
      if (gridHeight <= 0 || gridWidth <= 0) return

      const cellHeight = gridHeight / 6
      const cellWidth = gridWidth / 7
      const availableHeight = cellHeight - DAY_HEADER_HEIGHT - DAY_CELL_PADDING
      const heightBasedLimit = Math.floor(availableHeight / EVENT_ROW_HEIGHT)
      const widthBasedCap =
        cellWidth < 90 ? 2 :
        cellWidth < 110 ? 3 :
        cellWidth < 130 ? 4 : 5
      const dynamicLimit = Math.min(heightBasedLimit, widthBasedCap)
      const next = Math.max(
        MIN_VISIBLE_TASKS_PER_DAY,
        Math.min(MAX_VISIBLE_TASKS_PER_DAY, dynamicLimit),
      )

      setVisibleTaskLimit((prev) => (prev === next ? prev : next))
    }

    updateVisibleTaskLimit()

    const observer = new ResizeObserver(() => {
      updateVisibleTaskLimit()
    })
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

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

      <div ref={gridRef} className="flex-1 grid grid-cols-7 grid-rows-6 gap-px bg-gray-200 dark:bg-gray-700">
        {days.map((day) => {
          const dayEvents = eventsByDate.get(format(day, 'yyyy-MM-dd')) ?? []
          const visibleEvents = dayEvents.slice(0, visibleTaskLimit)
          const hiddenCount = Math.max(0, dayEvents.length - visibleTaskLimit)
          const isCurrentMonth = isSameMonth(day, selectedDate)
          const dayOfWeek = day.getDay()

          return (
            <div
              key={day.toISOString()}
              onClick={() => isCurrentMonth && openTaskCreate(day)}
              className={`group min-h-[100px] p-2 transition-colors flex flex-col overflow-hidden ${
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

              <div className="space-y-1 overflow-y-auto flex-1 min-h-0">
                {visibleEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onOpenTaskDetail) {
                        void onOpenTaskDetail(event)
                        return
                      }
                      openTaskDetail(event)
                    }}
                    className={`w-full text-left px-2 py-1 text-xs truncate border transition-opacity hover:opacity-90 ${eventShapeClass(event, day)}`}
                    style={getEventStyle(event)}
                  >
                    {getEventTitle(event, day)}
                  </button>
                ))}
                {hiddenCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenMore?.(day)
                    }}
                    className="px-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 text-left"
                  >
                    +{hiddenCount} more
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
