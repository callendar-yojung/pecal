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

type RecurrenceRule = {
  start_date: string;
  end_date: string;
  weekdays: number[];
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

function parseDateOnly(input: string | undefined | null) {
  if (!input || input.length < 10) return null;
  const match = input.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function toDateKey(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function extractTimePart(input: string | undefined | null, fallback: string) {
  if (!input) return fallback;
  const match = input.match(/[T ](\d{2}:\d{2}(?::\d{2})?)/);
  return match?.[1] ?? fallback;
}

function normalizeWeekdays(input: unknown) {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    ),
  ).sort((a, b) => a - b);
}

function getTaskRecurrence(task: TaskItem): RecurrenceRule | null {
  if (task.recurrence) {
    const weekdays = normalizeWeekdays(task.recurrence.weekdays);
    if (task.recurrence.start_date && task.recurrence.end_date && weekdays.length > 0) {
      return {
        start_date: task.recurrence.start_date.slice(0, 10),
        end_date: task.recurrence.end_date.slice(0, 10),
        weekdays,
      };
    }
  }

  if (!task.rrule) return null;
  try {
    const parsed = JSON.parse(task.rrule) as {
      type?: string;
      start_date?: string;
      end_date?: string;
      weekdays?: unknown;
    } | null;
    const weekdays = normalizeWeekdays(parsed?.weekdays);
    if (
      parsed?.type === 'WEEKLY_RANGE' &&
      parsed.start_date &&
      parsed.end_date &&
      weekdays.length > 0
    ) {
      return {
        start_date: parsed.start_date.slice(0, 10),
        end_date: parsed.end_date.slice(0, 10),
        weekdays,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function buildWidgetTask(task: TaskItem, startTime = task.start_time, endTime = task.end_time): WidgetTask {
  return {
    id: task.id,
    title: task.title || '제목 없음',
    start_time: startTime,
    end_time: endTime,
    status: task.status ?? 'TODO',
    color: task.color ?? '#5B6CFF',
  };
}

function expandRecurringTasksForRange(tasks: TaskItem[], rangeStart: Date, rangeEnd: Date) {
  const expanded: WidgetTask[] = [];
  const recurringTasksById = new Map<number, TaskItem>();
  const recurringIds = new Set<number>();

  tasks.forEach((task) => {
    if (getTaskRecurrence(task)) {
      recurringIds.add(task.id);
      if (!recurringTasksById.has(task.id)) {
        recurringTasksById.set(task.id, task);
      }
    }
  });

  recurringTasksById.forEach((task) => {
    const recurrence = getTaskRecurrence(task);
    if (!recurrence) return;

    const recurrenceStart = parseDateOnly(recurrence.start_date);
    const recurrenceEnd = parseDateOnly(recurrence.end_date);
    if (!recurrenceStart || !recurrenceEnd || recurrenceStart > recurrenceEnd) return;

    const start = recurrenceStart > rangeStart ? recurrenceStart : rangeStart;
    const end = recurrenceEnd < rangeEnd ? recurrenceEnd : rangeEnd;
    if (start > end) return;

    const startTimePart = extractTimePart(task.start_time, '09:00:00');
    const endTimePart = extractTimePart(task.end_time || task.start_time, startTimePart);
    const cursor = new Date(start);
    while (cursor <= end) {
      if (recurrence.weekdays.includes(cursor.getDay())) {
        const key = toDateKey(cursor);
        expanded.push(buildWidgetTask(task, `${key}T${startTimePart}`, `${key}T${endTimePart}`));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  tasks.forEach((task) => {
    if (!recurringIds.has(task.id)) {
      expanded.push(buildWidgetTask(task));
    }
  });

  return expanded;
}

function pickTasksForWidget(tasks: TaskItem[], limit: number): WidgetTask[] {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const widgetTasks = expandRecurringTasksForRange(tasks, monthStart, monthEnd);

  const normalized = widgetTasks
    .map((task) => ({
      task,
      start: parseDate(task.start_time),
      end: parseDate(task.end_time) ?? parseDate(task.start_time),
    }))
    .filter((item): item is { task: WidgetTask; start: Date; end: Date } => !!item.start && !!item.end)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const inCurrentMonth = normalized.filter(({ start, end }) => end >= monthStart && start <= monthEnd);
  const selected = (inCurrentMonth.length > 0 ? inCurrentMonth : normalized).slice(0, limit);

  return selected.map(({ task }) => task);
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
  themeMode?: 'light' | 'dark';
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
    theme: params.themeMode === 'dark' ? 'dark' : 'light',
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
