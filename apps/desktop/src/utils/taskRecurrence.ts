import type { Task } from '../types'

export function isRecurringTask(task: Task): boolean {
  if (task.recurrence && Array.isArray(task.recurrence.weekdays) && task.recurrence.weekdays.length > 0) {
    return true
  }
  if (!task.rrule) return false
  try {
    const parsed = JSON.parse(task.rrule) as { type?: string; weekdays?: number[] } | null
    return Boolean(
      parsed &&
        parsed.type === 'WEEKLY_RANGE' &&
        Array.isArray(parsed.weekdays) &&
        parsed.weekdays.length > 0
    )
  } catch {
    const legacy = String(task.rrule).toUpperCase()
    return legacy.includes('FREQ=WEEKLY') || legacy.includes('WEEKLY_RANGE')
  }
}

export function dedupeTasksById(tasks: Task[]): Task[] {
  const seen = new Set<number>()
  const result: Task[] = []
  for (const task of tasks) {
    if (seen.has(task.id)) continue
    seen.add(task.id)
    result.push(task)
  }
  return result
}
