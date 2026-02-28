import { apiClient } from './client'
import type {
  TasksResponse,
  PaginatedTasksResponse,
  CreateTaskPayload,
  CreateTaskResponse,
  UpdateTaskPayload,
  UpdateTaskResponse,
  DeleteTaskResponse,
  Task,
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

type BackendTask = Task & {
  status?: Task['status'] | 'TODO' | 'IN_PROGRESS' | 'DONE'
  tags?: Array<{ tag_id: number }>
}

function normalizeTask(task: BackendTask): Task {
  const status = String(task.status ?? '').toUpperCase()
  const normalizedStatus =
    status === 'DONE' ? 'done' : status === 'IN_PROGRESS' ? 'in_progress' : 'todo'

  return {
    ...task,
    status: normalizedStatus,
    tag_ids: task.tag_ids ?? task.tags?.map((tag) => tag.tag_id) ?? [],
  }
}

export const taskApi = {
  getTasks: (workspaceId: number) =>
    apiClient.getCached<TasksResponse>(
      `tasks:${workspaceId}:default`,
      `/api/tasks?workspace_id=${workspaceId}`,
      { cacheMs: 8_000, dedupe: true, retries: 1 },
    ),

  getTasksPaginated: (params: TaskListParams) => {
    const query = new URLSearchParams()
    query.set('workspace_id', String(params.workspace_id))
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.sort_by) query.set('sort_by', params.sort_by)
    if (params.sort_order) query.set('sort_order', params.sort_order)
    if (params.status) query.set('status', params.status)
    if (params.search) query.set('search', params.search)
    return apiClient.getCached<PaginatedTasksResponse>(
      `tasks:${params.workspace_id}:${query.toString()}`,
      `/api/tasks?${query.toString()}`,
      { cacheMs: 8_000, dedupe: true, retries: 1 },
    )
  },

  getTaskById: async (taskId: number) => {
    const res = await apiClient.getCached<{ task?: BackendTask }>(
      `tasks:detail:${taskId}`,
      `/api/tasks/${taskId}`,
      { cacheMs: 8_000, dedupe: true, retries: 1 },
    )
    return res.task ? normalizeTask(res.task) : null
  },

  createTask: async (payload: CreateTaskPayload) => {
    const res = await apiClient.post<CreateTaskResponse>('/api/tasks', payload)
    apiClient.invalidateCache(`tasks:${payload.workspace_id}`)
    apiClient.invalidateCache(`calendar:${payload.workspace_id}`)
    return res
  },

  updateTask: async (payload: UpdateTaskPayload) => {
    const res = await apiClient.patch<UpdateTaskResponse>('/api/tasks', payload)
    // task_id 기반 업데이트는 workspace_id를 알기 어렵기 때문에 prefix 전체 무효화.
    apiClient.invalidateCache('tasks:')
    apiClient.invalidateCache('calendar:')
    return res
  },

  deleteTask: async (taskId: number) => {
    const res = await apiClient.delete<DeleteTaskResponse>(`/api/tasks?task_id=${taskId}`)
    apiClient.invalidateCache('tasks:')
    apiClient.invalidateCache('calendar:')
    return res
  },
}
