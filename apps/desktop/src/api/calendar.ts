import { apiClient } from './client'
import type { CalendarResponse } from '../types'

export const calendarApi = {
  getMonthlyTaskCounts: (workspaceId: number, year: number, month: number) =>
    apiClient.get<CalendarResponse>(
      `/api/calendar?workspace_id=${workspaceId}&year=${year}&month=${month}`
    ),
}