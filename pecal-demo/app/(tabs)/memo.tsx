import React, { useState, useMemo } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList, TextInput,
  Modal, ScrollView, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components/screen-container';
import { useApp, genId } from '@/lib/app-context';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { Memo, MemoSortOrder } from '@/lib/types';

const SORT_OPTIONS: { value: MemoSortOrder; label: string }[] = [
  { value: 'latest', label: '최신순' },
  { value: 'oldest', label: '오래된순' },
  { value: 'title', label: '제목순' },
  { value: 'favorites', label: '즐겨찾기' },
];

function MemoEditSheet({
  visible, initial, onClose, onSave, onDelete,
}: {
  visible: boolean;
  initial?: Memo | null;
  onClose: () => void;
  onSave: (title: string, content: string) => void;
  onDelete?: () => void;
}) {
  const colors = useColors();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');

  React.useEffect(() => {
    if (visible) {
      setTitle(initial?.title ?? '');
      setContent(initial?.content ?? '');
    }
  }, [visible, initial]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              {initial ? '메모 편집' : '새 메모'}
            </Text>
            <View style={styles.sheetActions}>
              {initial && onDelete && (
                <Pressable
                  style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
                  onPress={onDelete}
                >
                  <IconSymbol name="trash" size={18} color={colors.error} />
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
                onPress={onClose}
              >
                <IconSymbol name="xmark" size={20} color={colors.muted} />
              </Pressable>
            </View>
          </View>

          <View style={styles.memoEditorContainer}>
            <TextInput
              style={[styles.memoTitleInput, { color: colors.foreground, borderBottomColor: colors.border }]}
              placeholder="제목"
              placeholderTextColor={colors.muted}
              value={title}
              onChangeText={setTitle}
              returnKeyType="next"
              autoFocus={!initial}
            />
            <TextInput
              style={[styles.memoContentInput, { color: colors.foreground }]}
              placeholder="내용을 입력하세요..."
              placeholderTextColor={colors.muted}
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={[styles.sheetFooter, { borderTopColor: colors.border }]}>
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: title.trim() ? colors.primary : colors.border },
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => title.trim() && onSave(title, content)}
              disabled={!title.trim()}
            >
              <Text style={[styles.saveBtnText, { color: title.trim() ? '#fff' : colors.muted }]}>
                {initial ? '저장' : '추가'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MemoCard({ item, onPress, onFavorite }: { item: Memo; onPress: () => void; onFavorite: () => void }) {
  const colors = useColors();
  const preview = item.content.split('\n').filter(l => l.trim()).slice(0, 2).join(' · ');

  return (
    <Pressable
      style={({ pressed }) => [
        styles.memoCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && { opacity: 0.8 },
      ]}
      onPress={onPress}
    >
      <View style={styles.memoCardTop}>
        <Text style={[styles.memoCardTitle, { color: colors.foreground }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.favoriteBtn, pressed && { opacity: 0.6 }]}
          onPress={onFavorite}
        >
          <IconSymbol
            name={item.isFavorite ? 'star.fill' : 'star'}
            size={18}
            color={item.isFavorite ? '#F59E0B' : colors.muted}
          />
        </Pressable>
      </View>
      {preview ? (
        <Text style={[styles.memoCardPreview, { color: colors.muted }]} numberOfLines={2}>
          {preview}
        </Text>
      ) : null}
      <Text style={[styles.memoCardDate, { color: colors.border }]}>
        {new Date(item.updatedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
      </Text>
    </Pressable>
  );
}

export default function MemoScreen() {
  const { workspaceMemos, state, dispatch } = useApp();
  const colors = useColors();
  const [search, setSearch] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Memo | null>(null);
  const sortOrder = state.memoSortOrder;

  const filtered = useMemo(() => {
    let memos = workspaceMemos;
    if (search.trim()) {
      const q = search.toLowerCase();
      memos = memos.filter(m => m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q));
    }
    switch (sortOrder) {
      case 'latest': return [...memos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      case 'oldest': return [...memos].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
      case 'title': return [...memos].sort((a, b) => a.title.localeCompare(b.title));
      case 'favorites': return [...memos].sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));
      default: return memos;
    }
  }, [workspaceMemos, search, sortOrder]);

  const handleSave = (title: string, content: string) => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (editTarget) {
      dispatch({
        type: 'UPDATE_MEMO',
        payload: { ...editTarget, title, content, updatedAt: new Date().toISOString() },
      });
    } else {
      dispatch({
        type: 'ADD_MEMO',
        payload: {
          id: genId('memo'),
          title,
          content,
          isFavorite: false,
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
    dispatch({ type: 'DELETE_MEMO', payload: editTarget.id });
    setSheetVisible(false);
    setEditTarget(null);
  };

  return (
    <ScreenContainer edges={['left', 'right']}>
      {/* Search & Sort Bar */}
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="메모 검색..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Sort Options */}
      <View style={[styles.sortBar, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortScroll}>
          {SORT_OPTIONS.map(opt => (
            <Pressable
              key={opt.value}
              style={[
                styles.sortChip,
                { backgroundColor: sortOrder === opt.value ? colors.primary : colors.surface, borderColor: sortOrder === opt.value ? colors.primary : colors.border },
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                dispatch({ type: 'SET_MEMO_SORT', payload: opt.value });
              }}
            >
              {opt.value === 'favorites' && (
                <IconSymbol name="star.fill" size={12} color={sortOrder === opt.value ? '#fff' : '#F59E0B'} />
              )}
              <Text style={[styles.sortChipText, { color: sortOrder === opt.value ? '#fff' : colors.muted }]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Memo List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <MemoCard
            item={item}
            onPress={() => { setEditTarget(item); setSheetVisible(true); }}
            onFavorite={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              dispatch({ type: 'TOGGLE_MEMO_FAVORITE', payload: item.id });
            }}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <IconSymbol name="note.text" size={48} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {search ? '검색 결과가 없습니다' : '메모가 없습니다'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
              {search ? '다른 검색어를 시도해보세요' : '+ 버튼을 눌러 메모를 작성하세요'}
            </Text>
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

      <MemoEditSheet
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
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  sortBar: {
    borderBottomWidth: 0.5,
  },
  sortScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  sortChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    gap: 10,
    paddingBottom: 100,
  },
  memoCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  memoCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  memoCardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  favoriteBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoCardPreview: {
    fontSize: 13,
    lineHeight: 18,
  },
  memoCardDate: {
    fontSize: 11,
    marginTop: 2,
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
  // Sheet
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
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
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoEditorContainer: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 0,
  },
  memoTitleInput: {
    fontSize: 20,
    fontWeight: '700',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    marginBottom: 12,
  },
  memoContentInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
  },
  sheetFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 0.5,
  },
  saveBtn: {
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
