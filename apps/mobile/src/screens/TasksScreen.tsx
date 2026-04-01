import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
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
  onOpenCreateTask,
  onOpenTask,
  onChangeTaskStatus,
  onDeleteTasks,
}: Props) {
  const { colors } = useThemeMode();
  const { t } = useI18n();
  const s = createStyles(colors);
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
        if (sortBy === 'START_DESC') return b.start_time.localeCompare(a.start_time);
        return a.start_time.localeCompare(b.start_time);
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
    <View style={s.section}>
      <GsxCard className="mb-1">
        <View style={{ gap: 10 }}>
          <View style={{ gap: 3 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>{t('tasksHeaderSub')}</Text>
            <GsxHeading className="text-3xl">{t('commonTasks')}</GsxHeading>
          </View>

          {selectionMode ? (
            <View style={{ gap: 8 }}>
              <View
                style={{
                  alignSelf: 'flex-start',
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: `${colors.primary}12`,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>
                  선택됨 {selectedTaskIds.length}개
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <GsxButton
                  label="선택해제"
                  onPress={exitSelectionMode}
                />
                <GsxButton
                  label={areAllPagedSelected ? '현재 페이지 해제' : '현재 페이지 모두선택'}
                  onPress={toggleSelectAllFiltered}
                />
                <GsxButton
                  label={deletingSelected ? '삭제 중...' : `삭제 (${selectedTaskIds.length})`}
                  variant="danger"
                  loading={deletingSelected}
                  disabled={selectedTaskIds.length === 0 || deletingSelected}
                  onPress={() => void deleteSelectedTasks()}
                />
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <GsxButton
                label={`+ ${t('commonCreate')}`}
                variant="primary"
                onPress={onOpenCreateTask}
              />
              <GsxButton
                label="선택"
                onPress={() => setSelectionMode(true)}
              />
            </View>
          )}
        </View>
      </GsxCard>

      <GsxCard className="gap-2">
        <Text style={s.formTitle}>검색/필터</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="일정 검색"
          style={s.input}
          placeholderTextColor={colors.textMuted}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <GsxChip
              label={statusFilterOptions.find((item) => item.key === statusFilter)?.label ?? '전체'}
              onPress={() => setActiveFilterSheet('status')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <GsxChip
              label={sortOptions.find((item) => item.key === sortBy)?.label ?? '빠른 일정순'}
              onPress={() => setActiveFilterSheet('sort')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <GsxChip
              label={tagOptions.find((item) => item.key === tagFilter)?.label ?? '카테고리 전체'}
              onPress={() => setActiveFilterSheet('tag')}
            />
          </View>
        </View>
      </GsxCard>

      <View style={{ gap: 8 }}>
        {pagedTasks.map((task) => {
          const accentColor = getTaskAccentColor(task);
          const selected = selectedTaskIds.includes(task.id);
          const done = normalizeTaskStatus(task.status) === 'DONE';
          return (
            <View
              key={task.id}
              style={{
                position: 'relative',
                zIndex: 1,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                borderLeftWidth: 4,
                borderLeftColor: accentColor,
                backgroundColor: selected ? `${colors.primary}14` : colors.card,
                padding: 12,
                gap: 6,
              }}
            >
              <Pressable
                onPress={() => {
                  if (selectionMode) {
                    toggleSelectTask(task.id);
                    return;
                  }
                  onOpenTask?.(task.id);
                }}
                style={{ gap: 6 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      if (selectionMode) {
                        toggleSelectTask(task.id);
                        return;
                      }
                      onChangeTaskStatus?.(task.id, done ? 'TODO' : 'DONE');
                    }}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: selectionMode
                        ? selected ? 0 : 1.5
                        : done ? 0 : 1.5,
                      borderColor: selectionMode
                        ? selected ? colors.primary : colors.border
                        : done ? '#10B981' : colors.border,
                      backgroundColor: selectionMode
                        ? selected ? colors.primary : 'transparent'
                        : done ? '#10B981' : 'transparent',
                    }}
                  >
                    {(selectionMode && selected) || (!selectionMode && done) ? (
                      <Ionicons name="checkmark" size={15} color="#fff" />
                    ) : null}
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      if (selectionMode) {
                        toggleSelectTask(task.id);
                        return;
                      }
                      onOpenTask?.(task.id);
                    }}
                    style={{ flex: 1, gap: 6 }}
                  >
                    <Text
                      style={[
                        s.itemTitle,
                        {
                          textDecorationLine: done ? 'line-through' : 'none',
                          color: done ? colors.textMuted : colors.text,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {task.title}
                    </Text>
                    <Text style={s.itemMeta}>{formatDateTime(task.start_time)} - {formatDateTime(task.end_time)}</Text>
                  </Pressable>
                  {!selectionMode ? (
                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 9,
                        paddingVertical: 4,
                        borderWidth: 1,
                        borderColor: done ? '#86EFAC' : colors.border,
                        backgroundColor: done ? '#ECFDF5' : colors.cardSoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '800', color: done ? '#059669' : colors.textMuted }}>
                        {done ? '완료' : '완료 전'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            </View>
          );
        })}
        {!filteredTasks.length ? <Text style={s.emptyText}>{t('tasksEmpty')}</Text> : null}
        {filteredTasks.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <Pressable
              onPress={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              style={[
                s.workspacePill,
                { marginRight: 0, paddingVertical: 7, paddingHorizontal: 12, opacity: page <= 1 ? 0.5 : 1 },
              ]}
            >
              <Text style={s.workspacePillText}>이전</Text>
            </Pressable>
            <Text style={s.itemMeta}>
              {page} / {totalPages}
            </Text>
            <Pressable
              onPress={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              style={[
                s.workspacePill,
                { marginRight: 0, paddingVertical: 7, paddingHorizontal: 12, opacity: page >= totalPages ? 0.5 : 1 },
              ]}
            >
              <Text style={s.workspacePillText}>다음</Text>
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
