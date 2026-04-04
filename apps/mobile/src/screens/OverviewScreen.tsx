import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeMode } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import type { TaskItem } from '../lib/types';

type Props = {
  tasks: TaskItem[];
  onPressTask?: (taskId: number) => void;
  onToggleTaskDone?: (taskId: number, done: boolean) => void;
  onOpenCreateTask?: () => void;
};

type TaskWithDate = TaskItem & {
  __start: Date | null;
  __end: Date | null;
};

type CategoryOption = {
  key: string;
  name: string;
  color: string;
  tasks: TaskWithDate[];
};

const CARD_BASE = {
  borderRadius: 16,
  padding: 16,
  marginBottom: 12,
  borderWidth: 1,
  shadowOpacity: 0.03,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 1,
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

function isRecurringTask(task: TaskItem) {
  if (task.recurrence && Array.isArray(task.recurrence.weekdays) && task.recurrence.weekdays.length > 0) {
    return true;
  }
  if (!task.rrule) return false;
  try {
    const parsed = JSON.parse(task.rrule) as { type?: string; weekdays?: number[] } | null;
    return Boolean(parsed && parsed.type === 'WEEKLY_RANGE' && Array.isArray(parsed.weekdays) && parsed.weekdays.length > 0);
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
  const { appearance, colors } = useThemeMode();
  const { locale, t } = useI18n();
  const now = new Date();
  const isDark = appearance === 'dark';

  const ui = {
    background: colors.bg,
    surface: colors.card,
    surfaceSoft: colors.cardSoft,
    border: colors.border,
    text: colors.text,
    subText: colors.textMuted,
    primary: colors.primary,
    success: isDark ? '#4CC38A' : '#56C38A',
    cardShadow: isDark ? '#000000' : '#000000',
    cardShadowOpacity: isDark ? 0.22 : 0.03,
    chipNeutralBg: isDark ? '#1A2130' : '#F5F6F8',
    chipNeutralBorder: isDark ? '#263043' : '#EFF1F4',
    chipNeutralText: isDark ? '#A9B3C7' : '#6B7280',
    chipPrimaryBg: isDark ? 'rgba(123,136,255,0.18)' : '#EEF3FF',
    chipDoneBg: isDark ? 'rgba(76,195,138,0.18)' : '#EAF7F0',
    checkboxBorder: isDark ? '#7A879F' : '#BFC4CE',
  };

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
      .sort((a, b) => (a.__start?.getTime() ?? 0) - (b.__start?.getTime() ?? 0));
  }, [tasks, todayStart, todayEnd]);

  const recurringTasks = useMemo(() => {
    const sorted = tasks
      .map((task) => {
        const start = parseDate(task.start_time);
        const end = parseDate(task.end_time) ?? start;
        return { ...task, __start: start, __end: end } as TaskWithDate;
      })
      .filter((task) => isRecurringTask(task))
      .sort((a, b) => (a.__start?.getTime() ?? 0) - (b.__start?.getTime() ?? 0))
      .slice(0, 20);

    const seenIds = new Set<number>();
    return sorted.filter((task) => {
      if (seenIds.has(task.id)) return false;
      seenIds.add(task.id);
      return true;
    }).slice(0, 8);
  }, [tasks]);

  const categoryGroups = useMemo(() => {
    const groups = new Map<string, { categoryId: number | null; categoryName: string; color: string; tasks: TaskWithDate[] }>();
    for (const task of todayTasks) {
      const categoryId = task.category?.category_id ?? task.category_id ?? null;
      const categoryName = task.category?.name ?? '미분류';
      const color = task.category?.color ?? task.color ?? ui.primary;
      const key = `${categoryId ?? 'none'}:${categoryName}`;
      const existing = groups.get(key);
      if (existing) existing.tasks.push(task);
      else groups.set(key, { categoryId: categoryId ? Number(categoryId) : null, categoryName, color, tasks: [task] });
    }
    return Array.from(groups.values()).sort((a, b) => b.tasks.length - a.tasks.length);
  }, [todayTasks, ui.primary]);

  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string>('ALL');
  const categoryOptions = useMemo<CategoryOption[]>(
    () => [
      { key: 'ALL', name: '카테고리 전체', color: ui.primary, tasks: todayTasks },
      ...categoryGroups.map((group) => ({
        key: `${group.categoryId ?? 'none'}:${group.categoryName}`,
        name: group.categoryName,
        color: group.color,
        tasks: group.tasks,
      })),
    ],
    [categoryGroups, todayTasks, ui.primary]
  );
  const selectedCategoryOption = categoryOptions.find((option) => option.key === selectedCategoryKey) ?? categoryOptions[0];

  const filteredTodayTasks = todayTasks;
  const topDateLabel = now.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  return (
    <View style={[styles.screen, { backgroundColor: ui.background }]}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: ui.text }]}>오늘 기준 일정</Text>

      </View>
      <View style={styles.todayMetaRow}>
        <Text style={[styles.todayMetaTitle, { color: ui.text }]} numberOfLines={1}>
          {`오늘 · ${topDateLabel}`}
        </Text>
        <Text style={[styles.todayMetaCount, { color: ui.subText }]}>{`${filteredTodayTasks.length}개`}</Text>
      </View>

      {filteredTodayTasks.length === 0 ? (
        <View style={[styles.emptyWrap, { borderColor: ui.border, backgroundColor: ui.surface }]}>
          <Text style={[styles.emptyText, { color: ui.subText }]}>{t('overviewTimelineNoEvents')}</Text>
        </View>
      ) : (
        <View style={styles.todayList}>
          {filteredTodayTasks.map((task) => {
            const isDone = task.status === 'DONE';
            const categoryColor = task.category?.color || task.color || ui.primary;
            const repeatLabel =
              task.recurrence && Array.isArray(task.recurrence.weekdays) && task.recurrence.weekdays.length
                ? '반복 · 매주 금'
                : null;

            return (
              <Pressable
                key={`${task.id}:${task.start_time}`}
                onPress={() => onPressTask?.(task.id)}
                style={[
                  styles.taskCard,
                  {
                    borderColor: ui.border,
                    backgroundColor: ui.surface,
                    opacity: isDone ? 0.74 : 1,
                  },
                ]}
              >
                <View style={styles.taskCardTop}>
                  <Pressable
                    onPress={() => onToggleTaskDone?.(task.id, !isDone)}
                    hitSlop={8}
                    style={[
                      styles.checkbox,
                      {
                        borderWidth: isDone ? 0 : 1.5,
                        borderColor: isDone ? ui.success : ui.checkboxBorder,
                        backgroundColor: isDone ? ui.success : 'transparent',
                      },
                    ]}
                  >
                    {isDone ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                  </Pressable>
                  <View style={styles.taskMain}>
                    <Text
                      style={[
                        styles.taskTitle,
                        {
                          color: ui.text,
                          textDecorationLine: isDone ? 'line-through' : 'none',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {task.title}
                    </Text>
                    <Text style={[styles.taskTime, { color: ui.subText }]} numberOfLines={1}>
                      {`${formatTime(task.__start)} - ${formatTime(task.__end)}`}
                    </Text>
                  </View>
                </View>
                <View style={styles.taskTagRow}>
                  <View style={styles.taskTagLeft}>
                    {task.tags?.slice(0, 2).map((tag) => (
                      <View
                        key={`${task.id}:${tag.tag_id}`}
                        style={[styles.taskTag, { backgroundColor: `${categoryColor}${isDark ? '20' : '12'}`, borderColor: `${categoryColor}${isDark ? '30' : '18'}` }]}
                      >
                        <Text style={[styles.taskTagText, { color: categoryColor }]} numberOfLines={1}>
                          {tag.name}
                        </Text>
                      </View>
                    ))}
                    {repeatLabel ? (
                      <View style={[styles.taskTag, { backgroundColor: ui.chipNeutralBg, borderColor: ui.chipNeutralBorder }]}>
                        <Text style={[styles.taskTagText, { color: ui.chipNeutralText }]} numberOfLines={1}>
                          {repeatLabel}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {task.tags && task.tags.length > 2 ? (
                    <Text style={[styles.taskMore, { color: ui.primary }]} numberOfLines={1}>
                      +{task.tags.length - 2} more
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: ui.text }]}>반복 일정</Text>
        <Text style={[styles.nextLabelMuted, { color: ui.subText }]}>{`${recurringTasks.length}개`}</Text>
      </View>

      {recurringTasks.length === 0 ? (
        <View style={[styles.emptyWrap, { borderColor: ui.border, backgroundColor: ui.surface }]}>
          <Text style={[styles.emptyText, { color: ui.subText }]}>예정된 반복 일정이 없습니다.</Text>
        </View>
      ) : (
        <View style={styles.recurringWrap}>
          {recurringTasks.map((task) => (
            <Pressable
              key={`${task.id}:${task.start_time}`}
              onPress={() => onPressTask?.(task.id)}
              style={[styles.recurringItem, { borderColor: ui.border, backgroundColor: ui.surface }]}
            >
              <View style={styles.taskCardTop}>
                <View style={[styles.recurringLeading, { backgroundColor: ui.surfaceSoft }]}>
                  <Ionicons
                    name="repeat-outline"
                    size={26}
                    color={isDark ? '#8FA0C7' : '#8EA6C8'}
                  />
                </View>
                <View style={styles.taskMain}>
                  <Text style={[styles.taskTitle, { color: ui.text }]} numberOfLines={1}>
                    {task.title}
                  </Text>
                  <Text style={[styles.taskTime, { color: ui.subText }]} numberOfLines={1}>
                    {`${formatTime(task.__start)} - ${formatTime(task.__end)}`}
                  </Text>
                </View>
              </View>
              <View style={styles.taskTagRow}>
                <View style={styles.taskTagLeft}>
                  <View style={[styles.taskTag, { backgroundColor: ui.chipNeutralBg, borderColor: ui.chipNeutralBorder }]}>
                    <Text style={[styles.taskTagText, { color: ui.chipNeutralText }]} numberOfLines={1}>
                      반복 · 매일
                    </Text>
                  </View>
                </View>
                <View style={[styles.recurringRightPill, { backgroundColor: ui.chipPrimaryBg }]}>
                  <Text style={[styles.recurringRightPillText, { color: ui.primary }]} numberOfLines={1}>
                    {(task.tags?.[0]?.name ?? '업무') + ' ›'}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: ui.text }]}>카테고리 일정</Text>
      </View>

      <Pressable onPress={() => setCategoryDropdownOpen((prev) => !prev)} style={[styles.categorySelector, { borderColor: ui.border, backgroundColor: ui.surface }]}>
        <View style={styles.dropdownLabelWrap}>
          <View style={[styles.dot, { backgroundColor: selectedCategoryOption?.color ?? ui.primary }]} />
          <Text style={[styles.dropdownLabel, { color: ui.text }]} numberOfLines={1}>
            {selectedCategoryOption?.name ?? '카테고리 전체'}
          </Text>
        </View>
        <View style={styles.categorySelectorRight}>
          <Text style={[styles.dropdownCount, { color: ui.subText }]}>{selectedCategoryOption?.tasks.length ?? 0}개</Text>
          <Ionicons name={categoryDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={ui.subText} />
        </View>
      </Pressable>

      {categoryDropdownOpen ? (
        <View style={[styles.dropdownPanel, { borderColor: ui.border, backgroundColor: ui.surface }]}>
          {categoryOptions.map((option, idx) => {
            const selected = option.key === (selectedCategoryOption?.key ?? 'ALL');
            return (
              <Pressable
                key={option.key}
                onPress={() => {
                  setSelectedCategoryKey(option.key);
                  setCategoryDropdownOpen(false);
                }}
                style={[
                  styles.dropdownItem,
                  {
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: ui.border,
                    backgroundColor: selected ? `${ui.primary}10` : ui.surface,
                  },
                ]}
              >
                <View style={styles.dropdownLabelWrap}>
                  <View style={[styles.dot, { backgroundColor: option.color || ui.primary }]} />
                  <Text style={[styles.dropdownLabel, { color: selected ? ui.primary : ui.text }]} numberOfLines={1}>
                    {option.name}
                  </Text>
                </View>
                <Text style={[styles.dropdownCount, { color: ui.subText }]}>{option.tasks.length}개</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {selectedCategoryOption?.tasks.length ? (
        <View style={styles.categoryCardList}>
          {selectedCategoryOption.tasks.slice(0, 6).map((task) => {
            const categoryColor = task.category?.color || task.color || ui.primary;
            const isDone = task.status === 'DONE';
            return (
            <Pressable
              key={`${selectedCategoryOption.key}:${task.id}:${task.start_time}`}
              onPress={() => onPressTask?.(task.id)}
              style={[
                styles.categoryTaskCard,
                {
                  borderColor: ui.border,
                  backgroundColor: ui.surface,
                  opacity: isDone ? 0.74 : 1,
                },
              ]}
            >
              <View style={styles.taskCardTop}>
                <Pressable
                  onPress={() => onToggleTaskDone?.(task.id, !isDone)}
                  hitSlop={8}
                  style={[
                    styles.checkbox,
                    {
                      borderWidth: isDone ? 0 : 1.5,
                      borderColor: isDone ? ui.success : ui.checkboxBorder,
                      backgroundColor: isDone ? ui.success : 'transparent',
                    },
                  ]}
                >
                  {isDone ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                </Pressable>
                <View style={styles.taskMain}>
                  <Text
                    style={[
                      styles.taskTitle,
                      {
                        color: ui.text,
                        textDecorationLine: isDone ? 'line-through' : 'none',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {task.title}
                  </Text>
                  <Text style={[styles.taskTime, { color: ui.subText }]} numberOfLines={1}>
                    {`${formatTime(task.__start)} - ${formatTime(task.__end)}`}
                  </Text>
                </View>
              </View>
              <View style={styles.taskTagRow}>
                <View style={styles.taskTagLeft}>
                  {task.tags?.slice(0, 2).map((tag) => (
                    <View
                      key={`${task.id}:${tag.tag_id}`}
                      style={[styles.taskTag, { backgroundColor: `${categoryColor}${isDark ? '20' : '12'}`, borderColor: `${categoryColor}${isDark ? '30' : '18'}` }]}
                    >
                      <Text style={[styles.taskTagText, { color: categoryColor }]} numberOfLines={1}>
                        {tag.name}
                      </Text>
                    </View>
                  ))}
                </View>
                {task.tags && task.tags.length > 2 ? (
                  <Text style={[styles.taskMore, { color: ui.primary }]} numberOfLines={1}>
                    +{task.tags.length - 2} more
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )})}
        </View>
      ) : (
        <View style={[styles.emptyWrap, { borderColor: ui.border, backgroundColor: ui.surface }]}>
          <Text style={[styles.emptyText, { color: ui.subText }]}>선택한 카테고리 일정이 없습니다.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 12,
    paddingBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  todayMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -4,
    marginBottom: 2,
  },
  todayMetaTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  todayMetaCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  nextLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  nextLabelMuted: {
    fontSize: 14,
    fontWeight: '600',
  },
  todayList: {
    gap: 12,
  },
  taskCard: {
    ...CARD_BASE,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: 0,
    minHeight: 40,
  },
  taskCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taskMain: {
    flex: 1,
    gap: 5,
  },
  checkbox: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  taskTime: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  taskTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  taskTagLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  taskTag: {
    maxWidth: 116,
    minHeight: 24,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  neutralTag: {
    backgroundColor: '#F5F6F8',
    borderColor: '#EFF1F4',
  },
  neutralTagText: {
    color: '#6B7280',
  },
  taskMore: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 0,
  },
  recurringWrap: {
    gap: 12,
    marginTop: 2,
  },
  recurringItem: {
    ...CARD_BASE,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 0,
    minHeight: 40,
  },
  recurringLeading: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recurringCircle: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 2,
  },
  recurringDate: {
    fontSize: 13,
    fontWeight: '600',
  },
  recurringRightPill: {
    height: 27,
    borderRadius: 999,
    backgroundColor: '#EEF3FF',
    paddingHorizontal: 12,
    justifyContent: 'center',
    maxWidth: 116,
  },
  recurringRightPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  categorySelector: {
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  categorySelectorRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dropdownPanel: {
    borderWidth: 1,
    borderRadius: 13,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dropdownLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dropdownLabel: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  dropdownCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  categoryTaskList: {
    borderWidth: 1,
    borderRadius: 13,
    overflow: 'hidden',
  },
  categoryCardList: {
    gap: 12,
    marginTop: 2,
  },
  categoryTaskCard: {
    ...CARD_BASE,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 0,
    minHeight: 40,
  },
  categoryLeadingPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  categoryTaskRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  emptyWrap: {
    ...CARD_BASE,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 0,
    minHeight: 72,
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
