import { NativeModules, Platform } from 'react-native';
import type { TaskItem } from './types';

type WidgetTask = {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  color: string;
};

type WidgetPayload = {
  generated_at: string;
  workspace_name: string;
  nickname: string;
  tasks: WidgetTask[];
};

type WidgetBridgeModule = {
  setWidgetData?: (jsonPayload: string) => Promise<boolean> | boolean | void;
  clearWidgetData?: () => Promise<boolean> | boolean | void;
  reloadAllTimelines?: () => Promise<boolean> | boolean | void;
};

function getBridge(): WidgetBridgeModule | null {
  if (Platform.OS !== 'ios') return null;
  const bridge = (NativeModules?.PecalWidgetBridge ?? null) as WidgetBridgeModule | null;
  return bridge;
}

function isValidDate(input: string | undefined | null) {
  if (!input) return false;
  return parseDate(input) !== null;
}

function parseDate(input: string | undefined | null) {
  if (!input) return null;
  const primary = new Date(input);
  if (!Number.isNaN(primary.getTime())) return primary;
  const normalized = input.replace(' ', 'T');
  const fallback = new Date(normalized);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return null;
}

function pickTasksForWidget(tasks: TaskItem[], limit: number): WidgetTask[] {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const normalized = tasks
    .map((task) => ({
      task,
      start: parseDate(task.start_time),
      end: parseDate(task.end_time),
    }))
    .filter((item): item is { task: TaskItem; start: Date; end: Date } => !!item.start && !!item.end)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const inCurrentMonth = normalized.filter(({ start, end }) => end >= monthStart && start <= monthEnd);
  const selected = (inCurrentMonth.length > 0 ? inCurrentMonth : normalized).slice(0, limit);

  return selected
    .map(({ task }) => task)
    .map((task) => ({
      id: task.id,
      title: task.title || '제목 없음',
      start_time: task.start_time,
      end_time: task.end_time,
      status: task.status ?? 'TODO',
      color: task.color ?? '#5B6CFF',
    }));
}

export async function syncWidgetData(params: {
  tasks: TaskItem[];
  workspaceName: string;
  nickname: string;
  maxItems?: number;
}) {
  const bridge = getBridge();
  if (!bridge?.setWidgetData) return false;

  const payload: WidgetPayload = {
    generated_at: new Date().toISOString(),
    workspace_name: params.workspaceName,
    nickname: params.nickname,
    tasks: pickTasksForWidget(params.tasks ?? [], Math.max(1, params.maxItems ?? 180)),
  };

  try {
    await bridge.setWidgetData(JSON.stringify(payload));
    if (bridge.reloadAllTimelines) {
      await bridge.reloadAllTimelines();
    }
    return true;
  } catch {
    return false;
  }
}

export async function clearWidgetData() {
  const bridge = getBridge();
  if (!bridge?.clearWidgetData) return false;
  try {
    await bridge.clearWidgetData();
    if (bridge.reloadAllTimelines) {
      await bridge.reloadAllTimelines();
    }
    return true;
  } catch {
    return false;
  }
}
