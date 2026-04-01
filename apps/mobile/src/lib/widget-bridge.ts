import { NativeModules, Platform } from 'react-native';
import { getKoreanSpecialDaysForDateParts } from '@repo/utils';
import type { TaskItem } from './types';

type WidgetTask = {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  color: string;
};

type WidgetWorkspace = {
  workspace_id: number;
  workspace_name: string;
  tasks: WidgetTask[];
};

type WidgetPayload = {
  generated_at: string;
  nickname: string;
  theme?: 'light' | 'dark';
  api_base_url?: string;
  access_token?: string;
  refresh_token?: string;
  member_id?: number;
  workspace_name?: string;
  tasks?: WidgetTask[];
  workspaces?: WidgetWorkspace[];
  special_days_by_date?: Record<string, string[]>;
};

type WidgetBridgeModule = {
  setWidgetData?: (jsonPayload: string) => Promise<boolean> | boolean | void;
  clearWidgetData?: () => Promise<boolean> | boolean | void;
  reloadAllTimelines?: () => Promise<boolean> | boolean | void;
};

function getBridge(): WidgetBridgeModule | null {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
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
      end: parseDate(task.end_time) ?? parseDate(task.start_time),
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

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function buildSpecialDaysByDateMap(referenceDate = new Date()) {
  const map: Record<string, string[]> = {};
  const startYear = referenceDate.getFullYear() - 1;
  const endYear = referenceDate.getFullYear() + 1;

  for (let year = startYear; year <= endYear; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const daysInMonth = new Date(year, month, 0).getDate();
      for (let day = 1; day <= daysInMonth; day += 1) {
        const labels = getKoreanSpecialDaysForDateParts(year, month, day).map((item) => item.name);
        if (labels.length === 0) continue;
        map[formatDateKey(year, month, day)] = labels;
      }
    }
  }

  return map;
}

export async function syncWidgetData(params: {
  tasks: TaskItem[];
  workspaceName?: string;
  nickname: string;
  apiBaseUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  memberId?: number;
  themeMode?: 'light' | 'black';
  maxItems?: number;
  workspaces?: Array<{
    workspaceId: number;
    workspaceName: string;
    tasks: TaskItem[];
  }>;
}) {
  const bridge = getBridge();
  if (!bridge?.setWidgetData) return false;

  const payload: WidgetPayload = {
    generated_at: new Date().toISOString(),
    nickname: params.nickname,
    theme: params.themeMode === 'black' ? 'dark' : 'light',
    api_base_url: params.apiBaseUrl,
    access_token: params.accessToken,
    member_id: params.memberId,
    workspace_name: params.workspaceName,
    tasks: pickTasksForWidget(params.tasks ?? [], Math.max(1, params.maxItems ?? 180)),
    workspaces: (params.workspaces ?? [])
      .filter((workspace) => Number.isFinite(workspace.workspaceId) && workspace.workspaceId > 0)
      .map((workspace) => ({
        workspace_id: workspace.workspaceId,
        workspace_name: workspace.workspaceName || `Workspace ${workspace.workspaceId}`,
        tasks: pickTasksForWidget(
          workspace.tasks ?? [],
          Math.max(1, params.maxItems ?? 180)
        ),
      })),
    special_days_by_date: buildSpecialDaysByDateMap(new Date()),
  };

  if (!payload.workspaces?.length && params.workspaceName) {
    payload.workspaces = [
      {
        workspace_id: 0,
        workspace_name: params.workspaceName,
        tasks: payload.tasks ?? [],
      },
    ];
  }

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
