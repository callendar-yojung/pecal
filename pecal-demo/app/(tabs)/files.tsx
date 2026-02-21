import React, { useState, useMemo } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList, Alert, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components/screen-container';
import { useApp } from '@/lib/app-context';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { AppFile, FileFilter } from '@/lib/types';

const FILTER_OPTIONS: { value: FileFilter; label: string; icon: string }[] = [
  { value: 'all', label: '전체', icon: 'doc.fill' },
  { value: 'image', label: '이미지', icon: 'photo.fill' },
  { value: 'document', label: '문서', icon: 'doc.text' },
  { value: 'other', label: '기타', icon: 'folder.fill' },
];

const FILE_ICONS: Record<string, string> = {
  image: 'photo.fill',
  document: 'doc.text',
  other: 'folder.fill',
};

const FILE_COLORS: Record<string, string> = {
  image: '#10B981',
  document: '#5B6CF6',
  other: '#F97316',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileItem({
  item,
  isSelectionMode,
  isSelected,
  onPress,
  onLongPress,
}: {
  item: AppFile;
  isSelectionMode: boolean;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const colors = useColors();
  const iconColor = FILE_COLORS[item.type] ?? '#6B7280';
  const ext = item.name.split('.').pop()?.toUpperCase() ?? '';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.fileItem,
        { backgroundColor: isSelected ? colors.primary + '15' : colors.card, borderColor: isSelected ? colors.primary : colors.border },
        pressed && { opacity: 0.75 },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {/* Checkbox or Icon */}
      {isSelectionMode ? (
        <View style={[
          styles.checkbox,
          { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : 'transparent' },
        ]}>
          {isSelected && <IconSymbol name="checkmark" size={12} color="#fff" />}
        </View>
      ) : (
        <View style={[styles.fileIconBg, { backgroundColor: iconColor + '20' }]}>
          <IconSymbol name={FILE_ICONS[item.type] as any} size={22} color={iconColor} />
        </View>
      )}

      {/* File Info */}
      <View style={styles.fileInfo}>
        <Text style={[styles.fileName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.fileMeta, { color: colors.muted }]}>
          {formatFileSize(item.size)} · {new Date(item.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
        </Text>
      </View>

      {/* Extension Badge */}
      {!isSelectionMode && (
        <View style={[styles.extBadge, { backgroundColor: iconColor + '20' }]}>
          <Text style={[styles.extText, { color: iconColor }]}>{ext}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function FilesScreen() {
  const { workspaceFiles, state, dispatch } = useApp();
  const colors = useColors();
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const filter = state.fileFilter;

  const filtered = useMemo(() => {
    if (filter === 'all') return workspaceFiles;
    return workspaceFiles.filter(f => f.type === filter);
  }, [workspaceFiles, filter]);

  const handleItemPress = (item: AppFile) => {
    if (isSelectionMode) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
    }
    // In normal mode, would open file preview
  };

  const handleLongPress = (item: AppFile) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSelectionMode(true);
    setSelectedIds(new Set([item.id]));
  };

  const handleSelectAll = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(f => f.id)));
    }
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    dispatch({ type: 'DELETE_FILES', payload: Array.from(selectedIds) });
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDownload = () => {
    if (selectedIds.size === 0) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // In a real app, would trigger download
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const imageCount = workspaceFiles.filter(f => f.type === 'image').length;
  const docCount = workspaceFiles.filter(f => f.type === 'document').length;
  const otherCount = workspaceFiles.filter(f => f.type === 'other').length;

  return (
    <ScreenContainer edges={['left', 'right']}>
      {/* Filter Tabs */}
      <View style={[styles.filterBar, { borderBottomColor: colors.border }]}>
        {FILTER_OPTIONS.map(opt => {
          const count = opt.value === 'all' ? workspaceFiles.length
            : opt.value === 'image' ? imageCount
            : opt.value === 'document' ? docCount
            : otherCount;
          return (
            <Pressable
              key={opt.value}
              style={[
                styles.filterTab,
                { borderBottomColor: filter === opt.value ? colors.primary : 'transparent' },
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                dispatch({ type: 'SET_FILE_FILTER', payload: opt.value });
              }}
            >
              <IconSymbol
                name={opt.icon as any}
                size={16}
                color={filter === opt.value ? colors.primary : colors.muted}
              />
              <Text style={[styles.filterTabText, { color: filter === opt.value ? colors.primary : colors.muted }]}>
                {opt.label}
              </Text>
              <View style={[styles.filterCount, { backgroundColor: filter === opt.value ? colors.primary + '20' : colors.surface }]}>
                <Text style={[styles.filterCountText, { color: filter === opt.value ? colors.primary : colors.muted }]}>
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Selection Mode Bar */}
      {isSelectionMode && (
        <View style={[styles.selectionBar, { backgroundColor: colors.surface2, borderBottomColor: colors.border }]}>
          <Pressable
            style={({ pressed }) => [styles.selectionAction, pressed && { opacity: 0.7 }]}
            onPress={handleCancelSelection}
          >
            <IconSymbol name="xmark" size={18} color={colors.foreground} />
            <Text style={[styles.selectionActionText, { color: colors.foreground }]}>취소</Text>
          </Pressable>

          <Text style={[styles.selectionCount, { color: colors.foreground }]}>
            {selectedIds.size}개 선택됨
          </Text>

          <View style={styles.selectionRight}>
            <Pressable
              style={({ pressed }) => [styles.selectionAction, pressed && { opacity: 0.7 }]}
              onPress={handleSelectAll}
            >
              <Text style={[styles.selectionActionText, { color: colors.primary }]}>
                {selectedIds.size === filtered.length ? '선택 해제' : '전체 선택'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Bulk Action Bar */}
      {isSelectionMode && selectedIds.size > 0 && (
        <View style={[styles.bulkBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable
            style={({ pressed }) => [styles.bulkBtn, { backgroundColor: colors.primary + '15' }, pressed && { opacity: 0.7 }]}
            onPress={handleBulkDownload}
          >
            <IconSymbol name="square.and.arrow.down" size={18} color={colors.primary} />
            <Text style={[styles.bulkBtnText, { color: colors.primary }]}>다운로드</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.bulkBtn, { backgroundColor: colors.error + '15' }, pressed && { opacity: 0.7 }]}
            onPress={handleBulkDelete}
          >
            <IconSymbol name="trash.fill" size={18} color={colors.error} />
            <Text style={[styles.bulkBtnText, { color: colors.error }]}>삭제</Text>
          </Pressable>
        </View>
      )}

      {/* File List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <FileItem
            item={item}
            isSelectionMode={isSelectionMode}
            isSelected={selectedIds.has(item.id)}
            onPress={() => handleItemPress(item)}
            onLongPress={() => handleLongPress(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <IconSymbol name="doc.fill" size={48} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>파일이 없습니다</Text>
            <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
              {filter !== 'all' ? '다른 필터를 선택해보세요' : '파일을 업로드하세요'}
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  filterBar: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 3,
    borderBottomWidth: 2,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '600',
  },
  filterCount: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '700',
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  selectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  selectionActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectionCount: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
  },
  selectionRight: {
    alignItems: 'flex-end',
  },
  bulkBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  bulkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  bulkBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    gap: 8,
    paddingBottom: 32,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
    gap: 3,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
  },
  fileMeta: {
    fontSize: 12,
  },
  extBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  extText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
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
});
