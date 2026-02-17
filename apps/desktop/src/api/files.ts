import { apiClient } from './client'
import type {
  OwnerType,
  FileUploadResponse,
  FilesPaginatedResponse,
  AttachmentsResponse,
  DeleteAttachmentResponse,
} from '../types'

export interface FileListParams {
  workspace_id: number
  page?: number
  limit?: number
  type?: 'all' | 'image' | 'document' | 'other'
}

export const fileApi = {
  getFiles: (params: FileListParams) => {
    const query = new URLSearchParams()
    query.set('workspace_id', String(params.workspace_id))
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.type && params.type !== 'all') query.set('type', params.type)
    return apiClient.get<FilesPaginatedResponse>(`/api/me/files?${query.toString()}`)
  },

  uploadFile: (file: File, ownerType: OwnerType, ownerId: number, taskId?: number) => {
    const fields: Record<string, string> = {
      owner_type: ownerType,
      owner_id: String(ownerId),
    }
    if (taskId !== undefined) {
      fields.task_id = String(taskId)
    }
    return apiClient.upload<FileUploadResponse>('/api/files/upload', file, fields)
  },

  deleteFile: (fileId: number) =>
    apiClient.delete<{ success: boolean }>(`/api/files?id=${fileId}`),

  bulkDeleteFiles: (workspaceId: number, fileIds: number[]) =>
    apiClient.post<{ success: boolean; deleted: number[]; failed: number[]; message: string }>(
      '/api/me/files',
      {
        action: 'bulk_delete',
        file_ids: fileIds,
        workspace_id: workspaceId,
      }
    ),
}

export const attachmentApi = {
  getAttachments: (taskId: number) =>
    apiClient.get<AttachmentsResponse>(`/api/tasks/attachments?task_id=${taskId}`),

  deleteAttachment: (attachmentId: number) =>
    apiClient.delete<DeleteAttachmentResponse>(
      `/api/tasks/attachments?attachment_id=${attachmentId}&delete_file=true`
    ),
}
