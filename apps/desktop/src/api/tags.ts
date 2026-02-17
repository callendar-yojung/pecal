import { apiClient } from './client'
import type {
  TagsResponse,
  CreateTagPayload,
  CreateTagResponse,
} from '../types'

export const tagApi = {
  getTags: (ownerType: CreateTagPayload['owner_type'], ownerId: number) =>
    apiClient.get<TagsResponse>(
      `/api/tags?owner_type=${ownerType}&owner_id=${ownerId}`
    ),

  createTag: (payload: CreateTagPayload) =>
    apiClient.post<CreateTagResponse>('/api/tags', payload),
}
