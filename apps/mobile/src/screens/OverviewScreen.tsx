import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeMode } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { createStyles } from '../styles/createStyles';
import type { TaskItem } from '../lib/types';
import { GsxCard, GsxChip, GsxHeading } from '../ui/gsx';

type Props = {
  tasks: TaskItem[];
  onPressTask?: (taskId: number) => void;
  onToggleTaskDone?: (taskId: number, done: boolean) => void;
};

type TaskWithDate = TaskItem & {
  __start: Date | null;
  __end: Date | null;
};

function parseDate(value?: string | null) {
  if (!value) return null;
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTime(value: Date | null) {
  if (!value) return '--:--';
  const hh = String(value.getHours()).padStart(2, '0');
  const mm = String(value.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatCountdown(target: Date, now: Date, t: (key: string, params?: Record<string, string | number>) => string) {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return t('overviewTimelineStartingNow');
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return t('overviewTimelineStartsInMinutes', { minutes });
  if (minutes <= 0) return t('overviewTimelineStartsInHours', { hours });
  return t('overviewTimelineStartsInHoursMinutes', { hours, minutes });
}

function isRecurringTask(task: TaskItem) {
  if (task.recurrence && Array.isArray(task.recurrence.weekdays) && task.recurrence.weekdays.length > 0) {
    return true;
  }
  if (!task.rrule) return false;
  try {
    const parsed = JSON.parse(task.rrule) as { type?: string; weekdays?: number[] } | null;
    return Boolean(
      parsed &&
        parsed.type === 'WEEKLY_RANGE' &&
        Array.isArray(parsed.weekdays) &&
        parsed.weekdays.length > 0,
    );
  } catch {
    const legacy = String(task.rrule).toUpperCase();
    return legacy.includes('FREQ=WEEKLY') || legacy.includes('WEEKLY_RANGE');
  }
}

function toDateLabel(date: Date | null, locale: string) {
  if (!date) return '--';
  return date.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
}

export function OverviewScreen({ tasks, onPressTask, onToggleTaskDone }: Props) {
  const { colors } = useThemeMode();
  const { locale, t } = useI18n();
  const s = createStyles(colors);
  const now = new Date();

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const todayTasks = useMemo(() => {
    return tasks
      .map((task) => {
        const start = parseDate(task.start_time);
        const end = parseDate(task.end_time) ?? start;
        return { ...task, __start: start, __end: end } as TaskWithDate;
      })
      .filter((task) => {
        if (isRecurringTask(task)) return false;
        const start = task.__start;
        const end = task.__end;
        if (!start || !end) return false;
        return end >= todayStart && start <= todayEnd;
      })
      .sort((a, b) => {
        const aTime = a.__start?.getTime() ?? 0;
        const bTime = b.__start?.getTime() ?? 0;
        return aTime - bTime;
      });
  }, [tasks, todayEnd, todayStart]);

  const totalCount = todayTasks.length;
  const completedCount = todayTasks.filter((task) => task.status === 'DONE').length;
  const remainingCount = Math.max(0, totalCount - completedCount);

  const currentTaskId = todayTasks.find((task) => {
    const start = task.__start;
    const end = task.__end;
    if (!start || !end) return false;
    const nowTime = now.getTime();
    return start.getTime() <= nowTime && end.getTime() >= nowTime;
  })?.id;

  const nextTask = todayTasks.find((task) => {
    const start = task.__start;
    if (!start) return false;
    return start.getTime() > now.getTime();
  });

  const recurringTasks = useMemo(() => {
    const sorted = tasks
      .map((task) => {
        const start = parseDate(task.start_time);
        const end = parseDate(task.end_time) ?? start;
        return { ...task, __start: start, __end: end } as TaskWithDate;
      })
      .filter((task) => {
        return isRecurringTask(task);
      })
      .sort((a, b) => (a.__start?.getTime() ?? 0) - (b.__start?.getTime() ?? 0))
      .slice(0, 20);

    const seenIds = new Set<number>();
    return sorted
      .filter((task) => {
        if (seenIds.has(task.id)) return false;
        seenIds.add(task.id);
        return true;
      })
      .slice(0, 8);
  }, [tasks, now]);

  const categoryGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        categoryId: number | null;
        categoryName: string;
        color: string;
        tasks: TaskWithDate[];
      }
    >();

    for (const task of todayTasks) {
      const categoryId = task.category?.category_id ?? task.category_id ?? null;
      const categoryName = task.category?.name ?? '미분류';
      const color = task.category?.color ?? task.color ?? colors.primary;
      const key = `${categoryId ?? 'none'}:${categoryName}`;
      const existing = groups.get(key);
      if (existing) {
        existing.tasks.push(task);
      } else {
        groups.set(key, {
          categoryId: categoryId ? Number(categoryId) : null,
          categoryName,
          color,
          tasks: [task],
        });
      }
    }

    return Array.from(groups.values()).sort((a, b) => b.tasks.length - a.tasks.length);
  }, [todayTasks, colors.primary]);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string>('ALL');
  const categoryOptions = useMemo(() => {
    return [
      {
        key: 'ALL',
        name: '전체 카테고리',
        color: colors.primary,
        tasks: todayTasks,
      },
      ...categoryGroups.map((group) => ({
        key: `${group.categoryId ?? 'none'}:${group.categoryName}`,
        name: group.categoryName,
        color: group.color,
        tasks: group.tasks,
      })),
    ];
  }, [categoryGroups, todayTasks, colors.primary]);
  const selectedCategoryOption =
    categoryOptions.find((option) => option.key === selectedCategoryKey) ?? categoryOptions[0];

  const localizedTopDate = now.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  const equalSectionCardStyle = { minHeight: 100 };

  return (
    <View style={{ gap: 10 }}>
      <GsxCard className="gap-2">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <GsxHeading className="text-2xl">{localizedTopDate}</GsxHeading>
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: `${colors.primary}12`,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }}>OVERVIEW</Text>
          </View>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>
          {t('overviewTopSummary', { total: totalCount, completed: completedCount, remaining: remainingCount })}
        </Text>
      </GsxCard>

      <GsxCard className="gap-2" style={equalSectionCardStyle}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="today-outline" size={16} color={colors.primary} />
          <GsxHeading className="text-lg">오늘 일정</GsxHeading>
        </View>
        {nextTask?.__start ? (
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
            {formatCountdown(nextTask.__start, now, t)}
          </Text>
        ) : (
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('overviewTimelineNoUpcoming')}</Text>
        )}
        <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
          {todayTasks.length === 0 ? (
            <View style={{ padding: 12 }}>
              <Text style={s.itemMeta}>{t('overviewTimelineNoEvents')}</Text>
            </View>
          ) : (
            todayTasks.map((task, idx) => {
              const isCurrent = currentTaskId === task.id;
              const isDone = task.status === 'DONE';
              return (
                <View
                  key={task.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor: isCurrent ? `${colors.primary}14` : colors.card,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <Pressable
                    onPress={() => onToggleTaskDone?.(task.id, !isDone)}
                    hitSlop={8}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: isDone ? 0 : 1.5,
                      borderColor: isDone ? colors.primary : colors.border,
                      backgroundColor: isDone ? colors.primary : 'transparent',
                    }}
                  >
                    {isDone ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
                  </Pressable>
                  <Pressable
                    onPress={() => onPressTask?.(task.id)}
                    style={{ flex: 1, gap: 4 }}
                  >
                    <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>
                      {`${formatTime(task.__start)} - ${formatTime(task.__end)}`}
                    </Text>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 14,
                        fontWeight: isCurrent ? '800' : '700',
                        textDecorationLine: isDone ? 'line-through' : 'none',
                        opacity: isDone ? 0.75 : 1,
                      }}
                    >
                      {task.title}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      </GsxCard>

      <GsxCard className="gap-2" style={equalSectionCardStyle}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="repeat-outline" size={16} color={colors.primary} />
          <GsxHeading className="text-lg">반복 일정</GsxHeading>
        </View>
        {recurringTasks.length === 0 ? (
          <Text style={s.itemMeta}>예정된 반복 일정이 없습니다.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {recurringTasks.map((task) => (
              <Pressable
                key={`${task.id}:${task.start_time}`}
                onPress={() => onPressTask?.(task.id)}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: colors.card,
                  gap: 4,
                }}
              >
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>
                  {`${toDateLabel(task.__start, locale)} · ${formatTime(task.__start)} - ${formatTime(task.__end)}`}
                </Text>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{task.title}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </GsxCard>

      <GsxCard className="gap-2">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="layers-outline" size={16} color={colors.primary} />
          <GsxHeading className="text-lg">카테고리별 일정</GsxHeading>
        </View>
        {categoryGroups.length === 0 ? (
          <Text style={s.itemMeta}>오늘 카테고리 일정이 없습니다.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            <Pressable
              onPress={() => setCategoryDropdownOpen((prev) => !prev)}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                backgroundColor: colors.card,
                paddingHorizontal: 12,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: selectedCategoryOption?.color ?? colors.primary,
                  }}
                />
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 }}>
                  {selectedCategoryOption?.name ?? '전체 카테고리'}
                </Text>
                <GsxChip
                  label={`${selectedCategoryOption?.tasks.length ?? 0}개`}
                  active
                  className="px-2 py-1"
                  textClassName="text-[10px]"
                />
              </View>
              <Ionicons
                name={categoryDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.textMuted}
              />
            </Pressable>

            {categoryDropdownOpen ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  backgroundColor: colors.card,
                  overflow: 'hidden',
                }}
              >
                {categoryOptions.map((option, idx) => {
                  const selected = option.key === (selectedCategoryOption?.key ?? 'ALL');
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => {
                        setSelectedCategoryKey(option.key);
                        setCategoryDropdownOpen(false);
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderTopWidth: idx === 0 ? 0 : 1,
                        borderTopColor: colors.border,
                        backgroundColor: selected ? `${colors.primary}18` : colors.card,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text style={{ color: selected ? colors.primary : colors.text, fontSize: 13, fontWeight: selected ? '800' : '600' }}>
                        {option.name}
                      </Text>
                      <GsxChip
                        label={`${option.tasks.length}개`}
                        active={selected}
                        className="px-2 py-1"
                        textClassName="text-[10px]"
                      />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                backgroundColor: colors.card,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: `${selectedCategoryOption?.color ?? colors.primary}1A`,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>
                  {selectedCategoryOption?.name ?? '전체 카테고리'}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>
                  {selectedCategoryOption?.tasks.length ?? 0}개
                </Text>
              </View>
              <View style={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6 }}>
                {(selectedCategoryOption?.tasks ?? []).slice(0, 6).map((task) => (
                  <Pressable
                    key={`${selectedCategoryOption?.key ?? 'ALL'}:${task.id}:${task.start_time}`}
                    onPress={() => onPressTask?.(task.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{ color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 }}
                    >
                      {task.title}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>
                      {formatTime(task.__start)}
                    </Text>
                  </Pressable>
                ))}
                {(selectedCategoryOption?.tasks?.length ?? 0) === 0 ? (
                  <Text style={s.itemMeta}>선택한 카테고리 일정이 없습니다.</Text>
                ) : null}
              </View>
            </View>
          </View>
        )}
      </GsxCard>

    </View>
  );
}
