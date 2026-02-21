import React, { useState, useMemo } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList, TextInput,
  Modal, ScrollView, Platform, TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components/screen-container';
import { useApp, genId } from '@/lib/app-context';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { Schedule, ScheduleStatus, ScheduleColor, Tag } from '@/lib/types';
import { SCHEDULE_COLORS, TAG_COLORS } from '@/lib/types';

const STATUS_OPTIONS: { value: ScheduleStatus; label: string; color: string }[] = [
  { value: 'TODO', label: 'TODO', color: '#6B7280' },
  { value: 'IN_PROGRESS', label: '진행중', color: '#5B6CF6' },
  { value: 'DONE', label: '완료', color: '#10B981' },
];

function TagChip({ tag, selected, onPress }: { tag: Tag; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[
        styles.tagChip,
        { backgroundColor: selected ? tag.color + '30' : tag.color + '15', borderColor: selected ? tag.color : 'transparent' },
      ]}
      onPress={onPress}
    >
      <View style={[styles.tagDot, { backgroundColor: tag.color }]} />
      <Text style={[styles.tagChipText, { color: tag.color }]}>{tag.name}</Text>
    </Pressable>
  );
}

interface ScheduleFormData {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  status: ScheduleStatus;
  color: ScheduleColor;
  tagIds: string[];
}

function ScheduleFormSheet({
  visible, initial, onClose, onSave, onDelete,
}: {
  visible: boolean;
  initial?: Schedule | null;
  onClose: () => void;
  onSave: (data: ScheduleFormData) => void;
  onDelete?: () => void;
}) {
  const colors = useColors();
  const { workspaceTags } = useApp();
  const [form, setForm] = useState<ScheduleFormData>({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    date: initial?.date ?? new Date().toISOString().split('T')[0],
    startTime: initial?.startTime ?? '',
    endTime: initial?.endTime ?? '',
    status: initial?.status ?? 'TODO',
    color: initial?.color ?? '#5B6CF6',
    tagIds: initial?.tagIds ?? [],
  });

  React.useEffect(() => {
    if (visible) {
      setForm({
        title: initial?.title ?? '',
        description: initial?.description ?? '',
        date: initial?.date ?? new Date().toISOString().split('T')[0],
        startTime: initial?.startTime ?? '',
        endTime: initial?.endTime ?? '',
        status: initial?.status ?? 'TODO',
        color: initial?.color ?? '#5B6CF6',
        tagIds: initial?.tagIds ?? [],
      });
    }
  }, [visible, initial]);

  const toggleTag = (id: string) => {
    setForm(f => ({
      ...f,
      tagIds: f.tagIds.includes(id) ? f.tagIds.filter(t => t !== id) : [...f.tagIds, id],
    }));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              {initial ? '일정 수정' : '일정 추가'}
            </Text>
            <View style={styles.sheetActions}>
              {initial && onDelete && (
                <Pressable
                  style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
                  onPress={onDelete}
                >
                  <IconSymbol name="trash" size={18} color={colors.error} />
                </Pressable>
              )}
              <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}>
                <IconSymbol name="xmark" size={20} color={colors.muted} />
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.sheetContent} showsVerticalScrollIndicator={false}>
            {/* Title */}
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>제목 *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              placeholder="일정 제목"
              placeholderTextColor={colors.muted}
              value={form.title}
              onChangeText={v => setForm(f => ({ ...f, title: v }))}
              returnKeyType="next"
            />

            {/* Date */}
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>날짜</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              value={form.date}
              onChangeText={v => setForm(f => ({ ...f, date: v }))}
              returnKeyType="next"
            />

            {/* Time */}
            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>시작 시간</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="HH:MM"
                  placeholderTextColor={colors.muted}
                  value={form.startTime}
                  onChangeText={v => setForm(f => ({ ...f, startTime: v }))}
                  returnKeyType="next"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>종료 시간</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="HH:MM"
                  placeholderTextColor={colors.muted}
                  value={form.endTime}
                  onChangeText={v => setForm(f => ({ ...f, endTime: v }))}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Status */}
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>상태</Text>
            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map(s => (
                <Pressable
                  key={s.value}
                  style={[
                    styles.statusOption,
                    { backgroundColor: form.status === s.value ? s.color + '20' : colors.surface, borderColor: form.status === s.value ? s.color : colors.border },
                  ]}
                  onPress={() => setForm(f => ({ ...f, status: s.value }))}
                >
                  <Text style={[styles.statusOptionText, { color: form.status === s.value ? s.color : colors.muted }]}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Color */}
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>색상</Text>
            <View style={styles.colorRow}>
              {SCHEDULE_COLORS.map(c => (
                <Pressable
                  key={c}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    form.color === c && styles.colorDotSelected,
                  ]}
                  onPress={() => setForm(f => ({ ...f, color: c as ScheduleColor }))}
                >
                  {form.color === c && <IconSymbol name="checkmark" size={12} color="#fff" />}
                </Pressable>
              ))}
            </View>

            {/* Tags */}
            {workspaceTags.length > 0 && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>태그</Text>
                <View style={styles.tagsRow}>
                  {workspaceTags.map(tag => (
                    <TagChip
                      key={tag.id}
                      tag={tag}
                      selected={form.tagIds.includes(tag.id)}
                      onPress={() => toggleTag(tag.id)}
                    />
                  ))}
                </View>
              </>
            )}

            {/* Description */}
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>메모 (선택)</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              placeholder="추가 설명"
              placeholderTextColor={colors.muted}
              value={form.description}
              onChangeText={v => setForm(f => ({ ...f, description: v }))}
              multiline
              numberOfLines={3}
            />

            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: form.title.trim() ? colors.primary : colors.border },
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => form.title.trim() && onSave(form)}
              disabled={!form.title.trim()}
            >
              <Text style={[styles.saveBtnText, { color: form.title.trim() ? '#fff' : colors.muted }]}>
                {initial ? '저장' : '추가'}
              </Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ScheduleCard({ item, onPress }: { item: Schedule; onPress: () => void }) {
  const colors = useColors();
  const { workspaceTags } = useApp();
  const tags = workspaceTags.filter(t => item.tagIds.includes(t.id));
  const statusOpt = STATUS_OPTIONS.find(s => s.value === item.status);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.scheduleCard,
        { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: item.color },
        pressed && { opacity: 0.8 },
      ]}
      onPress={onPress}
    >
      <View style={styles.cardTop}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: (statusOpt?.color ?? '#6B7280') + '20' }]}>
          <Text style={[styles.statusBadgeText, { color: statusOpt?.color ?? '#6B7280' }]}>
            {statusOpt?.label}
          </Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <IconSymbol name="calendar" size={12} color={colors.muted} />
        <Text style={[styles.cardDate, { color: colors.muted }]}>
          {item.date}{item.startTime ? ` · ${item.startTime}` : ''}
        </Text>
      </View>
      {tags.length > 0 && (
        <View style={styles.cardTags}>
          {tags.map(tag => (
            <View key={tag.id} style={[styles.cardTag, { backgroundColor: tag.color + '20' }]}>
              <Text style={[styles.cardTagText, { color: tag.color }]}>{tag.name}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

export default function ScheduleScreen() {
  const { workspaceSchedules, workspaceTags, dispatch } = useApp();
  const colors = useColors();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Schedule | null>(null);
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<ScheduleStatus | 'ALL'>('ALL');

  const filtered = useMemo(() => {
    return workspaceSchedules
      .filter(s => {
        if (filterStatus !== 'ALL' && s.status !== filterStatus) return false;
        if (filterTagIds.length > 0 && !filterTagIds.some(id => s.tagIds.includes(id))) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [workspaceSchedules, filterStatus, filterTagIds]);

  const handleSave = (data: ScheduleFormData) => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (editTarget) {
      dispatch({
        type: 'UPDATE_SCHEDULE',
        payload: { ...editTarget, ...data, updatedAt: new Date().toISOString() },
      });
    } else {
      dispatch({
        type: 'ADD_SCHEDULE',
        payload: {
          id: genId('sch'),
          ...data,
          workspaceId: 'ws-personal',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    }
    setSheetVisible(false);
    setEditTarget(null);
  };

  const handleDelete = () => {
    if (!editTarget) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    dispatch({ type: 'DELETE_SCHEDULE', payload: editTarget.id });
    setSheetVisible(false);
    setEditTarget(null);
  };

  const toggleTagFilter = (id: string) => {
    setFilterTagIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  return (
    <ScreenContainer edges={['left', 'right']}>
      {/* Filter Bar */}
      <View style={[styles.filterBar, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {/* Status Filter */}
          <Pressable
            style={[styles.filterChip, { backgroundColor: filterStatus === 'ALL' ? colors.primary : colors.surface, borderColor: filterStatus === 'ALL' ? colors.primary : colors.border }]}
            onPress={() => setFilterStatus('ALL')}
          >
            <Text style={[styles.filterChipText, { color: filterStatus === 'ALL' ? '#fff' : colors.muted }]}>전체</Text>
          </Pressable>
          {STATUS_OPTIONS.map(s => (
            <Pressable
              key={s.value}
              style={[styles.filterChip, { backgroundColor: filterStatus === s.value ? s.color + '20' : colors.surface, borderColor: filterStatus === s.value ? s.color : colors.border }]}
              onPress={() => setFilterStatus(prev => prev === s.value ? 'ALL' : s.value)}
            >
              <Text style={[styles.filterChipText, { color: filterStatus === s.value ? s.color : colors.muted }]}>{s.label}</Text>
            </Pressable>
          ))}
          {/* Tag Filters */}
          {workspaceTags.map(tag => (
            <Pressable
              key={tag.id}
              style={[styles.filterChip, { backgroundColor: filterTagIds.includes(tag.id) ? tag.color + '20' : colors.surface, borderColor: filterTagIds.includes(tag.id) ? tag.color : colors.border }]}
              onPress={() => toggleTagFilter(tag.id)}
            >
              <View style={[styles.tagDot, { backgroundColor: tag.color }]} />
              <Text style={[styles.filterChipText, { color: filterTagIds.includes(tag.id) ? tag.color : colors.muted }]}>{tag.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ScheduleCard
            item={item}
            onPress={() => { setEditTarget(item); setSheetVisible(true); }}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <IconSymbol name="list.bullet" size={48} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>일정이 없습니다</Text>
            <Text style={[styles.emptySubtitle, { color: colors.muted }]}>+ 버튼을 눌러 일정을 추가하세요</Text>
          </View>
        }
      />

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [styles.fab, { backgroundColor: colors.primary }, pressed && { transform: [{ scale: 0.95 }], opacity: 0.9 }]}
        onPress={() => { setEditTarget(null); setSheetVisible(true); }}
      >
        <IconSymbol name="plus" size={24} color="#fff" />
      </Pressable>

      <ScheduleFormSheet
        visible={sheetVisible}
        initial={editTarget}
        onClose={() => { setSheetVisible(false); setEditTarget(null); }}
        onSave={handleSave}
        onDelete={editTarget ? handleDelete : undefined}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  filterBar: {
    borderBottomWidth: 0.5,
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  listContent: {
    padding: 16,
    gap: 10,
    paddingBottom: 100,
  },
  scheduleCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 14,
    gap: 6,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardDate: {
    fontSize: 12,
  },
  cardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  cardTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5B6CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  // Sheet styles
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: 40,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  sheetActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetContent: {
    paddingHorizontal: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  statusOptionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 5,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
