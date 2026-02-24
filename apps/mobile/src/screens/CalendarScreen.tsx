import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { TagItem, TaskItem } from '../lib/types';
import { getTaskAccentColor, getTaskStatusColor } from '../lib/task-colors';
import { useThemeMode } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { createStyles } from '../styles/createStyles';

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

type Props = {
  selectedDate: Date;
  tasksByDate: Record<string, TaskItem[]>;
  tags: TagItem[];
  activeTaskId: number | null;
  onSelectDate: (date: Date) => void;
  onSelectTask: (taskId: number) => void;
  onGoToday: () => void;
  onOpenTaskFromDate: (date: Date) => void;
  onOpenTask?: (taskId: number) => void;
  onShiftTask?: (taskId: number, minutes: number) => void;
  onResizeTask?: (taskId: number, endDeltaMinutes: number) => void;
};

export function CalendarScreen({
  selectedDate,
  tasksByDate,
  tags,
  activeTaskId,
  onSelectDate,
  onSelectTask,
  onGoToday,
  onOpenTaskFromDate,
  onOpenTask,
  onShiftTask,
  onResizeTask,
}: Props) {
  const { colors } = useThemeMode();
  const { t, locale } = useI18n();
  const s = createStyles(colors);
  const WEEKDAYS = locale === 'ko' ? ['일', '월', '화', '수', '목', '금', '토'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const MONTHS = locale === 'ko'
    ? ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const [year, setYear] = useState(selectedDate.getFullYear());
  const [month, setMonth] = useState(selectedDate.getMonth());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const daysInPrevMonth = getDaysInMonth(year, month - 1);

  const cells: { day: number; isCurrentMonth: boolean; dateStr: string; dateObj: Date }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevMonth = month === 0 ? 12 : month;
    const prevYear = month === 0 ? year - 1 : year;
    const dateStr = `${prevYear}-${pad2(prevMonth)}-${pad2(d)}`;
    cells.push({ day: d, isCurrentMonth: false, dateStr, dateObj: new Date(prevYear, prevMonth - 1, d) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${pad2(month + 1)}-${pad2(d)}`;
    cells.push({ day: d, isCurrentMonth: true, dateStr, dateObj: new Date(year, month, d) });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const nextMonth = month === 11 ? 1 : month + 2;
    const nextYear = month === 11 ? year + 1 : year;
    const dateStr = `${nextYear}-${pad2(nextMonth)}-${pad2(d)}`;
    cells.push({ day: d, isCurrentMonth: false, dateStr, dateObj: new Date(nextYear, nextMonth - 1, d) });
  }

  const rows: typeof cells[] = [];
  for (let i = 0; i < 6; i++) rows.push(cells.slice(i * 7, i * 7 + 7));

  const schedulesByDate = useMemo(() => tasksByDate, [tasksByDate]);

  const prevMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const monthKey = `${year}-${pad2(month + 1)}`;
  const monthTasks = Object.entries(schedulesByDate)
    .filter(([key]) => key.startsWith(monthKey))
    .flatMap(([, arr]) => arr)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const selectedDateKey = `${selectedDate.getFullYear()}-${pad2(selectedDate.getMonth() + 1)}-${pad2(selectedDate.getDate())}`;
  const selectedDayTasks = (schedulesByDate[selectedDateKey] ?? []).sort((a, b) => a.start_time.localeCompare(b.start_time));

  const weekDates = useMemo(() => {
    const base = new Date(selectedDate);
    const start = new Date(base);
    start.setDate(base.getDate() - base.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable style={s.headerActionButton} onPress={prevMonth}><Text style={s.headerActionText}>◀</Text></Pressable>
        <Pressable onPress={() => {
          onGoToday();
          setYear(today.getFullYear());
          setMonth(today.getMonth());
        }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 }}>{year}년 {MONTHS[month]}</Text>
        </Pressable>
        <Pressable style={s.headerActionButton} onPress={nextMonth}><Text style={s.headerActionText}>▶</Text></Pressable>
      </View>

      <View style={s.row}>
        {([
          { key: 'month', label: '월' },
          { key: 'week', label: '주' },
          { key: 'day', label: '일' },
        ] as const).map((mode) => (
          <Pressable
            key={mode.key}
            onPress={() => setViewMode(mode.key)}
            style={[
              s.workspacePill,
              { marginRight: 0, paddingVertical: 7, paddingHorizontal: 12 },
              viewMode === mode.key ? s.workspacePillActive : null,
            ]}
          >
            <Text style={[s.workspacePillText, viewMode === mode.key ? s.workspacePillTextActive : null]}>{mode.label}</Text>
          </Pressable>
        ))}
      </View>

      {viewMode === 'month' ? (
        <View style={{ borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.card }}>
        <View style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
          {WEEKDAYS.map((d, i) => (
            <View key={d} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: i === 0 ? '#EF4444' : i === 6 ? '#5B6CF6' : colors.textMuted }}>{d}</Text>
            </View>
          ))}
        </View>

        {rows.map((row, rowIdx) => (
          <View key={rowIdx} style={{ flexDirection: 'row', borderBottomWidth: rowIdx < 5 ? 0.5 : 0, borderBottomColor: colors.border }}>
            {row.map((cell, colIdx) => {
              const isToday = cell.dateStr === todayStr;
              const schedules = schedulesByDate[cell.dateStr] ?? [];
              const daySchedules = schedules
                .slice()
                .sort((a, b) => a.start_time.localeCompare(b.start_time));
              const visibleSchedules = daySchedules.slice(0, 2);
              const hiddenCount = Math.max(0, daySchedules.length - visibleSchedules.length);
              const isWeekend = colIdx === 0 || colIdx === 6;
              return (
                <Pressable
                  key={cell.dateStr}
                  onPress={() => {
                    onSelectDate(cell.dateObj);
                    onOpenTaskFromDate(cell.dateObj);
                  }}
                  style={{
                    flex: 1,
                    minHeight: 92,
                    paddingTop: 6,
                    paddingBottom: 6,
                    paddingHorizontal: 4,
                    gap: 4,
                    borderRightWidth: colIdx < 6 ? 0.5 : 0,
                    borderRightColor: colors.border,
                  }}
                >
                  <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? colors.primary : 'transparent' }}>
                    <Text style={{ fontSize: 13, fontWeight: isToday ? '800' : '500', color: isToday ? '#fff' : !cell.isCurrentMonth ? colors.border : isWeekend ? (colIdx === 0 ? '#EF4444' : '#5B6CF6') : colors.text }}>{cell.day}</Text>
                  </View>
                  {visibleSchedules.map((task) => (
                    <View
                      key={task.id}
                      style={{
                        width: '100%',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: `${getTaskAccentColor(task)}55`,
                        backgroundColor: `${getTaskAccentColor(task)}22`,
                        paddingHorizontal: 5,
                        paddingVertical: 3,
                      }}
                    >
                      <Text style={{ fontSize: 9, lineHeight: 11, color: colors.text, fontWeight: '700' }} numberOfLines={1}>
                        {task.title}
                      </Text>
                    </View>
                  ))}
                  {hiddenCount > 0 ? (
                    <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: '700' }}>+{hiddenCount} more</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
        </View>
      ) : null}

      {viewMode === 'week' ? (
        <View style={[s.panel, { borderRadius: 16, gap: 8 }]}>
          {weekDates.map((date) => {
            const key = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
            const items = schedulesByDate[key] ?? [];
            return (
              <View key={key} style={{ gap: 6 }}>
                <Text style={[s.formTitle, { fontSize: 13 }]}>
                  {date.getMonth() + 1}/{date.getDate()} ({WEEKDAYS[date.getDay()]}) · {items.length}
                </Text>
                {items.slice(0, 3).map((task) => (
                  <Pressable key={task.id} onPress={() => onOpenTask?.(task.id)} style={[s.listRow, { borderLeftWidth: 4, borderLeftColor: getTaskAccentColor(task) }]}>
                    <Text style={s.itemTitle}>{task.title}</Text>
                    <Text style={s.itemMeta}>{task.start_time.slice(11, 16)} - {task.end_time.slice(11, 16)}</Text>
                  </Pressable>
                ))}
                {!items.length ? <Text style={s.itemMeta}>일정 없음</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {viewMode === 'day' ? (
        <View style={[s.panel, { borderRadius: 16, gap: 8 }]}>
          <Text style={[s.formTitle, { fontSize: 14 }]}>
            {selectedDate.getFullYear()}-{pad2(selectedDate.getMonth() + 1)}-{pad2(selectedDate.getDate())}
          </Text>
          {selectedDayTasks.map((task) => (
            <View key={task.id} style={[s.listRow, { borderLeftWidth: 4, borderLeftColor: getTaskAccentColor(task) }]}>
              <Pressable onPress={() => onOpenTask?.(task.id)} style={{ gap: 4 }}>
                <Text style={s.itemTitle}>{task.title}</Text>
                <Text style={s.itemMeta}>{task.start_time.slice(11, 16)} - {task.end_time.slice(11, 16)}</Text>
              </Pressable>
              <View style={s.row}>
                <Pressable style={s.workspacePill} onPress={() => onShiftTask?.(task.id, -30)}>
                  <Text style={s.workspacePillText}>-30m 이동</Text>
                </Pressable>
                <Pressable style={s.workspacePill} onPress={() => onShiftTask?.(task.id, 30)}>
                  <Text style={s.workspacePillText}>+30m 이동</Text>
                </Pressable>
                <Pressable style={s.workspacePill} onPress={() => onResizeTask?.(task.id, -30)}>
                  <Text style={s.workspacePillText}>-30m 축소</Text>
                </Pressable>
                <Pressable style={s.workspacePill} onPress={() => onResizeTask?.(task.id, 30)}>
                  <Text style={s.workspacePillText}>+30m 확장</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {!selectedDayTasks.length ? <Text style={s.emptyText}>선택한 날짜 일정이 없습니다.</Text> : null}
        </View>
      ) : null}

    </ScrollView>
  );
}
