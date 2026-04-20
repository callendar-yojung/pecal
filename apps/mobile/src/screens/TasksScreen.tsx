import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDateTime } from '../lib/date';
import type { CategoryItem, TagItem, TaskItem, TaskStatus } from '../lib/types';
import { getTaskAccentColor } from '../lib/task-colors';
import { useThemeMode } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { createStyles } from '../styles/createStyles';
import { OptionSheet } from '../components/common/OptionSheet';
import { GsxButton, GsxCard, GsxChip, GsxHeading } from '../ui/gsx';

function normalizeTaskStatus(status?: TaskStatus): 'TODO' | 'DONE' {
  return status === 'DONE' ? 'DONE' : 'TODO';
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
    return false;
  }
}

type Props = {
  tasks: TaskItem[];
  categories: CategoryItem[];
  tags: TagItem[];
  onOpenCreateTask?: () => void;
  onOpenTask?: (taskId: number) => void;
  onChangeTaskStatus?: (taskId: number, status: TaskStatus) => void;
  onDeleteTasks?: (taskIds: number[]) => Promise<void>;
};

export function TasksScreen({
  tasks,
  categories,
  tags,
  onOpenTask,
  onChangeTaskStatus,
  onDeleteTasks,
}: Props) {
  const { colors, appearance } = useThemeMode();
  const { t } = useI18n();
  const s = createStyles(colors);
  const isDark = appearance === 'dark';
  const ui = {
    background: colors.bg,
    surface: colors.card,
    border: colors.border,
    text: colors.text,
    subText: colors.textMuted,
    primary: colors.primary,
    success: isDark ? '#4CC38A' : '#56C38A',
    checkboxBorder: isDark ? '#7A879F' : '#BFC4CE',
    shadowOpacity: isDark ? 0.18 : 0.03,
  };
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'TODO' | 'DONE'>('ALL');
  const [tagFilter, setTagFilter] = useState<number | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'START_ASC' | 'START_DESC' | 'TITLE_ASC' | 'TITLE_DESC'>('START_DESC');
  const [activeFilterSheet, setActiveFilterSheet] = useState<'status' | 'sort' | 'tag' | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const sortOptions = [
    { key: 'START_ASC', label: '빠른 일정순' },
    { key: 'START_DESC', label: '늦은 일정순' },
    { key: 'TITLE_ASC', label: '이름 A-Z' },
    { key: 'TITLE_DESC', label: '이름 Z-A' },
  ] as const;
  const tagNameById = useMemo(
    () =>
      new Map(
        tags.map((tag) => [Number(tag.tag_id), tag.name.trim().toLowerCase()] as const),
      ),
    [tags],
  );

  const filteredTasks = useMemo(() => {
    const sorted = tasks
      .filter((task) => {
        if (statusFilter !== 'ALL' && normalizeTaskStatus(task.status) !== statusFilter) return false;
        if (tagFilter !== 'ALL' && Number(task.category_id ?? 0) !== Number(tagFilter)) return false;
        if (query.trim()) {
          const q = query.trim().toLowerCase();
          const taskTagNames =
            Array.isArray(task.tags) && task.tags.length > 0
              ? task.tags.map((tag) => String(tag.name ?? '').trim().toLowerCase())
              : (task.tag_ids ?? [])
                  .map((tagId) => tagNameById.get(Number(tagId)) ?? '')
                  .filter(Boolean);
          const haystack = [
            task.title,
            task.description ?? '',
            task.content ?? '',
            ...taskTagNames,
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'TITLE_ASC') return a.title.localeCompare(b.title);
        if (sortBy === 'TITLE_DESC') return b.title.localeCompare(a.title);
        if (sortBy === 'START_DESC') {
          const byStart = b.start_time.localeCompare(a.start_time);
          if (byStart !== 0) return byStart;
          // Same start time: show the later-created task first (higher id first).
          return b.id - a.id;
        }
        const byStart = a.start_time.localeCompare(b.start_time);
        if (byStart !== 0) return byStart;
        // Same start time: keep older-created task first for stable early-order view.
        return a.id - b.id;
      });

    const seenRecurringIds = new Set<number>();
    return sorted.filter((task) => {
      if (!isRecurringTask(task)) return true;
      if (seenRecurringIds.has(task.id)) return false;
      seenRecurringIds.add(task.id);
      return true;
    });
  }, [tasks, statusFilter, tagFilter, query, sortBy, tagNameById]);

  const statusFilterOptions = [
    { key: 'ALL', label: '전체' },
    { key: 'TODO', label: '완료 전' },
    { key: 'DONE', label: '완료' },
  ] as const;
  const tagOptions = [
    { key: 'ALL' as const, label: '카테고리 전체' },
    ...categories.map((category) => ({ key: category.category_id, label: category.name })),
  ];
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const pagedTasks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, page]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, tagFilter, sortBy]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (!selectionMode) return;
    setSelectedTaskIds((prev) => prev.filter((id) => filteredTasks.some((task) => task.id === id)));
  }, [filteredTasks, selectionMode]);

  const toggleSelectTask = (taskId: number) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId],
    );
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedTaskIds([]);
  };

  const deleteSelectedTasks = async () => {
    if (!onDeleteTasks || selectedTaskIds.length === 0 || deletingSelected) return;
    const targetIds = [...selectedTaskIds];
    Alert.alert(
      '선택 일정 삭제',
      `선택한 ${targetIds.length}개의 일정을 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                setDeletingSelected(true);
                await onDeleteTasks(targetIds);
                exitSelectionMode();
              } catch (error) {
                Alert.alert('오류', error instanceof Error ? error.message : '일정을 삭제하지 못했습니다.');
              } finally {
                setDeletingSelected(false);
              }
            })();
          },
        },
      ],
    );
  };

  const allPagedTaskIds = useMemo(() => pagedTasks.map((task) => task.id), [pagedTasks]);
  const areAllPagedSelected =
    allPagedTaskIds.length > 0 &&
    allPagedTaskIds.every((id) => selectedTaskIds.includes(id));

  const toggleSelectAllFiltered = () => {
    if (areAllPagedSelected) {
      setSelectedTaskIds((prev) => prev.filter((id) => !allPagedTaskIds.includes(id)));
      return;
    }
    setSelectedTaskIds((prev) => Array.from(new Set([...prev, ...allPagedTaskIds])));
  };

  return (
    <View style={styles.screen}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: ui.text }]}>{t('commonTasks')}</Text>
        <Text style={[styles.sectionCount, { color: ui.subText }]}>{filteredTasks.length}개</Text>
      </View>

      {!selectionMode ? (
        <View style={styles.topActionsRow}>
          <Pressable
            onPress={() => setSelectionMode(true)}
            style={[styles.chipButton, { borderColor: ui.border, backgroundColor: ui.surface }]}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color={ui.subText} />
            <Text style={[styles.chipButtonText, { color: ui.text }]}>선택</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.selectionCard, { borderColor: ui.border, backgroundColor: ui.surface }]}>
          <View style={styles.selectionHeaderRow}>
            <View
              style={[
                styles.selectionBadge,
                { borderColor: ui.border, backgroundColor: `${ui.primary}12` },
              ]}
            >
              <Text style={[styles.selectionBadgeText, { color: ui.primary }]}>선택됨 {selectedTaskIds.length}개</Text>
            </View>
          </View>
          <View style={styles.selectionActions}>
            <Pressable
              onPress={exitSelectionMode}
              style={[styles.chipButton, { borderColor: ui.border, backgroundColor: ui.surface }]}
            >
              <Text style={[styles.chipButtonText, { color: ui.text }]}>선택해제</Text>
            </Pressable>
            <Pressable
              onPress={toggleSelectAllFiltered}
              style={[styles.chipButtonWide, { borderColor: ui.border, backgroundColor: ui.surface }]}
            >
              <Text style={[styles.chipButtonText, { color: ui.text }]}>
                {areAllPagedSelected ? '현재 페이지 해제' : '현재 페이지 모두선택'}
              </Text>
            </Pressable>
            <Pressable
              disabled={selectedTaskIds.length === 0 || deletingSelected}
              onPress={() => void deleteSelectedTasks()}
              style={[
                styles.dangerChipButton,
                {
                  borderColor: selectedTaskIds.length === 0 || deletingSelected ? '#F5B7B1' : '#FCA5A5',
                  backgroundColor: selectedTaskIds.length === 0 || deletingSelected ? '#FFF5F5' : '#FFF1F2',
                  opacity: selectedTaskIds.length === 0 || deletingSelected ? 0.6 : 1,
                },
              ]}
            >
              <Text style={[styles.chipButtonText, { color: '#EF4444' }]}>
                {deletingSelected ? '삭제 중...' : `삭제 (${selectedTaskIds.length})`}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.filterRow}>
        <View style={[styles.searchWrap, { borderColor: ui.border, backgroundColor: ui.surface }]}>
          <Ionicons name="search-outline" size={18} color={ui.subText} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="일정, 태그 검색"
            style={[styles.searchInput, { color: ui.text }]}
            placeholderTextColor={ui.subText}
          />
        </View>
      </View>

      <View style={styles.filterChipRow}>
        <Pressable
          onPress={() => setActiveFilterSheet('status')}
          style={[styles.filterChip, { borderColor: ui.border, backgroundColor: ui.surface }]}
        >
          <Text style={[styles.filterChipText, { color: ui.text }]} numberOfLines={1}>
            {statusFilterOptions.find((item) => item.key === statusFilter)?.label ?? '전체'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={ui.subText} />
        </Pressable>
        <Pressable
          onPress={() => setActiveFilterSheet('sort')}
          style={[styles.filterChip, { borderColor: ui.border, backgroundColor: ui.surface }]}
        >
          <Text style={[styles.filterChipText, { color: ui.text }]} numberOfLines={1}>
            {sortOptions.find((item) => item.key === sortBy)?.label ?? '빠른 일정순'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={ui.subText} />
        </Pressable>
        <Pressable
          onPress={() => setActiveFilterSheet('tag')}
          style={[styles.filterChip, { borderColor: ui.border, backgroundColor: ui.surface }]}
        >
          <Text style={[styles.filterChipText, { color: ui.text }]} numberOfLines={1}>
            {tagOptions.find((item) => item.key === tagFilter)?.label ?? '카테고리 전체'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={ui.subText} />
        </Pressable>
      </View>

      <View style={styles.listWrap}>
        {pagedTasks.map((task) => {
          const selected = selectedTaskIds.includes(task.id);
          const done = normalizeTaskStatus(task.status) === 'DONE';
          const recurring = isRecurringTask(task);
          const accentColor = getTaskAccentColor(task);
          return (
            <Pressable
              key={task.id}
              onPress={() => {
                if (selectionMode) {
                  toggleSelectTask(task.id);
                  return;
                }
                onOpenTask?.(task.id);
              }}
              style={[
                styles.taskCard,
                {
                  borderColor: selected ? `${ui.primary}55` : ui.border,
                  backgroundColor: selected ? `${ui.primary}10` : ui.surface,
                  opacity: done ? 0.78 : 1,
                  shadowColor: '#000',
                  shadowOpacity: ui.shadowOpacity,
                },
              ]}
            >
              <View style={styles.taskCardTop}>
                <View style={styles.taskCardTop}>
                  {!selectionMode && recurring ? (
                    <View style={[styles.recurringLeading, { backgroundColor: colors.cardSoft }]}>
                      <Ionicons
                        name="repeat-outline"
                        size={26}
                        color={isDark ? '#8FA0C7' : '#8EA6C8'}
                      />
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => {
                        if (selectionMode) {
                          toggleSelectTask(task.id);
                          return;
                        }
                        onChangeTaskStatus?.(task.id, done ? 'TODO' : 'DONE');
                      }}
                      style={[
                        styles.checkbox,
                        {
                          borderWidth: selectionMode ? (selected ? 0 : 1.5) : done ? 0 : 1.5,
                          borderColor: selectionMode ? (selected ? ui.primary : ui.checkboxBorder) : done ? ui.success : ui.checkboxBorder,
                          backgroundColor: selectionMode ? (selected ? ui.primary : 'transparent') : done ? ui.success : 'transparent',
                        },
                      ]}
                    >
                      {(selectionMode && selected) || (!selectionMode && done) ? (
                        <Ionicons name="checkmark" size={15} color="#fff" />
                      ) : null}
                    </Pressable>
                  )}
                  <View style={styles.taskMain}>
                    <Text
                      style={[styles.taskTitle, { color: ui.text, textDecorationLine: done ? 'line-through' : 'none' }]}
                      numberOfLines={1}
                    >
                      {task.title}
                    </Text>
                    <Text style={[styles.taskTime, { color: ui.subText }]} numberOfLines={1}>
                      {formatDateTime(task.start_time)} - {formatDateTime(task.end_time)}
                    </Text>
                    {!selectionMode ? (
                      <View style={styles.taskTagRow}>
                        <View style={styles.taskTagLeft}>
                          {task.tags?.slice(0, 2).map((tag) => (
                            <View
                              key={`${task.id}:${tag.tag_id}`}
                              style={[
                                styles.taskTag,
                                {
                                  backgroundColor: `${accentColor}${isDark ? '20' : '12'}`,
                                  borderColor: `${accentColor}${isDark ? '30' : '18'}`,
                                },
                              ]}
                            >
                              <Text style={[styles.taskTagText, { color: accentColor }]} numberOfLines={1}>
                                {tag.name}
                              </Text>
                            </View>
                          ))}
                          {recurring ? (
                            <View style={[styles.taskTag, { backgroundColor: colors.cardSoft, borderColor: ui.border }]}>
                              <Text style={[styles.taskTagText, { color: ui.subText }]} numberOfLines={1}>
                                반복 일정
                              </Text>
                            </View>
                          ) : null}
                          {task.tags && task.tags.length > 2 ? (
                            <Text style={[styles.taskMoreText, { color: ui.primary }]} numberOfLines={1}>
                              +{task.tags.length - 2} more
                            </Text>
                          ) : null}
                          <View
                            style={[
                              styles.statusPill,
                              {
                                borderColor: done ? '#86EFAC' : ui.border,
                                backgroundColor: done ? '#ECFDF5' : colors.cardSoft,
                              },
                            ]}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '800', color: done ? '#059669' : ui.subText }}>
                              {done ? '완료' : '완료 전'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
        {!filteredTasks.length ? <Text style={s.emptyText}>{t('tasksEmpty')}</Text> : null}
        {filteredTasks.length > 0 ? (
          <View style={styles.paginationRow}>
            <Pressable
              onPress={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              style={[styles.pageButton, { borderColor: ui.border, backgroundColor: ui.surface, opacity: page <= 1 ? 0.5 : 1 }]}
            >
              <Text style={[styles.pageButtonText, { color: ui.text }]}>이전</Text>
            </Pressable>
            <Text style={[styles.pageCount, { color: ui.subText }]}>
              {page} / {totalPages}
            </Text>
            <Pressable
              onPress={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              style={[styles.pageButton, { borderColor: ui.border, backgroundColor: ui.surface, opacity: page >= totalPages ? 0.5 : 1 }]}
            >
              <Text style={[styles.pageButtonText, { color: ui.text }]}>다음</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <OptionSheet
        title="상태"
        open={activeFilterSheet === 'status'}
        value={statusFilter}
        options={statusFilterOptions.map((item) => ({ key: item.key, label: item.label }))}
        onClose={() => setActiveFilterSheet(null)}
        onSelect={(value) => setStatusFilter(value)}
      />
      <OptionSheet
        title="정렬"
        open={activeFilterSheet === 'sort'}
        value={sortBy}
        options={sortOptions.map((item) => ({ key: item.key, label: item.label }))}
        onClose={() => setActiveFilterSheet(null)}
        onSelect={(value) => setSortBy(value)}
      />
      <OptionSheet
        title="카테고리"
        open={activeFilterSheet === 'tag'}
        value={tagFilter}
        options={tagOptions.map((item) => ({ key: item.key, label: item.label }))}
        onClose={() => setActiveFilterSheet(null)}
        onSelect={(value) => setTagFilter(value)}
      />
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
  sectionCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  topActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  chipButton: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  chipButtonWide: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerChipButton: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  selectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  selectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  selectionBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterRow: {
    marginTop: 2,
  },
  searchWrap: {
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 0,
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  filterChipText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  listWrap: {
    gap: 12,
  },
  taskCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
    minHeight: 88,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  taskCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recurringLeading: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskMain: {
    flex: 1,
    gap: 5,
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
    marginTop: 8,
  },
  taskTagLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  taskMoreText: {
    fontSize: 12,
    fontWeight: '700',
  },
  taskTag: {
    maxWidth: 104,
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
  statusPill: {
    flexShrink: 0,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  pageButton: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  pageCount: {
    fontSize: 14,
    fontWeight: '500',
  },
});
