import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDateTime } from '../lib/date';
import type { TagItem, TaskItem, TaskStatus } from '../lib/types';
import { getTaskAccentColor } from '../lib/task-colors';
import { useThemeMode } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { createStyles } from '../styles/createStyles';
import { OptionSheet } from '../components/common/OptionSheet';
import { SelectDropdown } from '../components/common/SelectDropdown';

type Props = {
  tasks: TaskItem[];
  tags: TagItem[];
  onOpenCreateTask?: () => void;
  onOpenTask?: (taskId: number) => void;
  onChangeTaskStatus?: (taskId: number, status: TaskStatus) => void;
};

export function TasksScreen({
  tasks,
  tags,
  onOpenCreateTask,
  onOpenTask,
  onChangeTaskStatus,
}: Props) {
  const { colors } = useThemeMode();
  const { t } = useI18n();
  const s = createStyles(colors);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TaskStatus>('ALL');
  const [tagFilter, setTagFilter] = useState<number | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'START_ASC' | 'START_DESC' | 'TITLE_ASC' | 'TITLE_DESC'>('START_DESC');
  const [activeFilterSheet, setActiveFilterSheet] = useState<'status' | 'sort' | 'tag' | null>(null);
  const [statusDropdownTaskId, setStatusDropdownTaskId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const sortOptions = [
    { key: 'START_ASC', label: '빠른 일정순' },
    { key: 'START_DESC', label: '늦은 일정순' },
    { key: 'TITLE_ASC', label: '이름 A-Z' },
    { key: 'TITLE_DESC', label: '이름 Z-A' },
  ] as const;

  const todoCount = tasks.filter((task) => task.status !== 'DONE').length;
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        if (statusFilter !== 'ALL' && (task.status ?? 'TODO') !== statusFilter) return false;
        if (tagFilter !== 'ALL' && !(task.tag_ids ?? []).includes(tagFilter)) return false;
        if (query.trim()) {
          const q = query.trim().toLowerCase();
          if (!task.title.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'TITLE_ASC') return a.title.localeCompare(b.title);
        if (sortBy === 'TITLE_DESC') return b.title.localeCompare(a.title);
        if (sortBy === 'START_DESC') return b.start_time.localeCompare(a.start_time);
        return a.start_time.localeCompare(b.start_time);
      });
  }, [tasks, statusFilter, tagFilter, query, sortBy]);

  const statusFilterOptions = [
    { key: 'ALL', label: '전체' },
    { key: 'TODO', label: '예정' },
    { key: 'IN_PROGRESS', label: '진행중' },
    { key: 'DONE', label: '완료' },
  ] as const;
  const tagOptions = [{ key: 'ALL' as const, label: '태그 전체' }, ...tags.map((tag) => ({ key: tag.tag_id, label: tag.name }))];
  const taskStatusOptions = [
    { key: 'TODO', label: '예정' },
    { key: 'IN_PROGRESS', label: '진행중' },
    { key: 'DONE', label: '완료' },
  ] as const;

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

  return (
    <View style={s.section}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ gap: 3 }}>
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>{t('tasksHeaderSub')}</Text>
          <Text style={[s.sectionTitle, { fontSize: 24 }]}>{t('commonTasks')}</Text>
        </View>
        <Pressable style={[s.primaryButton, { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 }]} onPress={onOpenCreateTask}>
          <Text style={s.primaryButtonText}>+ {t('commonCreate')}</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={[s.panel, { flex: 1, borderRadius: 16, paddingVertical: 10 }]}> 
          <Text style={s.gridLabel}>{t('tasksTotal')}</Text>
          <Text style={[s.gridValue, { fontSize: 30 }]}>{tasks.length}</Text>
        </View>
        <View style={[s.panel, { flex: 1, borderRadius: 16, paddingVertical: 10 }]}> 
          <Text style={s.gridLabel}>{t('tasksTodo')}</Text>
          <Text style={[s.gridValue, { fontSize: 30 }]}>{todoCount}</Text>
        </View>
      </View>

      <View style={[s.panel, { borderRadius: 16, gap: 8 }]}>
        <Text style={s.formTitle}>검색/필터</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="일정 검색"
          style={s.input}
          placeholderTextColor={colors.textMuted}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => setActiveFilterSheet('status')}
            style={[s.input, { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }]}
          >
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', flexShrink: 1 }}>
              {statusFilterOptions.find((item) => item.key === statusFilter)?.label ?? '전체'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable
            onPress={() => setActiveFilterSheet('sort')}
            style={[s.input, { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }]}
          >
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', flexShrink: 1 }}>
              {sortOptions.find((item) => item.key === sortBy)?.label ?? '빠른 일정순'}
            </Text>
            <Ionicons name="swap-vertical" size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable
            onPress={() => setActiveFilterSheet('tag')}
            style={[s.input, { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }]}
          >
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
              {tagOptions.find((item) => item.key === tagFilter)?.label ?? '태그 전체'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        {pagedTasks.map((task) => {
          const accentColor = getTaskAccentColor(task);
          const statusMenuOpen = statusDropdownTaskId === task.id;
          return (
            <View
              key={task.id}
              style={{
                position: 'relative',
                zIndex: statusMenuOpen ? 100 : 1,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                borderLeftWidth: 4,
                borderLeftColor: accentColor,
                backgroundColor: colors.card,
                padding: 12,
                gap: 6,
              }}
            >
              <Pressable onPress={() => onOpenTask?.(task.id)} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={[s.itemTitle, { flex: 1 }]} numberOfLines={1}>{task.title}</Text>
                  <SelectDropdown
                    value={(task.status ?? 'TODO') as TaskStatus}
                    options={taskStatusOptions}
                    open={statusDropdownTaskId === task.id}
                    onToggle={() => setStatusDropdownTaskId((prev) => (prev === task.id ? null : task.id))}
                    onSelect={(value) => {
                      setStatusDropdownTaskId(null);
                      onChangeTaskStatus?.(task.id, value);
                    }}
                    style="pill"
                    menuMode="overlay"
                  />
                </View>
                <Text style={s.itemMeta}>{formatDateTime(task.start_time)} - {formatDateTime(task.end_time)}</Text>
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
        title="태그"
        open={activeFilterSheet === 'tag'}
        value={tagFilter}
        options={tagOptions.map((item) => ({ key: item.key, label: item.label }))}
        onClose={() => setActiveFilterSheet(null)}
        onSelect={(value) => setTagFilter(value)}
      />
    </View>
  );
}
