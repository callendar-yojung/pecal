import type { TaskItem } from './types';

const STATUS_COLORS = {
  TODO: '#6B7280',
  IN_PROGRESS: '#3B82F6',
  DONE: '#22C55E',
} as const;

const DEFAULT_TASK_COLOR = '#3B82F6';

export const TASK_COLOR_OPTIONS = [
  { value: '#3B82F6', label: 'Blue' },
  { value: '#EF4444', label: 'Red' },
  { value: '#10B981', label: 'Green' },
  { value: '#F59E0B', label: 'Amber' },
  { value: '#8B5CF6', label: 'Purple' },
  { value: '#EC4899', label: 'Pink' },
  { value: '#6366F1', label: 'Indigo' },
  { value: '#14B8A6', label: 'Teal' },
] as const;

export function getTaskStatusColor(status?: TaskItem['status']) {
  if (!status) return STATUS_COLORS.TODO;
  return STATUS_COLORS[status] ?? STATUS_COLORS.TODO;
}

export function getTaskAccentColor(task: TaskItem) {
  return task.color || DEFAULT_TASK_COLOR;
}
