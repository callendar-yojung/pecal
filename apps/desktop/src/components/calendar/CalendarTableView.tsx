import { addDays, format, startOfDay, startOfWeek } from 'date-fns'
import { useMemo } from 'react'
import { parseApiDateTime } from '../../utils/datetime'
import type { Task } from '../../types'

interface CalendarTableViewProps {
  selectedDate: Date
  events: Task[]
  onOpenTaskDetail: (task: Task) => void | Promise<void>
}

const HOURS = Array.from({ length: 24 }, (_, index) => index)
const HOUR_ROW_HEIGHT = 56

export function CalendarTableView({ selectedDate, events, onOpenTaskDetail }: CalendarTableViewProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 })
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])

  const tasksByDay = useMemo(() => {
    return weekDays.map((day) => {
      const dayStart = startOfDay(day).getTime()
      const dayEnd = dayStart + 24 * 60 * 60 * 1000
      const items = events
        .map((task) => {
          const taskStart = parseApiDateTime(task.start_time).getTime()
          const taskEnd = parseApiDateTime(task.end_time || task.start_time).getTime()
          if (taskStart >= dayEnd || taskEnd <= dayStart) return null

          const visibleStart = Math.max(taskStart, dayStart)
          const visibleEnd = Math.max(visibleStart + 15 * 60 * 1000, Math.min(taskEnd, dayEnd))
          const startMinutes = Math.max(0, Math.floor((visibleStart - dayStart) / 60000))
          const durationMinutes = Math.max(15, Math.floor((visibleEnd - visibleStart) / 60000))

          return {
            task,
            startMinutes,
            durationMinutes,
          }
        })
        .filter((item): item is { task: Task; startMinutes: number; durationMinutes: number } => Boolean(item))
        .sort((a, b) => a.startMinutes - b.startMinutes)
      return items
    })
  }, [events, weekDays])

  const totalHeight = HOURS.length * HOUR_ROW_HEIGHT

  return (
    <div className="h-full overflow-auto">
      <div className="min-w-[980px]">
        <div className="sticky top-0 z-10 grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-slate-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="px-2 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500" />
          {weekDays.map((day) => (
            <div key={day.toISOString()} className="px-2 py-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
              {format(day, 'M/d (EEE)')}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
          <div className="relative border-r border-slate-200 dark:border-gray-700" style={{ height: totalHeight }}>
            {HOURS.map((hour) => (
              <div key={hour} className="absolute left-0 right-0 px-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500" style={{ top: hour * HOUR_ROW_HEIGHT + 2 }}>
                {`${String(hour).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {tasksByDay.map((dayTasks, dayIndex) => (
            <div
              key={weekDays[dayIndex].toISOString()}
              className="relative border-r border-slate-200 dark:border-gray-700 last:border-r-0"
              style={{ height: totalHeight }}
            >
              {HOURS.map((hour) => (
                <div
                  key={`${dayIndex}-${hour}`}
                  className="absolute left-0 right-0 border-t border-slate-100 dark:border-gray-800"
                  style={{ top: hour * HOUR_ROW_HEIGHT }}
                />
              ))}

              {dayTasks.map(({ task, startMinutes, durationMinutes }) => {
                const top = (startMinutes / 60) * HOUR_ROW_HEIGHT
                const height = Math.max((durationMinutes / 60) * HOUR_ROW_HEIGHT, 24)
                const taskColor = task.color || '#3B82F6'

                return (
                  <button
                    key={`${task.id}-${dayIndex}-${startMinutes}`}
                    type="button"
                    onClick={() => void onOpenTaskDetail(task)}
                    className="absolute left-1 right-1 rounded-md border px-2 py-1 text-left shadow-sm"
                    style={{
                      top,
                      height,
                      backgroundColor: `${taskColor}26`,
                      borderColor: `${taskColor}AA`,
                    }}
                    title={task.title}
                  >
                    <div className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-100">{task.title}</div>
                    <div className="truncate text-[10px] text-slate-500 dark:text-slate-300">
                      {format(parseApiDateTime(task.start_time), 'HH:mm')} - {format(parseApiDateTime(task.end_time || task.start_time), 'HH:mm')}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
