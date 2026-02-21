import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { MemoItem } from '../lib/types';
import { useThemeMode } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { createStyles } from '../styles/createStyles';
import { SharedRichTextWebView } from '../components/editor/SharedRichTextWebView';

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

function memoPreview(item: MemoItem, emptyText: string) {
  if (!item.content_json) return emptyText;
  try {
    const parsed = JSON.parse(item.content_json) as { content?: Array<{ content?: Array<{ text?: string }> }> };
    const text = parsed.content?.flatMap((block) => block.content?.map((c) => c.text ?? '') ?? []).join(' ').trim();
    return text || emptyText;
  } catch {
    return emptyText;
  }
}

function highlightText(input: string, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [{ text: input, hit: false }];
  const source = input.toLowerCase();
  const parts: Array<{ text: string; hit: boolean }> = [];
  let cursor = 0;

  while (cursor < input.length) {
    const idx = source.indexOf(normalized, cursor);
    if (idx < 0) {
      parts.push({ text: input.slice(cursor), hit: false });
      break;
    }
    if (idx > cursor) {
      parts.push({ text: input.slice(cursor, idx), hit: false });
    }
    parts.push({ text: input.slice(idx, idx + normalized.length), hit: true });
    cursor = idx + normalized.length;
  }

  return parts.length ? parts : [{ text: input, hit: false }];
}

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

  useEffect(() => {
    if (selectedMemoId) setPane('editor');
  }, [selectedMemoId]);

  const startNewMemo = async () => {
    await onClearMemoEditor();
    setPane('editor');
  };

  return (
    <View style={s.section}>
      <View style={{ gap: 3 }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>{t('memoHeaderSub')}</Text>
        <Text style={[s.sectionTitle, { fontSize: 24 }]}>{t('commonMemo')}</Text>
      </View>

      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <View style={s.row}>
          <Pressable
            onPress={() => setPane('list')}
            style={[s.workspacePill, { marginRight: 8 }, pane === 'list' ? s.workspacePillActive : null]}
          >
            <Text style={[s.workspacePillText, pane === 'list' ? s.workspacePillTextActive : null]}>메모 목록</Text>
          </Pressable>
          <Pressable
            onPress={() => setPane('editor')}
            style={[s.workspacePill, { marginRight: 0 }, pane === 'editor' ? s.workspacePillActive : null]}
          >
            <Text style={[s.workspacePillText, pane === 'editor' ? s.workspacePillTextActive : null]}>에디터</Text>
          </Pressable>
        </View>
        <Pressable style={s.primaryButtonHalf} onPress={startNewMemo}>
          <Text style={s.primaryButtonText}>새 메모 만들기</Text>
        </Pressable>
      </View>

      {pane === 'editor' ? (
        <View style={[s.panel, { borderRadius: 18, gap: 10 }]}>
          <Text style={[s.formTitle, { fontSize: 16 }]}>{t('memoCreateTitle')}</Text>
          <Text style={s.itemMeta}>{memoIsSaving ? '자동 저장 중...' : '자동 저장됨'}</Text>
          <TextInput value={memoTitle} onChangeText={onMemoTitleChange} placeholder={t('memoTitlePlaceholder')} style={s.input} placeholderTextColor={colors.textMuted} />
          <SharedRichTextWebView
          valueJson={memoContentJson}
          valueText={memoText}
            placeholder={t('memoContentPlaceholder')}
            minHeight={320}
            onChange={onMemoEditorChange}
          />
          {memoConflict ? (
            <View style={[s.notificationRow, { borderColor: '#F59E0B' }]}>
              <Text style={[s.itemMeta, { color: '#B45309' }]}>충돌 감지됨: 다른 기기 변경본이 있습니다.</Text>
            </View>
          ) : null}
          <View style={s.row}>
            <Pressable style={s.secondaryButtonHalf} onPress={() => setPane('list')}>
              <Text style={s.secondaryButtonText}>목록으로</Text>
            </Pressable>
            {selectedMemoId ? (
              <Pressable style={s.secondaryButtonHalf} onPress={() => onDeleteMemo(selectedMemoId)}>
                <Text style={[s.secondaryButtonText, { color: '#EF4444' }]}>삭제</Text>
              </Pressable>
            ) : null}
            {memoConflict ? (
              <Pressable style={s.secondaryButtonHalf} onPress={() => onUpdateMemo({ force: true })}>
                <Text style={s.secondaryButtonText}>덮어쓰기</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {pane === 'list' ? (
        <View style={[s.panel, { borderRadius: 14, gap: 8 }]}>
        <View style={s.row}>
          {([
            { key: 'latest', label: '최신순' },
            { key: 'oldest', label: '오래된순' },
            { key: 'favorite', label: '즐겨찾기순' },
          ] as const).map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => onMemoSortChange(opt.key)}
              style={[s.workspacePill, { marginRight: 0, paddingVertical: 7, paddingHorizontal: 10 }, memoSort === opt.key ? s.workspacePillActive : null]}
            >
              <Text style={[s.workspacePillText, memoSort === opt.key ? s.workspacePillTextActive : null]}>{opt.label}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={onMemoFavoriteOnlyToggle}
            style={[s.workspacePill, { marginRight: 0, paddingVertical: 7, paddingHorizontal: 10 }, memoFavoriteOnly ? s.workspacePillActive : null]}
          >
            <Text style={[s.workspacePillText, memoFavoriteOnly ? s.workspacePillTextActive : null]}>즐겨찾기만</Text>
          </Pressable>
        </View>
        <TextInput
          value={memoSearch}
          onChangeText={onMemoSearchChange}
          placeholder="메모 검색"
          style={s.input}
          placeholderTextColor={colors.textMuted}
        />
        <View style={s.row}>
          {['all', 'inbox', 'work', 'idea'].map((folder) => (
            <Pressable
              key={folder}
              onPress={() => onMemoFolderFilterChange(folder)}
              style={[s.workspacePill, { marginRight: 0, paddingVertical: 7, paddingHorizontal: 10 }, memoFolderFilter === folder ? s.workspacePillActive : null]}
            >
              <Text style={[s.workspacePillText, memoFolderFilter === folder ? s.workspacePillTextActive : null]}>{folder}</Text>
            </Pressable>
          ))}
        </View>
        </View>
      ) : null}

      {pane === 'list' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.memoTabScroll} contentContainerStyle={{ gap: 8 }}>
        {memos.map((memo) => (
          <View
            key={memo.memo_id}
            style={{
              borderWidth: 1,
              borderColor: memo.is_pinned ? '#F59E0B' : colors.border,
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 8,
              backgroundColor: memo.is_pinned ? '#F59E0B22' : colors.card,
            }}
          >
            <Text style={{ color: memo.is_pinned ? '#B45309' : colors.textMuted, fontSize: 12, fontWeight: '700' }}>
              {memo.is_pinned ? '★ ' : ''}
              {memo.title}
            </Text>
          </View>
        ))}
        </ScrollView>
      ) : null}

      {pane === 'list' ? (
        <View style={{ gap: 8 }}>
        {memos.map((memo) => (
          <Pressable
            key={memo.memo_id}
            onPress={() => {
              onSelectMemoForEdit(memo.memo_id);
              setPane('editor');
            }}
            style={[s.listRow, { borderRadius: 14, paddingVertical: 12, gap: 6 }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text style={[s.itemTitle, { flex: 1 }]} numberOfLines={1}>
                {highlightText(memo.title, memoSearch).map((part, idx) => (
                  <Text key={`title-${memo.memo_id}-${idx}`} style={part.hit ? { backgroundColor: '#FDE68A', color: '#92400E' } : undefined}>
                    {part.text}
                  </Text>
                ))}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>
                {new Date(memo.updated_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
            <Text style={s.itemMeta} numberOfLines={2}>
              {highlightText(memoPreview(memo, t('memoNoContent')), memoSearch).map((part, idx) => (
                <Text key={`preview-${memo.memo_id}-${idx}`} style={part.hit ? { backgroundColor: '#FEF3C7', color: '#92400E' } : undefined}>
                  {part.text}
                </Text>
              ))}
            </Text>
            <View style={s.row}>
              <Pressable style={s.workspacePill} onPress={() => onToggleMemoFavorite(memo.memo_id)}>
                <Text style={s.workspacePillText}>{memo.is_favorite === 1 ? '★해제' : '★'}</Text>
              </Pressable>
              <Pressable style={s.workspacePill} onPress={() => onToggleMemoPinned(memo.memo_id)}>
                <Text style={s.workspacePillText}>{memo.is_pinned ? '고정해제' : '고정'}</Text>
              </Pressable>
              <Pressable style={s.workspacePill} onPress={() => onSetMemoFolder(memo.memo_id, memo.folder === 'work' ? 'inbox' : 'work')}>
                <Text style={s.workspacePillText}>폴더:{memo.folder ?? 'inbox'}</Text>
              </Pressable>
              <Pressable style={s.workspacePill} onPress={() => onSetMemoTags(memo.memo_id, memo.tags?.join(',') ? `${memo.tags?.join(',')},new` : 'new')}>
                <Text style={s.workspacePillText}>태그:{memo.tags?.length ?? 0}</Text>
              </Pressable>
              <Pressable style={s.workspacePill} onPress={() => onDeleteMemo(memo.memo_id)}>
                <Text style={[s.workspacePillText, { color: '#EF4444' }]}>삭제</Text>
              </Pressable>
            </View>
          </Pressable>
        ))}
        {!memos.length ? <Text style={s.emptyText}>{t('memoEmpty')}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
