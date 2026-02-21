// ─── Auth ────────────────────────────────────────────────────────────────────
export type AuthProvider = 'kakao' | 'google' | 'guest';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: AuthProvider;
}

// ─── Workspace ───────────────────────────────────────────────────────────────
export type WorkspaceType = 'personal' | 'team';
export type WorkspacePlan = 'free' | 'pro';

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  plan: WorkspacePlan;
  description?: string;
  memberCount: number;
  createdAt: string;
}

// ─── Tag ─────────────────────────────────────────────────────────────────────
export const TAG_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6',
] as const;

export type TagColor = typeof TAG_COLORS[number];

export interface Tag {
  id: string;
  name: string;
  color: TagColor;
  workspaceId: string;
}

// ─── Schedule ────────────────────────────────────────────────────────────────
export type ScheduleStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export const SCHEDULE_COLORS = [
  '#5B6CF6', '#EF4444', '#F97316', '#EAB308',
  '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899',
] as const;

export type ScheduleColor = typeof SCHEDULE_COLORS[number];

export interface Schedule {
  id: string;
  title: string;
  description?: string;
  date: string; // ISO date string YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  status: ScheduleStatus;
  color: ScheduleColor;
  tagIds: string[];
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Memo ─────────────────────────────────────────────────────────────────────
export interface Memo {
  id: string;
  title: string;
  content: string;
  isFavorite: boolean;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

export type MemoSortOrder = 'latest' | 'oldest' | 'title' | 'favorites';

// ─── File ─────────────────────────────────────────────────────────────────────
export type FileType = 'image' | 'document' | 'other';
export type FileFilter = 'all' | FileType;

export interface AppFile {
  id: string;
  name: string;
  type: FileType;
  size: number; // bytes
  uri: string;
  mimeType: string;
  workspaceId: string;
  createdAt: string;
}

// ─── Notification ─────────────────────────────────────────────────────────────
export type NotificationType = 'schedule' | 'memo' | 'file' | 'team';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  workspaceId: string;
  createdAt: string;
}
