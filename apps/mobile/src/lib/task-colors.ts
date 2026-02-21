import type { TaskItem } from './types';

const STATUS_COLORS = {
  TODO: '#6B7280',
  IN_PROGRESS: '#3B82F6',
  DONE: '#22C55E',
} as const;

const DEFAULT_TASK_COLOR = '#3B82F6';

export function getTaskStatusColor(status?: TaskItem['status']) {
  if (!status) return STATUS_COLORS.TODO;
  return STATUS_COLORS[status] ?? STATUS_COLORS.TODO;
}

export function getTaskAccentColor(task: TaskItem) {
  return task.color || DEFAULT_TASK_COLOR;
}
