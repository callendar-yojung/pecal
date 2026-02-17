import { apiClient } from './client'
import type {
  TeamsResponse,
  TeamResponse,
  TeamMembersResponse,
  MemberSearchResponse,
  TeamRolesResponse,
  TeamRolePermissionsResponse,
} from '../types'

export const teamApi = {
  getMyTeams: () => apiClient.get<TeamsResponse>('/api/me/teams'),

  createTeam: (name: string, description?: string) =>
    apiClient.post<{ success: boolean; teamId: number; message: string }>(
      '/api/me/teams',
      { name, description }
    ),

  getTeam: (id: number) => apiClient.get<TeamResponse>(`/api/teams/${id}`),

  getTeamMembers: (id: number) =>
    apiClient.get<TeamMembersResponse>(`/api/teams/${id}/members`),

  searchMembers: (query: string, type: 'email' | 'nickname') =>
    apiClient.get<MemberSearchResponse>(
      `/api/members/search?q=${encodeURIComponent(query)}&type=${type}`
    ),

  inviteMember: (id: number, invitedMemberId: number, roleId?: number | null) =>
    apiClient.post<{ success?: boolean; invitation_id?: number; error?: string }>(
      `/api/teams/${id}/invitations`,
      {
        invited_member_id: invitedMemberId,
        role_id: roleId ?? null,
      }
    ),

  removeMember: (id: number, memberId: number) =>
    apiClient.delete<{ success: boolean }>(`/api/teams/${id}/members?member_id=${memberId}`),

  updateMemberRole: (id: number, memberId: number, roleId: number) =>
    apiClient.patch<{ success: boolean }>(`/api/teams/${id}/members`, {
      member_id: memberId,
      role_id: roleId,
    }),

  getRoles: (id: number) => apiClient.get<TeamRolesResponse>(`/api/teams/${id}/roles`),

  createRole: (id: number, name: string) =>
    apiClient.post<{ success: boolean; role_id: number }>(`/api/teams/${id}/roles`, { name }),

  deleteRole: (id: number, roleId: number) =>
    apiClient.delete<{ success: boolean }>(`/api/teams/${id}/roles?role_id=${roleId}`),

  getRolePermissions: (id: number, roleId: number) =>
    apiClient.get<TeamRolePermissionsResponse>(`/api/teams/${id}/roles/${roleId}/permissions`),

  setRolePermissions: (id: number, roleId: number, codes: string[]) =>
    apiClient.put<{ success: boolean }>(`/api/teams/${id}/roles/${roleId}/permissions`, {
      codes,
    }),

  updateTeam: (id: number, name: string, description?: string) =>
    apiClient.patch<{ success: boolean; message: string }>(`/api/teams/${id}`, {
      name,
      description,
    }),

  deleteTeam: (id: number) =>
    apiClient.delete<{ success: boolean; message: string }>(`/api/teams/${id}`),
}
