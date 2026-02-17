import { apiClient } from './client'
import type { UsageData } from '../types'

export const usageApi = {
  getUsage: (workspaceId: number) =>
    apiClient.get<UsageData>(`/api/me/usage?workspace_id=${workspaceId}`),
}
