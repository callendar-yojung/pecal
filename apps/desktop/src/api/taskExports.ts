import { apiClient } from './client'
import type {
  TaskExportVisibility,
  TaskExportsResponse,
} from '../types'

export const taskExportsApi = {
  createExport: (taskId: number, visibility: TaskExportVisibility, expiresAt: string | null) =>
    apiClient.post<{ token: string; url: string; path: string }>(`/api/tasks/${taskId}/export`, {
      visibility,
      expires_at: expiresAt,
    }),

  getExports: (taskId: number) =>
    apiClient.get<TaskExportsResponse>(`/api/tasks/${taskId}/exports`),

  updateExport: (
    exportId: number,
    payload: { visibility?: TaskExportVisibility; expires_at?: string | null; revoke?: boolean }
  ) => apiClient.patch<{ success: boolean }>(`/api/exports/tasks/id/${exportId}`, payload),

  addAccess: (exportId: number, memberId: number) =>
    apiClient.post<{ success: boolean }>(`/api/exports/tasks/id/${exportId}/access`, {
      member_id: memberId,
    }),

  removeAccess: (exportId: number, memberId: number) =>
    apiClient.delete<{ success: boolean }>(
      `/api/exports/tasks/id/${exportId}/access?member_id=${memberId}`
    ),
}

