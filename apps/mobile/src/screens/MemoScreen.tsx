import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { MemoItem } from '../lib/types';
import { useThemeMode } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { createStyles } from '../styles/createStyles';
import { MemoEditorForm } from '../components/memo/MemoEditorForm';
import { MemoListPanel } from '../components/memo/MemoListPanel';

type Props = {
  memoTitle: string;
  memoText: string;
  memoContentJson: string;
  selectedMemoId: number | null;
  memoConflict: boolean;
  memoSearch: string;
  memoFolderFilter: string;
  memoSort: 'latest' | 'oldest' | 'favorite';
  memoFavoriteOnly: boolean;
  memoIsSaving: boolean;
  memos: MemoItem[];
  onMemoTitleChange: (v: string) => void;
  onMemoTextChange: (v: string) => void;
  onMemoEditorChange: (json: string, plainText: string) => void;
  onMemoSearchChange: (v: string) => void;
  onMemoFolderFilterChange: (v: string) => void;
  onMemoSortChange: (v: 'latest' | 'oldest' | 'favorite') => void;
  onMemoFavoriteOnlyToggle: () => void;
  onSelectMemoForEdit: (memoId: number) => void;
  onClearMemoEditor: () => void;
  onUpdateMemo: (opts?: { force?: boolean }) => void;
  onToggleMemoPinned: (memoId: number) => void;
  onSetMemoFolder: (memoId: number, folder: string) => void;
  onSetMemoTags: (memoId: number, tagsInput: string) => void;
  onToggleMemoFavorite: (memoId: number) => void;
  onDeleteMemo: (memoId: number) => void;
};

export function MemoScreen({
  memoTitle,
  memoText,
  memoContentJson,
  selectedMemoId,
  memoConflict,
  memoSearch,
  memoFolderFilter,
  memoSort,
  memoFavoriteOnly,
  memoIsSaving,
  memos,
  onMemoTitleChange,
  onMemoTextChange,
  onMemoEditorChange,
  onMemoSearchChange,
  onMemoFolderFilterChange,
  onMemoSortChange,
  onMemoFavoriteOnlyToggle,
  onSelectMemoForEdit,
  onClearMemoEditor,
  onUpdateMemo,
  onToggleMemoPinned,
  onSetMemoFolder,
  onSetMemoTags,
  onToggleMemoFavorite,
  onDeleteMemo,
}: Props) {
  const { colors } = useThemeMode();
  const { t } = useI18n();
  const s = createStyles(colors);
  const [pane, setPane] = useState<'list' | 'editor'>('list');
  const statusMessage = memoConflict ? '충돌 감지됨' : memoIsSaving ? '저장 중...' : '자동 저장';

  useEffect(() => {
    if (selectedMemoId) setPane('editor');
  }, [selectedMemoId]);

  const startNewMemo = async () => {
    await onClearMemoEditor();
    setPane('editor');
  };

  return (
    <View style={s.section}>
      {pane === 'list' ? (
        <View style={[s.panel, { borderRadius: 18, gap: 4, padding: 14 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Text style={[s.sectionTitle, { fontSize: 24 }]}>메모</Text>
            <Pressable style={[s.primaryButton, { paddingVertical: 10, paddingHorizontal: 14, width: 'auto', minHeight: 0 }]} onPress={startNewMemo}>
              <Text style={s.primaryButtonText}>새 메모</Text>
            </Pressable>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{statusMessage}</Text>
        </View>
      ) : null}

      {pane === 'editor' ? (
        <MemoEditorForm
          title={memoTitle}
          contentJson={memoContentJson}
          contentText={memoText}
          saving={memoIsSaving}
          conflict={memoConflict}
          onTitleChange={onMemoTitleChange}
          onContentChange={onMemoEditorChange}
          onBackToList={() => setPane('list')}
          onDelete={selectedMemoId !== null ? () => onDeleteMemo(selectedMemoId) : undefined}
          onForceOverwrite={memoConflict ? () => onUpdateMemo({ force: true }) : undefined}
        />
      ) : (
        <MemoListPanel
          memos={memos}
          memoSearch={memoSearch}
          memoFolderFilter={memoFolderFilter}
          memoSort={memoSort}
          memoFavoriteOnly={memoFavoriteOnly}
          onMemoSearchChange={onMemoSearchChange}
          onMemoFolderFilterChange={onMemoFolderFilterChange}
          onMemoSortChange={onMemoSortChange}
          onMemoFavoriteOnlyToggle={onMemoFavoriteOnlyToggle}
          onOpenDetail={(memoId) => {
            onSelectMemoForEdit(memoId);
            setPane('editor');
          }}
          onToggleMemoPinned={onToggleMemoPinned}
          onSetMemoFolder={onSetMemoFolder}
          onSetMemoTags={onSetMemoTags}
          onToggleMemoFavorite={onToggleMemoFavorite}
          onDeleteMemo={onDeleteMemo}
        />
      )}
    </View>
  );
}
