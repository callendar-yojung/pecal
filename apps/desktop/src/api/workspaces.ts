import { apiClient } from './client'
import type { WorkspacesResponse, WorkspaceResponse, Workspace } from '../types'

export const workspaceApi = {
  getMyWorkspaces: () => apiClient.get<WorkspacesResponse>('/api/me/workspaces'),

  getMyPersonalWorkspaces: () =>
    apiClient.get<WorkspacesResponse>('/api/me/workspaces?type=personal'),

  getTeamWorkspaces: (teamId: number) =>
    apiClient.get<WorkspacesResponse>(`/api/me/workspaces?team_id=${teamId}`),

  getWorkspace: (id: number) =>
    apiClient.get<WorkspaceResponse>(`/api/workspaces/${id}`),

  getMemberWorkspaces: (memberId: number) =>
    apiClient.get<WorkspacesResponse>(`/api/workspaces/member/${memberId}`),

  getTeamWorkspace: (teamId: number) =>
    apiClient.get<WorkspaceResponse>(`/api/workspaces/team/${teamId}`),

  createWorkspace: (data: { name: string; type: 'personal' | 'team'; owner_id?: number }) =>
    apiClient.post<{ success: boolean; workspace: Workspace }>('/api/workspaces', data),

  switchWorkspace: async (workspaceId: number): Promise<Workspace> => {
    const response = await workspaceApi.getWorkspace(workspaceId)
    return response.workspace
  },

  updateWorkspace: (id: number, name: string) =>
    apiClient.patch<{ success: boolean; message: string }>(
      `/api/workspaces/${id}`,
      { name }
    ),

  deleteWorkspace: (id: number) =>
    apiClient.delete<{ success: boolean; message: string }>(
      `/api/workspaces/${id}`
    ),
}
