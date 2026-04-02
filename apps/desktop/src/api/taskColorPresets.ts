import { apiClient } from './client'

interface TaskColorPresetsResponse {
  presets?: string[]
}

export const taskColorPresetsApi = {
  getPresets: () =>
    apiClient.get<TaskColorPresetsResponse>('/api/me/task-color-presets'),

  updatePresets: (presets: string[]) =>
    apiClient.patch<TaskColorPresetsResponse>('/api/me/task-color-presets', { presets }),
}
