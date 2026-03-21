import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
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
  onOpenTaskDetail?: (task: Task) => void
}

export function CalendarGrid({ onOpenTaskDetail }: CalendarGridProps) {
  const MAX_VISIBLE_TASKS_PER_DAY = 3
  const MIN_VISIBLE_TASKS_PER_DAY = 1
  const EVENT_ROW_HEIGHT = 24
  const MULTI_EVENT_HEIGHT = 24
  const MULTI_EVENT_VERTICAL_GAP = 8
  const MULTI_EVENT_TOP_OFFSET = 38
  const DAY_HEADER_HEIGHT = 32
  const DAY_CELL_PADDING = 12
  const { i18n } = useTranslation()
  const { selectedDate, events } = useCalendarStore()
  const { openTaskCreate, openTaskDetail } = useViewStore()
  const gridRef = useRef<HTMLDivElement>(null)
  const morePopoverRef = useRef<HTMLDivElement | null>(null)
  const [visibleTaskLimit, setVisibleTaskLimit] = useState(MAX_VISIBLE_TASKS_PER_DAY)
  const [openMoreDateKey, setOpenMoreDateKey] = useState<string | null>(null)

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

  const toStartOfDay = (date: Date) => {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const singleDayEventsByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    if (!days.length) return map
    const visibleStart = days[0]
    const visibleEnd = days[days.length - 1]

    type SingleEntry = {
      key: string
      dayKey: string
    }
    const singleEntriesByGroup = new Map<string, SingleEntry[]>()
    for (const event of events) {
      const eventStart = toStartOfDay(parseApiDateTime(event.start_time))
      const eventEnd = toStartOfDay(parseApiDateTime(event.end_time || event.start_time))
      if (eventStart.getTime() !== eventEnd.getTime()) continue
      if (eventStart < visibleStart || eventStart > visibleEnd) continue
      const dayKey = format(eventStart, 'yyyy-MM-dd')
      const groupKey = `${event.id}::${event.title}::${event.color || ''}`
      const entry = { key: `${event.id}-${dayKey}`, dayKey }
      const existing = singleEntriesByGroup.get(groupKey)
      if (existing) {
        existing.push(entry)
      } else {
        singleEntriesByGroup.set(groupKey, [entry])
      }
    }

    const mergedSingleKeys = new Set<string>()
    const dayMs = 24 * 60 * 60 * 1000
    const keyToTime = (dayKey: string) => new Date(`${dayKey}T00:00:00`).getTime()

    for (const entries of singleEntriesByGroup.values()) {
      const sorted = entries
        .slice()
        .sort((a, b) => keyToTime(a.dayKey) - keyToTime(b.dayKey))

      let runStart = 0
      for (let i = 1; i <= sorted.length; i += 1) {
        const prev = sorted[i - 1]
        const curr = sorted[i]
        const isConsecutive = curr && keyToTime(curr.dayKey) - keyToTime(prev.dayKey) === dayMs
        if (isConsecutive) continue
        const run = sorted.slice(runStart, i)
        if (run.length >= 2) {
          for (const item of run) mergedSingleKeys.add(item.key)
        }
        runStart = i
      }
    }

    for (const event of events) {
      const eventStart = toStartOfDay(parseApiDateTime(event.start_time))
      const eventEnd = toStartOfDay(parseApiDateTime(event.end_time || event.start_time))
      if (eventStart.getTime() !== eventEnd.getTime()) continue
      const dateKey = format(eventStart, 'yyyy-MM-dd')
      if (mergedSingleKeys.has(`${event.id}-${dateKey}`)) continue
      const existing = map.get(dateKey)
      if (existing) {
        existing.push(event)
      } else {
        map.set(dateKey, [event])
      }
    }

    for (const [dateKey, list] of map.entries()) {
      map.set(
        dateKey,
        list.sort(
          (a, b) =>
            parseApiDateTime(a.start_time).getTime() - parseApiDateTime(b.start_time).getTime(),
        ),
      )
    }

    return map
  }, [events, days])

  const multiDaySegments = useMemo(() => {
    const segments: Array<{
      key: string
      event: Task
      row: number
      startCol: number
      endCol: number
      lane: number
      isStart: boolean
      isEnd: boolean
    }> = []
    if (!days.length) return segments

    const visibleStart = days[0]
    const visibleEnd = days[days.length - 1]
    const dayMs = 24 * 60 * 60 * 1000
    const keyToTime = (dayKey: string) => new Date(`${dayKey}T00:00:00`).getTime()

    const dayIndex = new Map<string, number>()
    for (let i = 0; i < days.length; i += 1) {
      dayIndex.set(format(days[i], 'yyyy-MM-dd'), i)
    }
    const laneRangesByRow = new Map<number, Array<Array<{ start: number; end: number }>>>()

    const hasOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) => {
      return Math.max(aStart, bStart) <= Math.min(aEnd, bEnd)
    }

    const getLane = (row: number, start: number, end: number) => {
      const rowLanes = laneRangesByRow.get(row) ?? []
      for (let lane = 0; lane < rowLanes.length; lane += 1) {
        const occupied = rowLanes[lane]
        const conflict = occupied.some((range) => hasOverlap(start, end, range.start, range.end))
        if (!conflict) {
          occupied.push({ start, end })
          laneRangesByRow.set(row, rowLanes)
          return lane
        }
      }
      rowLanes.push([{ start, end }])
      laneRangesByRow.set(row, rowLanes)
      return rowLanes.length - 1
    }

    const realMultiEvents = events
      .map((event) => {
        const start = toStartOfDay(parseApiDateTime(event.start_time))
        const end = toStartOfDay(parseApiDateTime(event.end_time || event.start_time))
        return { event, start, end }
      })
      .filter(({ start, end }) => end.getTime() > start.getTime())
      .sort((a, b) => {
        if (a.start.getTime() !== b.start.getTime()) return a.start.getTime() - b.start.getTime()
        return a.end.getTime() - b.end.getTime()
      })

    const syntheticMultiEvents: Array<{ event: Task; start: Date; end: Date }> = []
    const singleEntriesByGroup = new Map<string, Array<{ event: Task; dayKey: string }>>()
    for (const event of events) {
      const start = toStartOfDay(parseApiDateTime(event.start_time))
      const end = toStartOfDay(parseApiDateTime(event.end_time || event.start_time))
      if (start.getTime() !== end.getTime()) continue
      if (start < visibleStart || start > visibleEnd) continue
      const dayKey = format(start, 'yyyy-MM-dd')
      const groupKey = `${event.id}::${event.title}::${event.color || ''}`
      const bucket = singleEntriesByGroup.get(groupKey)
      if (bucket) bucket.push({ event, dayKey })
      else singleEntriesByGroup.set(groupKey, [{ event, dayKey }])
    }
    for (const entries of singleEntriesByGroup.values()) {
      const sorted = entries
        .slice()
        .sort((a, b) => keyToTime(a.dayKey) - keyToTime(b.dayKey))
      let runStart = 0
      for (let i = 1; i <= sorted.length; i += 1) {
        const prev = sorted[i - 1]
        const curr = sorted[i]
        const isConsecutive = curr && keyToTime(curr.dayKey) - keyToTime(prev.dayKey) === dayMs
        if (isConsecutive) continue
        const run = sorted.slice(runStart, i)
        if (run.length >= 2) {
          syntheticMultiEvents.push({
            event: run[0].event,
            start: new Date(`${run[0].dayKey}T00:00:00`),
            end: new Date(`${run[run.length - 1].dayKey}T00:00:00`),
          })
        }
        runStart = i
      }
    }

    const visibleMultiEvents = [...realMultiEvents, ...syntheticMultiEvents].sort((a, b) => {
      if (a.start.getTime() !== b.start.getTime()) return a.start.getTime() - b.start.getTime()
      return a.end.getTime() - b.end.getTime()
    })

    for (const { event, start: eventStart, end: eventEnd } of visibleMultiEvents) {
      const rangeStart = eventStart > visibleStart ? eventStart : visibleStart
      const rangeEnd = eventEnd < visibleEnd ? eventEnd : visibleEnd

      if (rangeStart > rangeEnd) continue

      const startIdx = dayIndex.get(format(rangeStart, 'yyyy-MM-dd'))
      const endIdx = dayIndex.get(format(rangeEnd, 'yyyy-MM-dd'))
      if (startIdx == null || endIdx == null) continue

      const startRow = Math.floor(startIdx / 7)
      const endRow = Math.floor(endIdx / 7)

      for (let row = startRow; row <= endRow; row += 1) {
        const rowStartIdx = row * 7
        const rowEndIdx = rowStartIdx + 6
        const segStartIdx = Math.max(startIdx, rowStartIdx)
        const segEndIdx = Math.min(endIdx, rowEndIdx)
        const startCol = segStartIdx % 7
        const endCol = segEndIdx % 7
        const lane = getLane(row, startCol, endCol)
        segments.push({
          key: `${event.id}-${row}-${startCol}-${endCol}-${lane}`,
          event,
          row,
          startCol,
          endCol,
          lane,
          isStart: segStartIdx === startIdx,
          isEnd: segEndIdx === endIdx,
        })
      }
    }

    return segments
  }, [events, days])

  const getEventStyle = (event: Task) => {
    const color = event.color || '#93c5fd'
    return {
      backgroundColor: `${color}40`,
      borderColor: `${color}88`,
      color: getReadableTextColor(color),
    }
  }

  const getEventTitle = (event: Task) => event.title

  const getReadableTextColor = (hexColor?: string) => {
    if (!hexColor || !hexColor.startsWith('#')) return '#ffffff'
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
        cellWidth < 80 ? 1 :
        cellWidth < 96 ? 2 : 3
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

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (target.closest('[data-more-trigger="true"]')) return
      if (morePopoverRef.current?.contains(target)) return
      setOpenMoreDateKey(null)
    }

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMoreDateKey(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [])

  useEffect(() => {
    setOpenMoreDateKey(null)
  }, [selectedDate])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/40 dark:border-gray-700 dark:bg-gray-900/50">
        {weekDays.map((day, index) => (
          <div
            key={day}
            className={`py-3 text-center text-[10px] font-bold uppercase tracking-[0.2em] ${
              index === 0
                ? 'text-red-400'
                : index === 6
                  ? 'text-slate-400'
                  : 'text-slate-400'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="relative flex-1 min-h-[520px]">
        <div
          ref={gridRef}
          className="grid h-full min-h-[520px] grid-cols-7 grid-rows-6 gap-px bg-slate-100 dark:bg-gray-700"
        >
        {days.map((day) => {
          const dayDateKey = format(day, 'yyyy-MM-dd')
          const dayIndexInGrid = days.findIndex((d) => format(d, 'yyyy-MM-dd') === dayDateKey)
          const rowIndex = dayIndexInGrid >= 0 ? Math.floor(dayIndexInGrid / 7) : 0
          const colIndex = dayIndexInGrid >= 0 ? dayIndexInGrid % 7 : 0
          const visibleMultiForDay = multiDaySegments.filter(
            (segment) =>
              segment.lane < MAX_VISIBLE_TASKS_PER_DAY &&
              segment.row === rowIndex &&
              segment.startCol <= colIndex &&
              segment.endCol >= colIndex,
          ).length
          const allMultiForDay = multiDaySegments.filter(
            (segment) =>
              segment.row === rowIndex &&
              segment.startCol <= colIndex &&
              segment.endCol >= colIndex,
          ).length
          const dayEvents = singleDayEventsByDate.get(dayDateKey) ?? []
          const maxSingleVisible = Math.max(
            MIN_VISIBLE_TASKS_PER_DAY - 1,
            Math.min(visibleTaskLimit, MAX_VISIBLE_TASKS_PER_DAY - visibleMultiForDay),
          )
          const visibleEvents = dayEvents.slice(0, maxSingleVisible)
          const hiddenEvents = dayEvents.slice(maxSingleVisible)
          const hiddenSingleCount = Math.max(0, dayEvents.length - maxSingleVisible)
          const hiddenMultiCount = Math.max(0, allMultiForDay - visibleMultiForDay)
          const hiddenCount = hiddenSingleCount + hiddenMultiCount
          const isMoreOpen = openMoreDateKey === dayDateKey
          const isCurrentMonth = isSameMonth(day, selectedDate)
          const dayOfWeek = day.getDay()
          const reservedTopSpacing =
            visibleMultiForDay > 0
              ? visibleMultiForDay * (MULTI_EVENT_HEIGHT + MULTI_EVENT_VERTICAL_GAP) - 4
              : 0

          return (
            <div
              key={day.toISOString()}
              onClick={() => isCurrentMonth && openTaskCreate(day)}
              className={`group relative min-h-[92px] p-2.5 transition-colors flex flex-col overflow-visible min-w-0 ${
                isCurrentMonth
                  ? 'bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-blue-950/30 cursor-pointer'
                  : 'bg-slate-50/40 dark:bg-gray-900/80 opacity-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-semibold w-7 h-7 flex items-center justify-center rounded-full ${
                    isToday(day)
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : dayOfWeek === 0
                        ? 'text-red-500'
                        : dayOfWeek === 6
                          ? 'text-slate-600 dark:text-slate-300'
                          : 'text-slate-700 dark:text-gray-300'
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

              <div className="space-y-1 overflow-y-auto flex-1 min-h-0" style={{ marginTop: reservedTopSpacing }}>
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
                    className="w-full h-6 truncate rounded-md border px-2 text-left text-[11px] shadow-sm transition-opacity hover:opacity-90"
                    style={getEventStyle(event)}
                  >
                    {getEventTitle(event)}
                  </button>
                ))}
                {hiddenCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenMoreDateKey((prev) => (prev === dayDateKey ? null : dayDateKey))
                    }}
                    data-more-trigger="true"
                    className="px-1 text-[11px] font-semibold text-slate-400 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 text-left"
                  >
                    +{hiddenCount} more
                  </button>
                )}
              </div>

              {isCurrentMonth && isMoreOpen && hiddenEvents.length > 0 && (
                <div
                  ref={morePopoverRef}
                  className="absolute left-1 right-1 top-[84px] z-30 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white/95 p-1.5 shadow-xl backdrop-blur dark:border-gray-700 dark:bg-gray-900/95"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="space-y-1">
                    {hiddenEvents.map((event) => (
                      <button
                        key={`${event.id}-more-${dayDateKey}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMoreDateKey(null)
                          if (onOpenTaskDetail) {
                            void onOpenTaskDetail(event)
                            return
                          }
                          openTaskDetail(event)
                        }}
                        className="w-full h-6 truncate rounded-md border px-2 text-left text-xs transition-opacity hover:opacity-90"
                        style={getEventStyle(event)}
                      >
                        {getEventTitle(event)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        </div>

        <div className="pointer-events-none absolute inset-0">
          {multiDaySegments
            .filter((segment) => segment.lane < MAX_VISIBLE_TASKS_PER_DAY)
            .map((segment) => {
            const spanDays = segment.endCol - segment.startCol + 1
            const color = segment.event.color || '#0ea5e9'
            const textColor = getReadableTextColor(color)
            const isWeekSegmentStart = segment.startCol === 0
            const showSegmentTitle = segment.isStart || isWeekSegmentStart
            return (
              <button
                key={segment.key}
                onClick={(e) => {
                  e.stopPropagation()
                  if (onOpenTaskDetail) {
                    void onOpenTaskDetail(segment.event)
                    return
                  }
                  openTaskDetail(segment.event)
                }}
                className="pointer-events-auto absolute flex items-center px-2 text-left text-[11px] font-semibold shadow-sm transition-opacity hover:opacity-95"
                style={{
                  top: `calc(${segment.row} * (100% / 6) + ${MULTI_EVENT_TOP_OFFSET + segment.lane * (MULTI_EVENT_HEIGHT + MULTI_EVENT_VERTICAL_GAP)}px)`,
                  left: `calc(${(segment.startCol / 7) * 100}% + 6px)`,
                  width: `calc(${(spanDays / 7) * 100}% - 12px)`,
                  height: `${MULTI_EVENT_HEIGHT}px`,
                  backgroundColor: color,
                  color: textColor,
                  borderTopLeftRadius: showSegmentTitle ? '8px' : '4px',
                  borderBottomLeftRadius: showSegmentTitle ? '8px' : '4px',
                  borderTopRightRadius: segment.isEnd ? '8px' : '4px',
                  borderBottomRightRadius: segment.isEnd ? '8px' : '4px',
                }}
              >
                {showSegmentTitle ? getEventTitle(segment.event) : ''}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
