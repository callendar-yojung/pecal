import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { formatDateTime } from '../lib/date';
import type { TagItem, TaskItem, TaskStatus } from '../lib/types';
import { getTaskAccentColor, getTaskStatusColor } from '../lib/task-colors';
import { useThemeMode } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { createStyles } from '../styles/createStyles';

type Props = {
  tasks: TaskItem[];
  tags: TagItem[];
  onOpenCreateTask?: () => void;
  onOpenTask?: (taskId: number) => void;
};

function statusLabel(status: string | undefined, t: (key: string) => string) {
  if (status === 'IN_PROGRESS') return t('tasksStatusProgress');
  if (status === 'DONE') return t('tasksStatusDone');
  return t('tasksStatusTodo');
}

export function TasksScreen({
  tasks,
  tags,
  onOpenCreateTask,
  onOpenTask,
}: Props) {
  const { colors } = useThemeMode();
  const { t } = useI18n();
  const s = createStyles(colors);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TaskStatus>('ALL');
  const [tagFilter, setTagFilter] = useState<number | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'START_ASC' | 'START_DESC' | 'TITLE_ASC'>('START_DESC');
  const [page, setPage] = useState(1);
  const pageSize = 10;

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
        if (sortBy === 'START_DESC') return b.start_time.localeCompare(a.start_time);
        return a.start_time.localeCompare(b.start_time);
      });
  }, [tasks, statusFilter, tagFilter, query, sortBy]);

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
        <View style={s.row}>
          {(['ALL', 'TODO', 'IN_PROGRESS', 'DONE'] as const).map((status) => (
            <Pressable
              key={status}
              onPress={() => setStatusFilter(status)}
              style={[
                s.workspacePill,
                { marginRight: 0, paddingVertical: 7, paddingHorizontal: 10 },
                statusFilter === status ? s.workspacePillActive : null,
              ]}
            >
              <Text style={[s.workspacePillText, statusFilter === status ? s.workspacePillTextActive : null]}>
                {status === 'ALL' ? '전체' : statusLabel(status, t)}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={s.row}>
          <Pressable
            onPress={() => setTagFilter('ALL')}
            style={[
              s.workspacePill,
              { marginRight: 0, paddingVertical: 7, paddingHorizontal: 10 },
              tagFilter === 'ALL' ? s.workspacePillActive : null,
            ]}
          >
            <Text style={[s.workspacePillText, tagFilter === 'ALL' ? s.workspacePillTextActive : null]}>태그 전체</Text>
          </Pressable>
          {tags.slice(0, 6).map((tag) => (
            <Pressable
              key={tag.tag_id}
              onPress={() => setTagFilter(tag.tag_id)}
              style={[
                s.workspacePill,
                { marginRight: 0, paddingVertical: 7, paddingHorizontal: 10 },
                tagFilter === tag.tag_id ? s.workspacePillActive : null,
              ]}
            >
              <Text style={[s.workspacePillText, tagFilter === tag.tag_id ? s.workspacePillTextActive : null]}>
                {tag.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={s.row}>
          {[
            { key: 'START_ASC', label: '시작 빠른순' },
            { key: 'START_DESC', label: '시작 늦은순' },
            { key: 'TITLE_ASC', label: '제목순' },
          ].map((option) => (
            <Pressable
              key={option.key}
              onPress={() => setSortBy(option.key as 'START_ASC' | 'START_DESC' | 'TITLE_ASC')}
              style={[
                s.workspacePill,
                { marginRight: 0, paddingVertical: 7, paddingHorizontal: 10 },
                sortBy === option.key ? s.workspacePillActive : null,
              ]}
            >
              <Text style={[s.workspacePillText, sortBy === option.key ? s.workspacePillTextActive : null]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        {pagedTasks.map((task) => {
          const badgeColor = getTaskStatusColor(task.status);
          const accentColor = getTaskAccentColor(task);
          return (
            <Pressable
              key={task.id}
              onPress={() => onOpenTask?.(task.id)}
              style={{
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
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Text style={[s.itemTitle, { flex: 1 }]} numberOfLines={1}>{task.title}</Text>
                <View style={{ backgroundColor: `${badgeColor}22`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                  <Text style={{ color: badgeColor, fontSize: 11, fontWeight: '700' }}>{statusLabel(task.status, t)}</Text>
                </View>
              </View>
              <Text style={s.itemMeta}>{formatDateTime(task.start_time)} - {formatDateTime(task.end_time)}</Text>
            </Pressable>
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
    </View>
  );
}
