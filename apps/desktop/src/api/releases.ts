import { apiClient } from './client'

interface ReleaseInfo {
  version?: string
  releaseNotes?: string
}

interface ReleasesResponse {
  success?: boolean
  releases?: Record<string, ReleaseInfo>
}

const parseReleaseNotes = (raw?: string): string[] => {
  if (!raw) return []
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
}

export const releaseApi = {
  getLatestNotes: async (platform = 'windows') => {
    const response = await apiClient.get<ReleasesResponse>('/api/releases/latest')
    const release = response.releases?.[platform]

    return {
      version: release?.version || '',
      notes: parseReleaseNotes(release?.releaseNotes),
    }
  },
}

