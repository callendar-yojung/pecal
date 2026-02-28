import type { TaskItem } from './types';

export function toDateKey(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export function getWeekDays(baseDate: Date) {
  const start = new Date(baseDate);
  start.setDate(baseDate.getDate() - baseDate.getDay());
  return Array.from({ length: 7 }, (_, idx) => {
    const day = new Date(start);
    day.setDate(start.getDate() + idx);
    return day;
  });
}

export function defaultTaskRangeByDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return {
    start: `${yyyy}-${mm}-${dd}T09:00:00`,
    end: `${yyyy}-${mm}-${dd}T09:30:00`,
  };
}

export function groupTasksByDate(tasks: TaskItem[]) {
  const grouped: Record<string, TaskItem[]> = {};

  const parseDate = (value: string) => {
    if (!value) return null;
    const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    const fallback = value.slice(0, 10);
    const fallbackParsed = new Date(`${fallback}T00:00:00`);
    return Number.isNaN(fallbackParsed.getTime()) ? null : fallbackParsed;
  };

  const atStartOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate());

  for (const task of tasks) {
    const start = parseDate(task.start_time);
    const end = parseDate(task.end_time || task.start_time);

    if (!start) {
      const fallbackKey = task.start_time.slice(0, 10);
      if (!grouped[fallbackKey]) grouped[fallbackKey] = [];
      grouped[fallbackKey].push(task);
      continue;
    }

    const rangeStart = atStartOfDay(start);
    const rangeEnd = atStartOfDay(end && end >= start ? end : start);
    const cursor = new Date(rangeStart);

    while (cursor <= rangeEnd) {
      const key = toDateKey(cursor);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return grouped;
}
