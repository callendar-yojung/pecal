// Workspace types
export type WorkspaceType = 'personal' | 'team'

export interface Workspace {
  workspace_id: number
  type: WorkspaceType
  owner_id: number  // personal일 경우 member_id, team일 경우 team_id
  created_at: string
  name: string
  created_by: number
  memberCount?: number
}

// Team types
export interface Team {
  id: number  // 백엔드에서 id로 반환
  name: string
  created_at: string
  created_by: number
  description?: string
}

export interface TeamMember {
  member_id: number
  team_id: number
  role: 'owner' | 'admin' | 'member'
  joined_at: string
}

export interface TeamMemberInfo {
  member_id: number
  nickname: string | null
  email: string | null
  role_name: string | null
  role_id: number | null
}

export interface TeamRoleInfo {
  team_role_id: number
  name: string
  memberCount?: number
}

export interface TeamPermissionInfo {
  permission_id: number
  code: string
  description: string | null
}

export interface MemberSearchResult {
  member_id: number
  nickname: string | null
  email: string | null
  profile_image_url: string | null
}

export interface NotificationItem {
  notification_id: number
  type: string
  title: string | null
  message: string | null
  payload_json: string | null
  source_type: string | null
  source_id: number | null
  is_read: number
  created_at: string
  invitation_status?: string | null
  team_name?: string | null
  inviter_name?: string | null
}

export type TaskExportVisibility = 'public' | 'restricted'

export interface ExportAccessMember {
  member_id: number
  nickname: string | null
  email: string | null
  profile_image_url: string | null
}

export interface TaskExportItem {
  export_id: number
  token: string
  visibility: TaskExportVisibility
  created_at: string
  revoked_at?: string | null
  expires_at?: string | null
  access_members: ExportAccessMember[]
}

// Task types
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type BackendTaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'

export type OwnerType = 'team' | 'personal'

export interface Tag {
  tag_id: number
  name: string
  color: string
}

export interface Task {
  id: number
  title: string
  start_time: string
  end_time: string
  content?: string
  color?: string
  reminder_minutes?: number | null
  rrule?: string | null
  tag_ids?: number[]
  status?: TaskStatus
  created_at: string
  updated_at: string
  created_by: number
  updated_by: number
  workspace_id: number
}

export interface CreateTaskPayload {
  title: string
  start_time: string
  end_time: string
  content?: string
  color: string
  tag_ids: number[]
  file_ids?: number[]
  reminder_minutes?: number | null
  rrule?: string | null
  status?: TaskStatus | BackendTaskStatus
  workspace_id: number
}

export interface UpdateTaskPayload {
  task_id: number
  title?: string
  start_time?: string
  end_time?: string
  content?: string
  color?: string
  reminder_minutes?: number | null
  rrule?: string | null
  tag_ids?: number[]
  status?: TaskStatus | BackendTaskStatus
}

export interface CreateTagPayload {
  name: string
  color: string
  owner_type: OwnerType
  owner_id: number
}

// Member types
export interface Member {
  memberId: number
  nickname: string
  email?: string
  provider: string
  profileImageUrl?: string | null
}

// API Response types
export interface WorkspacesResponse {
  workspaces: Workspace[]
}

export interface WorkspaceResponse {
  workspace: Workspace
}

export interface TeamsResponse {
  teams: Team[]
}

export interface TeamResponse {
  team: Team
}

export interface TeamMembersResponse {
  members: TeamMemberInfo[]
}

export interface TeamRolesResponse {
  roles: TeamRoleInfo[]
}

export interface TeamRolePermissionsResponse {
  permissions: TeamPermissionInfo[]
}

export interface MemberSearchResponse {
  results: MemberSearchResult[]
}

export interface NotificationsResponse {
  notifications: NotificationItem[]
}

export interface NotificationUnreadCountResponse {
  count: number
}

export interface TaskExportsResponse {
  exports: TaskExportItem[]
}

export interface TasksResponse {
  tasks: Task[]
}

export interface PaginatedTasksResponse {
  tasks: Task[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface TagsResponse {
  tags: Tag[]
}

export interface CreateTaskResponse {
  success: boolean
  taskId: number
}

export interface UpdateTaskResponse {
  success: boolean
}

export interface DeleteTaskResponse {
  success: boolean
}

export interface CreateTagResponse {
  success: boolean
  tagId?: number
  tag?: Tag
}

export interface CalendarResponse {
  taskCounts: Record<string, number>
}

// Auth types
export interface AuthResponse {
  success: boolean
  user: Member
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface RefreshTokenResponse {
  success: boolean
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface MeResponse {
  user: Member
}

// File types
export interface FileInfo {
  file_id: number
  original_name: string
  file_path: string
  file_size: number
  file_size_formatted: string
  mime_type: string | null
}

export interface Attachment {
  attachment_id: number
  task_id: number
  file_id: number
  original_name: string
  file_path: string
  file_size: number
  file_size_formatted: string
  mime_type: string | null
  created_at: string
}

export interface FilesResponse { files: FileInfo[] }
export interface FilesPaginatedResponse {
  files: FileInfo[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  stats: {
    total: number
    images: number
    documents: number
    others: number
  }
}
export interface FileUploadResponse { file: FileInfo }
export interface AttachmentsResponse { attachments: Attachment[] }
export interface DeleteAttachmentResponse { success: boolean }

// Subscription types
export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'trialing'

export interface Subscription {
  subscription_id: number
  plan_name: string
  status: SubscriptionStatus
  started_at: string
  expires_at: string
}

export interface SubscriptionResponse {
  subscription: Subscription | null
}

// Usage types
export interface UsagePlan {
  plan_name: string
  max_storage_bytes: number
  max_file_size_bytes: number
  max_members: number
}

export interface UsageStorage {
  used_bytes: number
  limit_bytes: number
  file_count: number
}

export interface UsageMembers {
  current: number
  max: number
}

export interface UsageTasks {
  total: number
  created_this_month: number
  completed_this_month: number
  todo: number
  in_progress: number
}

export interface UsageData {
  plan: UsagePlan
  storage: UsageStorage
  members: UsageMembers
  tasks: UsageTasks
  workspace_name: string
}

// Mode type
export type Mode = 'PERSONAL' | 'TEAM'

// Modal type
export type ModalType =
  | 'DETAIL'
  | 'EDIT'
  | 'CREATE'
  | 'TEAM_CREATE'
  | 'SETTINGS'
  | 'NOTIFICATIONS'
  | 'ALARM_HISTORY'
  | null
