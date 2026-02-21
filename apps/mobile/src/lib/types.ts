export type OAuthProvider = 'kakao' | 'google';
export type WorkspaceType = 'personal' | 'team';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type MainTab = 'overview' | 'tasks' | 'calendar' | 'memo' | 'files';

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  memberId: number;
  nickname: string;
  email?: string;
  provider: OAuthProvider;
};

export type Workspace = {
  workspace_id: number;
  type: WorkspaceType;
  owner_id: number;
  name: string;
};

export type TeamItem = {
  id: number;
  name: string;
  description?: string | null;
};

export type TagItem = {
  tag_id: number;
  name: string;
  color?: string;
};

export type TaskItem = {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  content?: string | null;
  status?: TaskStatus;
  color?: string;
  tag_ids?: number[];
  description?: string | null;
  assignee_id?: number | null;
  is_all_day?: boolean;
  reminder_minutes?: number | null;
  rrule?: string | null;
};

export type FileItem = {
  file_id: number;
  original_name: string;
  file_size_formatted?: string;
  file_size?: number;
  file_path?: string;
};

export type MemoItem = {
  memo_id: number;
  title: string;
  content_json: string | null;
  updated_at: string;
  is_favorite?: number;
  is_pinned?: boolean;
  tags?: string[];
  folder?: string;
};

export type NotificationItem = {
  notification_id: number;
  title: string | null;
  message: string | null;
  is_read: number;
};
