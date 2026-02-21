import React, { useState, useMemo } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useApp } from '@/lib/app-context';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { Schedule } from '@/lib/types';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function padStart(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export default function CalendarScreen() {
  const { workspaceSchedules } = useApp();
  const colors = useColors();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const todayStr = `${today.getFullYear()}-${padStart(today.getMonth() + 1)}-${padStart(today.getDate())}`;

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const daysInPrevMonth = getDaysInMonth(year, month - 1);

  // Build 42-cell grid
  const cells: { day: number; isCurrentMonth: boolean; dateStr: string }[] = [];
  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevMonth = month === 0 ? 12 : month;
    const prevYear = month === 0 ? year - 1 : year;
    cells.push({ day: d, isCurrentMonth: false, dateStr: `${prevYear}-${padStart(prevMonth)}-${padStart(d)}` });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, isCurrentMonth: true, dateStr: `${year}-${padStart(month + 1)}-${padStart(d)}` });
  }
  // Next month leading days
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const nextMonth = month === 11 ? 1 : month + 2;
    const nextYear = month === 11 ? year + 1 : year;
    cells.push({ day: d, isCurrentMonth: false, dateStr: `${nextYear}-${padStart(nextMonth)}-${padStart(d)}` });
  }

  // Schedule map by date
  const schedulesByDate = useMemo(() => {
    const map: Record<string, Schedule[]> = {};
    workspaceSchedules.forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [workspaceSchedules]);

  const prevMonth = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const handleDatePress = (dateStr: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/schedule' as any);
  };

  const rows: typeof cells[] = [];
  for (let i = 0; i < 6; i++) {
    rows.push(cells.slice(i * 7, i * 7 + 7));
  }

  return (
    <ScreenContainer edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <Pressable
            style={({ pressed }) => [styles.navBtn, { backgroundColor: colors.surface }, pressed && { opacity: 0.6 }]}
            onPress={prevMonth}
          >
            <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
          </Pressable>
          <Pressable onPress={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}>
            <Text style={[styles.monthLabel, { color: colors.foreground }]}>
              {year}년 {MONTHS[month]}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.navBtn, { backgroundColor: colors.surface }, pressed && { opacity: 0.6 }]}
            onPress={nextMonth}
          >
            <IconSymbol name="chevron.right" size={20} color={colors.foreground} />
          </Pressable>
        </View>

        {/* Calendar Grid */}
        <View style={[styles.calendarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Weekday Headers */}
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((d, i) => (
              <View key={d} style={styles.weekdayCell}>
                <Text style={[
                  styles.weekdayText,
                  { color: i === 0 ? '#EF4444' : i === 6 ? '#5B6CF6' : colors.muted },
                ]}>
                  {d}
                </Text>
              </View>
            ))}
          </View>

          {/* Day Rows */}
          {rows.map((row, rowIdx) => (
            <View key={rowIdx} style={[styles.dayRow, rowIdx < 5 && { borderBottomColor: colors.border, borderBottomWidth: 0.5 }]}>
              {row.map((cell, colIdx) => {
                const isToday = cell.dateStr === todayStr;
                const schedules = schedulesByDate[cell.dateStr] ?? [];
                const isWeekend = colIdx === 0 || colIdx === 6;
                return (
                  <Pressable
                    key={cell.dateStr}
                    style={({ pressed }) => [
                      styles.dayCell,
                      pressed && { backgroundColor: colors.surface2 },
                    ]}
                    onPress={() => handleDatePress(cell.dateStr)}
                  >
                    <View style={[
                      styles.dayNumber,
                      isToday && { backgroundColor: colors.primary },
                    ]}>
                      <Text style={[
                        styles.dayText,
                        !cell.isCurrentMonth && { color: colors.border },
                        cell.isCurrentMonth && isWeekend && { color: colIdx === 0 ? '#EF4444' : '#5B6CF6' },
                        cell.isCurrentMonth && !isWeekend && { color: colors.foreground },
                        isToday && { color: '#fff', fontWeight: '800' },
                      ]}>
                        {cell.day}
                      </Text>
                    </View>
                    {/* Event dots */}
                    {schedules.length > 0 && (
                      <View style={styles.dotsRow}>
                        {schedules.slice(0, 3).map(s => (
                          <View key={s.id} style={[styles.eventDot, { backgroundColor: s.color }]} />
                        ))}
                        {schedules.length > 3 && (
                          <Text style={[styles.moreDots, { color: colors.muted }]}>+</Text>
                        )}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* This Month's Schedules */}
        <View style={styles.monthSchedules}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {MONTHS[month]} 일정 ({workspaceSchedules.filter(s => s.date.startsWith(`${year}-${padStart(month + 1)}`)).length}개)
          </Text>
          {workspaceSchedules
            .filter(s => s.date.startsWith(`${year}-${padStart(month + 1)}`))
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(s => (
              <Pressable
                key={s.id}
                style={({ pressed }) => [
                  styles.monthScheduleItem,
                  { backgroundColor: colors.surface, borderLeftColor: s.color },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => router.push('/(tabs)/schedule' as any)}
              >
                <View style={styles.monthScheduleLeft}>
                  <Text style={[styles.monthScheduleDate, { color: colors.muted }]}>
                    {s.date.split('-')[2]}일
                    {s.startTime ? ` ${s.startTime}` : ''}
                  </Text>
                  <Text style={[styles.monthScheduleTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {s.title}
                  </Text>
                </View>
                <View style={[styles.statusDot, { backgroundColor: s.status === 'DONE' ? '#10B981' : s.status === 'IN_PROGRESS' ? '#5B6CF6' : '#6B7280' }]} />
              </Pressable>
            ))}
          {workspaceSchedules.filter(s => s.date.startsWith(`${year}-${padStart(month + 1)}`)).length === 0 && (
            <View style={[styles.emptyMonth, { borderColor: colors.border }]}>
              <Text style={[styles.emptyMonthText, { color: colors.muted }]}>이 달의 일정이 없습니다</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  calendarCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  weekdayRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7F0',
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dayRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 4,
    gap: 2,
  },
  dayNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '500',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
    height: 8,
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  moreDots: {
    fontSize: 8,
    fontWeight: '700',
  },
  monthSchedules: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  monthScheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  monthScheduleLeft: {
    flex: 1,
    gap: 2,
  },
  monthScheduleDate: {
    fontSize: 11,
    fontWeight: '500',
  },
  monthScheduleTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyMonth: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyMonthText: {
    fontSize: 14,
  },
});
