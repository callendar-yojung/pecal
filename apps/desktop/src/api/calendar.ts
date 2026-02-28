import { apiClient } from './client'
import type { Task } from '../types'

export interface CalendarTasksByDateResponse {
  tasksByDate: Array<{
    date: string
    tasks: Array<Pick<Task, 'id' | 'title' | 'start_time' | 'end_time' | 'color'>>
  }>
}

export const calendarApi = {
  getMonthlyTasks: (workspaceId: number, year: number, month: number) =>
    apiClient.getCached<CalendarTasksByDateResponse>(
      `calendar:${workspaceId}:${year}-${month}`,
      `/api/calendar?workspace_id=${workspaceId}&year=${year}&month=${month}`,
      { cacheMs: 8_000, dedupe: true, retries: 1 },
    ),
}
