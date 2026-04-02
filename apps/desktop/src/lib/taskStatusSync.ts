import type { TaskStatus } from '../types'

const TASK_STATUS_CHANGED_EVENT = 'pecal:task-status-changed'

export type TaskStatusSyncSource = 'overview' | 'task-list'

export interface TaskStatusChangedDetail {
  taskId: number
  prevStatus: TaskStatus
  nextStatus: TaskStatus
  source: TaskStatusSyncSource
}

export function emitTaskStatusChanged(detail: TaskStatusChangedDetail) {
  window.dispatchEvent(new CustomEvent<TaskStatusChangedDetail>(TASK_STATUS_CHANGED_EVENT, { detail }))
}

export function onTaskStatusChanged(handler: (detail: TaskStatusChangedDetail) => void) {
  const listener = (event: Event) => {
    const custom = event as CustomEvent<TaskStatusChangedDetail>
    if (!custom.detail) return
    handler(custom.detail)
  }
  window.addEventListener(TASK_STATUS_CHANGED_EVENT, listener as EventListener)
  return () => window.removeEventListener(TASK_STATUS_CHANGED_EVENT, listener as EventListener)
}
