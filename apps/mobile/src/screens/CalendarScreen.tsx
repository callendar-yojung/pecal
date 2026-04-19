import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, PanResponder, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { getKoreanSpecialDaysForDateKey } from '@repo/utils';
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

function dateKeyFromDateTime(value: string) {
  if (!value) return '';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
}

function parseDateTime(value: string): Date | null {
  if (!value) return null;
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const CALENDAR_SWIPE_HINT_KEY = 'mobile_calendar_swipe_hint_seen_v1';

type Props = {
  selectedDate: Date;
  tasksByDate: Record<string, TaskItem[]>;
  tags: TagItem[];
  activeTaskId: number | null;
  onSelectDate: (date: Date) => void;
  onSelectTask: (taskId: number) => void;
  onGoToday: () => void;
  onOpenTaskFromDate: (date: Date) => void;
  onCreateTaskFromDate?: (date: Date) => void;
  onOpenTask?: (taskId: number) => void;
  onShiftTask?: (taskId: number, minutes: number) => void;
  onResizeTask?: (taskId: number, endDeltaMinutes: number) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
};

type MultiDaySegment = {
  key: string;
  task: TaskItem;
  row: number;
  startCol: number;
  endCol: number;
  lane: number;
  isStart: boolean;
  isEnd: boolean;
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
  onCreateTaskFromDate,
  onOpenTask,
  onShiftTask,
  onResizeTask,
  refreshing = false,
  onRefresh,
}: Props) {
  const { colors, appearance } = useThemeMode();
  const { t, locale } = useI18n();
  const { width: screenWidth } = useWindowDimensions();
  const s = createStyles(colors);
  const isDark = appearance === 'dark';
  const ui = {
    surface: colors.card,
    surfaceSoft: colors.cardSoft,
    border: colors.border,
    text: colors.text,
    subText: colors.textMuted,
    primary: colors.primary,
    shadowOpacity: isDark ? 0.18 : 0.03,
  };
  const WEEKDAYS = locale === 'ko' ? ['일', '월', '화', '수', '목', '금', '토'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const MONTHS = locale === 'ko'
    ? ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const [year, setYear] = useState(selectedDate.getFullYear());
  const [month, setMonth] = useState(selectedDate.getMonth());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'timetable'>('month');
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [openMoreDateKey, setOpenMoreDateKey] = useState<string | null>(null);
  const monthSlideX = useRef(new Animated.Value(0)).current;
  const weekSlideX = useRef(new Animated.Value(0)).current;
  const multiBarHeight = 16;
  const cellPaddingTop = 6;
  const dayBadgeHeight = 44;
  const specialDayLineHeight = locale === 'ko' ? 10 : 0;
  const dayHeaderHeight = dayBadgeHeight + specialDayLineHeight;
  // 일반일정 시작 위치(다일정이 없을 때도 적용)
  const singleScheduleBaseTopGap = 0;
  // 다일정 영역 아래 일반일정과의 추가 간격(다일정이 있을 때만 적용)
  const singleScheduleGapAfterMulti = 5;
  const multiBarTopOffset = cellPaddingTop + dayHeaderHeight;
  const multiBarLaneGap = 5;

  useEffect(() => {
    setYear(selectedDate.getFullYear());
    setMonth(selectedDate.getMonth());
  }, [selectedDate]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(CALENDAR_SWIPE_HINT_KEY);
        if (!alive || seen === '1') return;
        setShowSwipeHint(true);
      } catch {
        if (alive) setShowSwipeHint(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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
  const allTasks = useMemo(() => {
    const map = new Map<number, TaskItem>();
    Object.values(schedulesByDate).forEach((dayTasks) => {
      dayTasks.forEach((task) => {
        map.set(task.id, task);
      });
    });
    return Array.from(map.values());
  }, [schedulesByDate]);

  const singleDaySchedulesByDate = useMemo(() => {
    const result: Record<string, TaskItem[]> = {};
    Object.entries(schedulesByDate).forEach(([dateKey, dayTasks]) => {
      const singleDay = dayTasks
        .filter((task) => {
          const startKey = dateKeyFromDateTime(task.start_time);
          const endKey = dateKeyFromDateTime(task.end_time || task.start_time);
          return !!startKey && startKey === endKey;
        })
        .slice()
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
      result[dateKey] = singleDay;
    });
    return result;
  }, [schedulesByDate]);

  const multiDaySegments = useMemo(() => {
    const segments: MultiDaySegment[] = [];
    if (!cells.length) return segments;

    const firstVisibleKey = cells[0].dateStr;
    const lastVisibleKey = cells[cells.length - 1].dateStr;
    const dayIndex = new Map<string, number>();
    cells.forEach((cell, idx) => {
      dayIndex.set(cell.dateStr, idx);
    });
    const laneRangesByRow = new Map<number, Array<Array<{ start: number; end: number }>>>();
    const hasOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
      Math.max(aStart, bStart) <= Math.min(aEnd, bEnd);
    const getLane = (row: number, start: number, end: number) => {
      const lanes = laneRangesByRow.get(row) ?? [];
      for (let lane = 0; lane < lanes.length; lane += 1) {
        const conflict = lanes[lane].some((range) => hasOverlap(start, end, range.start, range.end));
        if (!conflict) {
          lanes[lane].push({ start, end });
          laneRangesByRow.set(row, lanes);
          return lane;
        }
      }
      lanes.push([{ start, end }]);
      laneRangesByRow.set(row, lanes);
      return lanes.length - 1;
    };

    allTasks
      .map((task) => {
        const startKey = dateKeyFromDateTime(task.start_time);
        const endKey = dateKeyFromDateTime(task.end_time || task.start_time);
        return { task, startKey, endKey };
      })
      .filter(({ startKey, endKey }) => !!startKey && !!endKey && endKey > startKey)
      .sort((a, b) => (a.startKey === b.startKey ? a.endKey.localeCompare(b.endKey) : a.startKey.localeCompare(b.startKey)))
      .forEach(({ task, startKey, endKey }) => {
        const rangeStart = startKey < firstVisibleKey ? firstVisibleKey : startKey;
        const rangeEnd = endKey > lastVisibleKey ? lastVisibleKey : endKey;
        if (rangeEnd < rangeStart) return;
        const startIdx = dayIndex.get(rangeStart);
        const endIdx = dayIndex.get(rangeEnd);
        if (startIdx == null || endIdx == null) return;

        const startRow = Math.floor(startIdx / 7);
        const endRow = Math.floor(endIdx / 7);
        for (let row = startRow; row <= endRow; row += 1) {
          const rowStartIdx = row * 7;
          const rowEndIdx = rowStartIdx + 6;
          const segStartIdx = Math.max(startIdx, rowStartIdx);
          const segEndIdx = Math.min(endIdx, rowEndIdx);
          const startCol = segStartIdx % 7;
          const endCol = segEndIdx % 7;
          const lane = getLane(row, startCol, endCol);
          segments.push({
            key: `${task.id}-${row}-${startCol}-${endCol}-${lane}`,
            task,
            row,
            startCol,
            endCol,
            lane,
            isStart: segStartIdx === startIdx,
            isEnd: segEndIdx === endIdx,
          });
        }
      });

    return segments;
  }, [allTasks, cells]);

  const mergedMultiDaySegmentsByRow = useMemo(() => {
    const byRow = new Map<number, MultiDaySegment[]>();
    multiDaySegments.forEach((segment) => {
      const rowSegments = byRow.get(segment.row) ?? [];
      rowSegments.push(segment);
      byRow.set(segment.row, rowSegments);
    });

    const result = new Map<number, MultiDaySegment[]>();
    byRow.forEach((segments, row) => {
      const sorted = segments
        .slice()
        .sort((a, b) => (a.startCol === b.startCol ? a.endCol - b.endCol : a.startCol - b.startCol));

      const merged: MultiDaySegment[] = [];
      for (const segment of sorted) {
        const last = merged[merged.length - 1];
        const sameVisualTask =
          !!last &&
          last.task.title === segment.task.title &&
          getTaskAccentColor(last.task) === getTaskAccentColor(segment.task);
        const touching = !!last && segment.startCol <= last.endCol + 1;

        if (sameVisualTask && touching) {
          last.endCol = Math.max(last.endCol, segment.endCol);
          last.isStart = last.isStart || segment.isStart;
          last.isEnd = last.isEnd || segment.isEnd;
          last.lane = Math.min(last.lane, segment.lane);
          continue;
        }
        merged.push({ ...segment });
      }
      result.set(row, merged);
    });
    return result;
  }, [multiDaySegments]);

  const dismissSwipeHint = useCallback(() => {
    if (!showSwipeHint) return;
    setShowSwipeHint(false);
    void AsyncStorage.setItem(CALENDAR_SWIPE_HINT_KEY, '1').catch(() => undefined);
  }, [showSwipeHint]);

  const shiftMonth = useCallback((direction: 'prev' | 'next') => {
    const monthDelta = direction === 'next' ? 1 : -1;
    const pivot = new Date(year, month + monthDelta, 1);
    const nextYear = pivot.getFullYear();
    const nextMonth = pivot.getMonth();
    const preferredDay = selectedDate.getDate();
    const maxDay = getDaysInMonth(nextYear, nextMonth);
    const nextDay = Math.min(preferredDay, maxDay);

    setYear(nextYear);
    setMonth(nextMonth);
    onSelectDate(new Date(nextYear, nextMonth, nextDay));
  }, [month, onSelectDate, selectedDate, year]);
  const shiftWeek = useCallback((direction: 'prev' | 'next') => {
    const dayDelta = direction === 'next' ? 7 : -7;
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + dayDelta);
    onSelectDate(nextDate);
    setYear(nextDate.getFullYear());
    setMonth(nextDate.getMonth());
  }, [onSelectDate, selectedDate]);

  const monthSwipeResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        viewMode === 'month' && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 14,
      onPanResponderTerminationRequest: () => true,
      onPanResponderGrant: () => {
        dismissSwipeHint();
      },
      onPanResponderMove: (_, gestureState) => {
        const clampedDx = Math.max(-screenWidth, Math.min(screenWidth, gestureState.dx));
        monthSlideX.setValue(clampedDx);
      },
      onPanResponderRelease: (_, gestureState) => {
        const absDx = Math.abs(gestureState.dx);
        const shouldSwipe =
          (absDx >= Math.max(46, screenWidth * 0.12) || Math.abs(gestureState.vx) >= 0.25) &&
          absDx > Math.abs(gestureState.dy);
        if (shouldSwipe) {
          const goNext = gestureState.dx < 0;
          const exitDistance = screenWidth + 36;
          const exitTo = goNext ? -exitDistance : exitDistance;
          Animated.timing(monthSlideX, {
            toValue: exitTo,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            shiftMonth(goNext ? 'next' : 'prev');
            monthSlideX.setValue(-exitTo);
            Animated.spring(monthSlideX, {
              toValue: 0,
              useNativeDriver: true,
              damping: 18,
              stiffness: 190,
              mass: 0.9,
            }).start();
          });
          return;
        }
        Animated.spring(monthSlideX, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 220,
          mass: 0.8,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(monthSlideX, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 220,
          mass: 0.8,
        }).start();
      },
    }),
    [dismissSwipeHint, monthSlideX, screenWidth, shiftMonth, viewMode],
  );
  const weekSwipeResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        (viewMode === 'week' || viewMode === 'timetable') &&
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
        Math.abs(gestureState.dx) > 14,
      onPanResponderTerminationRequest: () => true,
      onPanResponderMove: (_, gestureState) => {
        const clampedDx = Math.max(-screenWidth, Math.min(screenWidth, gestureState.dx));
        weekSlideX.setValue(clampedDx);
      },
      onPanResponderRelease: (_, gestureState) => {
        const absDx = Math.abs(gestureState.dx);
        const shouldSwipe =
          (absDx >= Math.max(46, screenWidth * 0.12) || Math.abs(gestureState.vx) >= 0.25) &&
          absDx > Math.abs(gestureState.dy);
        if (shouldSwipe) {
          const goNext = gestureState.dx < 0;
          const exitDistance = screenWidth + 36;
          const exitTo = goNext ? -exitDistance : exitDistance;
          Animated.timing(weekSlideX, {
            toValue: exitTo,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            shiftWeek(goNext ? 'next' : 'prev');
            weekSlideX.setValue(-exitTo);
            Animated.spring(weekSlideX, {
              toValue: 0,
              useNativeDriver: true,
              damping: 18,
              stiffness: 190,
              mass: 0.9,
            }).start();
          });
          return;
        }
        Animated.spring(weekSlideX, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 220,
          mass: 0.8,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(weekSlideX, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 220,
          mass: 0.8,
        }).start();
      },
    }),
    [screenWidth, shiftWeek, viewMode, weekSlideX],
  );

  const monthKey = `${year}-${pad2(month + 1)}`;
  const monthTasks = Object.entries(schedulesByDate)
    .filter(([key]) => key.startsWith(monthKey))
    .flatMap(([, arr]) => arr)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const selectedDateKey = `${selectedDate.getFullYear()}-${pad2(selectedDate.getMonth() + 1)}-${pad2(selectedDate.getDate())}`;
  const selectedDayTasks = (schedulesByDate[selectedDateKey] ?? []).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const moreSheetTasks = useMemo(() => {
    if (!openMoreDateKey) return [];
    const daySchedules = (schedulesByDate[openMoreDateKey] ?? [])
      .slice()
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    return daySchedules.slice(2);
  }, [openMoreDateKey, schedulesByDate]);

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
  const weekRangeLabel = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[weekDates.length - 1];
    if (!start || !end) return '';
    const startLabel = `${start.getMonth() + 1}/${start.getDate()}`;
    const endLabel = `${end.getMonth() + 1}/${end.getDate()}`;
    return `${startLabel} - ${endLabel}`;
  }, [weekDates]);

  const timetableWeekDates = useMemo(
    () => weekDates.filter((date) => date.getDay() !== 0), // 월~토 (일요일 제외)
    [weekDates],
  );

  const timetableStartHour = 8;
  const timetableEndHour = 23;
  const timetableSlotHeight = 48;
  const timetableTimeColWidth = 22;
  const timetableContentHorizontalPadding = 16 * 2;
  const timetablePanelInnerHorizontalPadding = 10 * 2;
  const timetableVisibleDayCount = Math.max(1, timetableWeekDates.length);
  const timetableFrameWidth = Math.max(
    280,
    screenWidth - timetableContentHorizontalPadding - timetablePanelInnerHorizontalPadding - 2,
  );
  const timetableDayColWidth = Math.max(
    42,
    Math.floor((timetableFrameWidth - timetableTimeColWidth) / timetableVisibleDayCount),
  );
  const timetableGridWidth = timetableDayColWidth * timetableVisibleDayCount;
  const timetableHours = useMemo(
    () => Array.from({ length: timetableEndHour - timetableStartHour + 1 }, (_, i) => timetableStartHour + i),
    [timetableEndHour, timetableStartHour],
  );
  const timetableGridHeight = (timetableEndHour - timetableStartHour) * timetableSlotHeight;
  const formatHourLabel = (hour24: number) => String(hour24).padStart(2, '0');

  const timetableDayColumns = useMemo(() => {
    return timetableWeekDates.map((date) => {
      const key = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
      const tasks = (schedulesByDate[key] ?? [])
        .map((task) => {
          const start = parseDateTime(task.start_time);
          const end = parseDateTime(task.end_time || task.start_time) ?? start;
          if (!start || !end) return null;
          return { task, start, end };
        })
        .filter((item): item is { task: TaskItem; start: Date; end: Date } => !!item)
        .sort((a, b) => a.start.getTime() - b.start.getTime());
      return { date, key, tasks };
    });
  }, [schedulesByDate, timetableWeekDates]);

  const allowPullToRefresh = viewMode !== 'month';
  const viewModeOptions = [
    { key: 'month' as const, label: locale === 'ko' ? '월' : 'Month' },
    { key: 'week' as const, label: locale === 'ko' ? '주' : 'Week' },
    { key: 'timetable' as const, label: locale === 'ko' ? '표' : 'Table' },
  ];
  const [viewModeMenuOpen, setViewModeMenuOpen] = useState(false);
  const currentViewModeLabel =
    viewModeOptions.find((option) => option.key === viewMode)?.label ?? (locale === 'ko' ? '월' : 'Month');
  const renderMiniTaskCard = (task: TaskItem, key: string) => (
    <Pressable
      key={key}
      onPress={() => onOpenTask?.(task.id)}
      style={[
        styles.miniTaskCard,
        {
          borderColor: ui.border,
          backgroundColor: ui.surface,
          shadowColor: '#000',
          shadowOpacity: ui.shadowOpacity,
        },
      ]}
    >
      <View style={styles.miniTaskTop}>
        <View
          style={[
            styles.miniTaskAccent,
            { backgroundColor: getTaskAccentColor(task) },
          ]}
        />
        <View style={styles.miniTaskMain}>
          <Text style={[styles.miniTaskTitle, { color: ui.text }]} numberOfLines={1}>
            {task.title}
          </Text>
          <Text style={[styles.miniTaskTime, { color: ui.subText }]} numberOfLines={1}>
            {task.start_time.slice(11, 16)} - {task.end_time.slice(11, 16)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
  const renderTimetableBoard = () => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        <View style={{ width: timetableTimeColWidth }} />
        {timetableDayColumns.map(({ date, key }) => {
          const isToday = key === todayStr;
          return (
            <View
              key={`header-${key}`}
              style={{ width: timetableDayColWidth, alignItems: 'center', paddingVertical: 6 }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted }}>
                {WEEKDAYS[date.getDay()]}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: isToday ? '800' : '700', color: isToday ? colors.primary : colors.text }}>
                {date.getMonth() + 1}/{date.getDate()}
              </Text>
            </View>
          );
        })}
      </View>

      <ScrollView
        style={{ maxHeight: 420 }}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: timetableTimeColWidth }}>
            {timetableHours.map((hour, idx) => (
              <View
                key={`hour-${hour}`}
                style={{
                  height: idx === timetableHours.length - 1 ? timetableSlotHeight : timetableSlotHeight,
                  justifyContent: 'flex-start',
                  paddingTop: 2,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted }}>
                  {String(hour)}
                </Text>
              </View>
            ))}
          </View>
          <View
            style={{
              width: timetableGridWidth,
              height: timetableGridHeight,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              overflow: 'hidden',
              backgroundColor: colors.card,
            }}
          >
            {Array.from({ length: timetableEndHour - timetableStartHour + 1 }, (_, i) => (
              <View
                key={`line-${i}`}
                style={{
                  position: 'absolute',
                  top: i * timetableSlotHeight,
                  left: 0,
                  right: 0,
                  borderTopWidth: i === 0 ? 0 : 0.5,
                  borderTopColor: colors.border,
                }}
              />
            ))}
            {Array.from({ length: timetableDayColumns.length - 1 }, (_, i) => (
              <View
                key={`vline-${i}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: (i + 1) * timetableDayColWidth,
                  borderLeftWidth: 0.5,
                  borderLeftColor: colors.border,
                }}
              />
            ))}

            {timetableDayColumns.map((column, dayIndex) => (
              <React.Fragment key={`col-${column.key}`}>
                {column.tasks.map(({ task, start, end }) => {
                  const startMinutes = start.getHours() * 60 + start.getMinutes();
                  const endMinutesRaw = end.getHours() * 60 + end.getMinutes();
                  const effectiveEndMinutes = endMinutesRaw <= startMinutes ? startMinutes + 30 : endMinutesRaw;
                  const clipStart = Math.max(startMinutes, timetableStartHour * 60);
                  const clipEnd = Math.min(effectiveEndMinutes, timetableEndHour * 60);
                  if (clipEnd <= clipStart) return null;

                  const top = ((clipStart - timetableStartHour * 60) / 60) * timetableSlotHeight;
                  const height = Math.max(24, ((clipEnd - clipStart) / 60) * timetableSlotHeight);
                  const titleLineHeight = 14;
                  const titleVerticalPadding = 5;
                  const titleMaxLines = Math.max(1, Math.min(4, Math.floor((height - titleVerticalPadding) / titleLineHeight)));
                  const accent = getTaskAccentColor(task);
                  return (
                    <Pressable
                      key={`tt-${column.key}-${task.id}-${task.start_time}`}
                      onPress={() => {
                        onSelectTask(task.id);
                        onOpenTask?.(task.id);
                      }}
                      style={{
                        position: 'absolute',
                        left: dayIndex * timetableDayColWidth + 1,
                        width: timetableDayColWidth - 2,
                        top,
                        height,
                        borderRadius: 8,
                        backgroundColor: `${accent}D8`,
                        paddingHorizontal: 2,
                        paddingVertical: 3,
                        borderWidth: 1,
                        borderColor: `${accent}F0`,
                      }}
                    >
                      <Text style={{ fontSize: 12, lineHeight: titleLineHeight, color: '#fff', fontWeight: '800' }} numberOfLines={titleMaxLines}>
                        {task.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </React.Fragment>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );

  return (
    <ScrollView
      scrollEnabled={allowPullToRefresh}
      alwaysBounceVertical={allowPullToRefresh}
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh && allowPullToRefresh
          ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          : undefined
      }
    >
      <View
        style={[
          styles.headerShell,
          {
            borderColor: ui.border,
            backgroundColor: ui.surface,
            shadowColor: '#000',
            shadowOpacity: ui.shadowOpacity,
          },
        ]}
      >
        <Pressable
          onPress={() => {
            if (refreshing) return;
            onRefresh?.();
          }}
          style={[
            styles.headerSquareButton,
            {
              borderColor: ui.border,
              backgroundColor: ui.surface,
              opacity: refreshing ? 0.6 : 1,
            },
          ]}
          disabled={refreshing}
        >
          <Ionicons name="refresh-outline" size={16} color={ui.subText} />
        </Pressable>
        <Pressable
          onPress={() => {
            onGoToday();
            setYear(today.getFullYear());
            setMonth(today.getMonth());
            setViewModeMenuOpen(false);
          }}
          style={styles.headerTitleWrap}
        >
          <Text style={{ color: ui.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 }}>
            {locale === 'ko' ? `${year}년 ${MONTHS[month]}` : `${MONTHS[month]} ${year}`}
          </Text>
        </Pressable>
        <View style={{ width: 86, height: 44, alignItems: 'flex-end' }}>
          <Pressable
            onPress={() => setViewModeMenuOpen((prev) => !prev)}
            style={[styles.modeChip, { borderColor: ui.border, backgroundColor: ui.surface }]}
          >
            <Text
              style={[styles.modeChipText, { color: ui.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.9}
            >
              {currentViewModeLabel}
            </Text>
            <Ionicons name={viewModeMenuOpen ? 'chevron-up' : 'chevron-down'} size={14} color={ui.subText} />
          </Pressable>
          {viewModeMenuOpen ? (
            <View
              style={{
                position: 'absolute',
                top: 48,
                right: 0,
                borderWidth: 1,
                borderColor: ui.border,
                borderRadius: 14,
                backgroundColor: ui.surface,
                minWidth: 82,
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOpacity: ui.shadowOpacity,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 5,
                zIndex: 30,
              }}
            >
              {viewModeOptions.map((option) => {
                const active = option.key === viewMode;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => {
                      setViewMode(option.key);
                      setViewModeMenuOpen(false);
                    }}
                    style={{
                      minHeight: 40,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      justifyContent: 'center',
                      backgroundColor: active ? `${colors.primary}16` : ui.surface,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? ui.primary : ui.text,
                        fontSize: 13,
                        fontWeight: active ? '800' : '700',
                        textAlign: 'center',
                      }}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>
      {viewMode === 'month' ? (
        <Animated.View
          style={{
            borderRadius: 20,
            borderWidth: 1,
            borderColor: ui.border,
            overflow: 'hidden',
            backgroundColor: ui.surface,
            shadowColor: '#000',
            shadowOpacity: ui.shadowOpacity,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 2,
            transform: [{ translateX: monthSlideX }],
            opacity: monthSlideX.interpolate({
              inputRange: [-280, 0, 280],
              outputRange: [0.92, 1, 0.92],
              extrapolate: 'clamp',
            }),
          }}
          {...monthSwipeResponder.panHandlers}
        >
        {showSwipeHint ? (
          <Pressable
            onPress={dismissSwipeHint}
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              right: 8,
              zIndex: 5,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: ui.primary,
              backgroundColor: ui.surface,
              paddingHorizontal: 12,
              paddingVertical: 9,
              shadowColor: '#000',
              shadowOpacity: 0.12,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 4,
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>
              ↔ {t('calendarSwipeHintTitle')}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
              {t('calendarSwipeHintBody')}
            </Text>
          </Pressable>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            paddingVertical: 10,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.border,
            backgroundColor: colors.cardSoft,
          }}
        >
          {WEEKDAYS.map((d, i) => (
            <View key={d} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: i === 0 ? '#EF4444' : i === 6 ? '#5B6CF6' : colors.textMuted }}>{d}</Text>
            </View>
          ))}
        </View>

        {rows.map((row, rowIdx) => {
          const rowSegments = mergedMultiDaySegmentsByRow.get(rowIdx) ?? [];
          const maxDailyVisible = 3;
          const visibleRowSegments = rowSegments.filter((segment) => segment.lane < maxDailyVisible);

          return (
            <View
              key={rowIdx}
              style={{
                position: 'relative',
                borderBottomWidth: rowIdx < 5 ? 0.5 : 0,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flexDirection: 'row' }}>
                {row.map((cell, colIdx) => {
                  const isToday = cell.dateStr === todayStr;
                  const isSelected = cell.dateStr === selectedDateKey;
                  const daySchedules = (singleDaySchedulesByDate[cell.dateStr] ?? [])
                    .slice()
                    .sort((a, b) => a.start_time.localeCompare(b.start_time));
                  const allMultiEventsOnCell = rowSegments.filter(
                    (segment) => segment.startCol <= colIdx && segment.endCol >= colIdx,
                  ).length;
                  const visibleMultiEventsOnCell = visibleRowSegments.filter(
                    (segment) => segment.startCol <= colIdx && segment.endCol >= colIdx,
                  ).length;
                  const maxSingleVisible = Math.max(0, maxDailyVisible - visibleMultiEventsOnCell);
                  const visibleSchedules = daySchedules.slice(0, maxSingleVisible);
                  const hiddenSingleCount = Math.max(0, daySchedules.length - maxSingleVisible);
                  const hiddenMultiCount = Math.max(0, allMultiEventsOnCell - visibleMultiEventsOnCell);
                  const hiddenCount = hiddenSingleCount + hiddenMultiCount;
                  const hiddenLabel =
                    locale === 'ko' ? `+${hiddenCount}개` : `+${hiddenCount} more`;
                  const cellMultiLaneReservedHeight =
                    visibleMultiEventsOnCell > 0
                      ? visibleMultiEventsOnCell * (multiBarHeight + multiBarLaneGap) - 6
                      : 0;
                  const singleScheduleTopGap =
                    singleScheduleBaseTopGap +
                    (visibleMultiEventsOnCell > 0 ? singleScheduleGapAfterMulti : 0);
                  const isWeekend = colIdx === 0 || colIdx === 6;
                  const specialDayLabel =
                    locale === 'ko' && cell.isCurrentMonth
                      ? getKoreanSpecialDaysForDateKey(cell.dateStr)[0]?.name ?? null
                      : null;
                  return (
                    <Pressable
                      key={cell.dateStr}
                      onPress={() => {
                        onSelectDate(cell.dateObj);
                        onOpenTaskFromDate(cell.dateObj);
                        onCreateTaskFromDate?.(cell.dateObj);
                      }}
                      style={({ pressed }) => ({
                        flex: 1,
                        minHeight: 98,
                        paddingTop: cellPaddingTop,
                        paddingBottom: 6,
                        paddingHorizontal: 4,
                        borderRightWidth: colIdx < 6 ? 0.5 : 0,
                        borderRightColor: colors.border,
                        backgroundColor: pressed ? `${colors.primary}12` : isSelected ? `${colors.primary}08` : 'transparent',
                      })}
                    >
                      <View style={{ height: dayHeaderHeight, justifyContent: 'flex-start', zIndex: 3 }}>
                        <View
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 15,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isToday ? colors.primary : isSelected ? `${colors.primary}14` : 'transparent',
                            borderWidth: isSelected && !isToday ? 1 : 0,
                            borderColor: isSelected && !isToday ? `${colors.primary}30` : 'transparent',
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: isToday || isSelected ? '800' : '500', color: isToday ? '#fff' : !cell.isCurrentMonth ? colors.border : isWeekend ? (colIdx === 0 ? '#EF4444' : '#5B6CF6') : colors.text }}>{cell.day}</Text>
                        </View>
                        {specialDayLabel ? (
                          <Text
                            numberOfLines={1}
                            style={{
                              marginTop: 0,
                              fontSize: 9,
                              lineHeight: specialDayLineHeight,
                              fontWeight: '800',
                              color: '#EF4444',
                              paddingHorizontal: 2,
                            }}
                          >
                            {specialDayLabel}
                          </Text>
                        ) : null}
                      </View>
                      <View style={{ marginTop: singleScheduleTopGap + cellMultiLaneReservedHeight, gap: 4, zIndex: 2 }}>
                        {visibleSchedules.map((task) => (
                          <Pressable
                            key={task.id}
                            onPress={() => {
                              onSelectTask(task.id);
                              onOpenTask?.(task.id);
                            }}
                            style={{
                              width: '100%',
                              backgroundColor: `${getTaskAccentColor(task)}18`,
                              borderWidth: 1,
                              borderColor: `${getTaskAccentColor(task)}22`,
                              paddingHorizontal: 6,
                              paddingVertical: 4,
                              borderRadius: 999,
                            }}
                          >
                            <Text style={{ fontSize: 9, lineHeight: 11, color: colors.text, fontWeight: '700' }} numberOfLines={1}>
                              {task.title}
                            </Text>
                          </Pressable>
                        ))}
                          {hiddenCount > 0 ? (
                            <Pressable
                              onPress={(e) => {
                              e.stopPropagation();
                              setOpenMoreDateKey(cell.dateStr);
                            }}
                              style={{ alignSelf: 'flex-start', paddingHorizontal: 2, paddingVertical: 2 }}
                            >
                              <Text
                                numberOfLines={1}
                                ellipsizeMode="clip"
                                style={{ fontSize: 9, color: colors.primary, fontWeight: '700' }}
                              >
                                {hiddenLabel}
                              </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                {visibleRowSegments.map((segment) => {
                  const spanDays = segment.endCol - segment.startCol + 1;
                  const accentColor = getTaskAccentColor(segment.task);
                  return (
                    <Pressable
                      key={segment.key}
                      onPress={() => {
                        onSelectTask(segment.task.id);
                        onOpenTask?.(segment.task.id);
                      }}
                      style={{
                        position: 'absolute',
                        left: `${(segment.startCol * 100) / 7}%`,
                        width: `${(spanDays * 100) / 7}%`,
                        height: multiBarHeight,
                        top: multiBarTopOffset + segment.lane * (multiBarHeight + multiBarLaneGap),
                        backgroundColor: accentColor,
                        borderTopLeftRadius: segment.isStart ? 6 : 2,
                        borderBottomLeftRadius: segment.isStart ? 6 : 2,
                        borderTopRightRadius: segment.isEnd ? 6 : 2,
                        borderBottomRightRadius: segment.isEnd ? 6 : 2,
                        justifyContent: 'center',
                        paddingHorizontal: 6,
                        zIndex: 1,
                      }}
                    >
                      {segment.isStart || segment.startCol === 0 ? (
                        <Text style={{ fontSize: 9, lineHeight: 11, color: '#fff', fontWeight: '800' }} numberOfLines={1}>
                          {segment.task.title}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
        </Animated.View>
      ) : null}

      {viewMode === 'week' ? (
        <Animated.View
          style={{
            transform: [{ translateX: weekSlideX }],
            opacity: weekSlideX.interpolate({
              inputRange: [-280, 0, 280],
              outputRange: [0.92, 1, 0.92],
              extrapolate: 'clamp',
            }),
          }}
          {...weekSwipeResponder.panHandlers}
        >
        <View
          style={[
            styles.modePanel,
            {
              borderColor: ui.border,
              backgroundColor: ui.surface,
              shadowColor: '#000',
              shadowOpacity: ui.shadowOpacity,
            },
          ]}
        >
          <View style={styles.weekHeaderRow}>
            <Text style={[styles.modePanelTitle, { color: ui.text }]}>{weekRangeLabel}</Text>
            <Text style={[styles.modePanelMeta, { color: ui.subText }]}>
              {locale === 'ko' ? '주간 일정' : 'Weekly schedule'}
            </Text>
          </View>
          {weekDates.map((date) => {
            const key = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
            const items = schedulesByDate[key] ?? [];
            return (
              <View
                key={key}
                style={[
                  styles.dayGroupCard,
                  {
                    borderColor: ui.border,
                    backgroundColor: ui.surface,
                    shadowColor: '#000',
                    shadowOpacity: ui.shadowOpacity,
                  },
                ]}
              >
                <Text style={[styles.dayGroupTitle, { color: ui.text }]}>
                  {date.getMonth() + 1}/{date.getDate()} ({WEEKDAYS[date.getDay()]}) · {items.length}
                </Text>
                {items.slice(0, 3).map((task) => renderMiniTaskCard(task, `week-${key}-${task.id}`))}
                {!items.length ? (
                  <Text style={[styles.emptyInlineText, { color: ui.subText }]}>
                    {locale === 'ko' ? '일정 없음' : 'No schedule'}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
        </Animated.View>
      ) : null}

      {viewMode === 'day' ? (
        <View
          style={[
            styles.modePanel,
            {
              borderColor: ui.border,
              backgroundColor: ui.surface,
              shadowColor: '#000',
              shadowOpacity: ui.shadowOpacity,
            },
          ]}
        >
          <Text style={[styles.modePanelTitle, { color: ui.text }]}>
            {selectedDate.getFullYear()}-{pad2(selectedDate.getMonth() + 1)}-{pad2(selectedDate.getDate())}
          </Text>
          {selectedDayTasks.map((task) => (
            <View
              key={task.id}
              style={[
                styles.modePanel,
                {
                  borderColor: ui.border,
                  backgroundColor: ui.surface,
                  shadowColor: '#000',
                  shadowOpacity: ui.shadowOpacity,
                  padding: 14,
                },
              ]}
            >
              <Pressable onPress={() => onOpenTask?.(task.id)} style={{ gap: 4 }}>
                <Text style={[styles.miniTaskTitle, { color: ui.text }]}>{task.title}</Text>
                <Text style={[styles.miniTaskTime, { color: ui.subText }]}>{task.start_time.slice(11, 16)} - {task.end_time.slice(11, 16)}</Text>
              </Pressable>
              <View style={styles.actionChipRow}>
                <Pressable style={[styles.actionChip, { borderColor: ui.border, backgroundColor: ui.surfaceSoft }]} onPress={() => onShiftTask?.(task.id, -30)}>
                  <Text style={[styles.actionChipText, { color: ui.text }]}>
                    {locale === 'ko' ? '-30m 이동' : 'Move -30m'}
                  </Text>
                </Pressable>
                <Pressable style={[styles.actionChip, { borderColor: ui.border, backgroundColor: ui.surfaceSoft }]} onPress={() => onShiftTask?.(task.id, 30)}>
                  <Text style={[styles.actionChipText, { color: ui.text }]}>
                    {locale === 'ko' ? '+30m 이동' : 'Move +30m'}
                  </Text>
                </Pressable>
                <Pressable style={[styles.actionChip, { borderColor: ui.border, backgroundColor: ui.surfaceSoft }]} onPress={() => onResizeTask?.(task.id, -30)}>
                  <Text style={[styles.actionChipText, { color: ui.text }]}>
                    {locale === 'ko' ? '-30m 축소' : 'Shrink -30m'}
                  </Text>
                </Pressable>
                <Pressable style={[styles.actionChip, { borderColor: ui.border, backgroundColor: ui.surfaceSoft }]} onPress={() => onResizeTask?.(task.id, 30)}>
                  <Text style={[styles.actionChipText, { color: ui.text }]}>
                    {locale === 'ko' ? '+30m 확장' : 'Expand +30m'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
          {!selectedDayTasks.length ? (
            <Text style={s.emptyText}>
              {locale === 'ko' ? '선택한 날짜 일정이 없습니다.' : 'No schedule on the selected date.'}
            </Text>
          ) : null}
        </View>
      ) : null}

      {viewMode === 'timetable' ? (
        <Animated.View
          style={{
            transform: [{ translateX: weekSlideX }],
            opacity: weekSlideX.interpolate({
              inputRange: [-280, 0, 280],
              outputRange: [0.92, 1, 0.92],
              extrapolate: 'clamp',
            }),
          }}
          {...weekSwipeResponder.panHandlers}
        >
        <View
          style={[
            styles.modePanel,
            {
              borderColor: ui.border,
              backgroundColor: ui.surface,
              shadowColor: '#000',
              shadowOpacity: ui.shadowOpacity,
              padding: 10,
            },
          ]}
        >
          <Text style={[styles.modePanelTitle, { color: ui.text }]}>
            {locale === 'ko' ? '시간표' : 'Timetable'}
          </Text>
          {renderTimetableBoard()}
        </View>
        </Animated.View>
      ) : null}

      <Modal
        transparent
        visible={!!openMoreDateKey}
        animationType="fade"
        onRequestClose={() => setOpenMoreDateKey(null)}
      >
        <Pressable
          onPress={() => setOpenMoreDateKey(null)}
          style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.38)', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              backgroundColor: ui.surface,
              borderWidth: 1,
              borderColor: ui.border,
              maxHeight: '52%',
              paddingHorizontal: 14,
              paddingTop: 12,
              paddingBottom: 20,
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>
              {openMoreDateKey} · {moreSheetTasks.length}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {moreSheetTasks.map((task) => (
                <Pressable
                  key={`${task.id}-more-sheet`}
                  onPress={() => {
                    setOpenMoreDateKey(null);
                    onSelectTask(task.id);
                    onOpenTask?.(task.id);
                  }}
                  style={{
                    borderWidth: 1,
                    borderColor: `${getTaskAccentColor(task)}66`,
                    backgroundColor: ui.surface,
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    gap: 3,
                  }}
                >
                  <Text style={{ fontSize: 12, lineHeight: 15, color: colors.text, fontWeight: '700' }} numberOfLines={1}>
                    {task.title}
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600' }}>
                    {task.start_time.slice(11, 16)} - {task.end_time.slice(11, 16)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerShell: {
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    zIndex: 20,
  },
  headerSquareButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  modeChip: {
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  modeChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modePanel: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  modePanelTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modePanelMeta: {
    fontSize: 13,
    fontWeight: '600',
  },
  dayGroupTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  dayGroupCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  miniTaskCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  miniTaskTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  miniTaskAccent: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 999,
  },
  miniTaskMain: {
    flex: 1,
    gap: 4,
  },
  miniTaskTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  miniTaskTime: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyInlineText: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  actionChip: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
