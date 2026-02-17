import { apiClient } from './client'
import type {
  TasksResponse,
  PaginatedTasksResponse,
  CreateTaskPayload,
  CreateTaskResponse,
  UpdateTaskPayload,
  UpdateTaskResponse,
  DeleteTaskResponse,
} from '../types'

export interface TaskListParams {
  workspace_id: number
  page?: number
  limit?: number
  sort_by?: 'start_time' | 'end_time' | 'created_at' | 'updated_at' | 'title' | 'status'
  sort_order?: 'ASC' | 'DESC'
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE'
  search?: string
}

export const taskApi = {
  getTasks: (workspaceId: number) =>
    apiClient.get<TasksResponse>(`/api/tasks?workspace_id=${workspaceId}`),

  getTasksPaginated: (params: TaskListParams) => {
    const query = new URLSearchParams()
    query.set('workspace_id', String(params.workspace_id))
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.sort_by) query.set('sort_by', params.sort_by)
    if (params.sort_order) query.set('sort_order', params.sort_order)
    if (params.status) query.set('status', params.status)
    if (params.search) query.set('search', params.search)
    return apiClient.get<PaginatedTasksResponse>(`/api/tasks?${query.toString()}`)
  },

  createTask: (payload: CreateTaskPayload) =>
    apiClient.post<CreateTaskResponse>('/api/tasks', payload),

  updateTask: (payload: UpdateTaskPayload) =>
    apiClient.patch<UpdateTaskResponse>('/api/tasks', payload),

  deleteTask: (taskId: number) =>
    apiClient.delete<DeleteTaskResponse>(`/api/tasks?task_id=${taskId}`),
}
