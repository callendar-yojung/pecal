import { richTextDocToPreviewText } from '@repo/utils';
import { Pressable, Text, View } from 'react-native';
import type { MemoItem } from '../../lib/types';
import { useThemeMode } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/I18nContext';
import { createStyles } from '../../styles/createStyles';

type Props = {
  memos: MemoItem[];
  memoSearch: string;
  memoFolderFilter: string;
  memoSort: 'latest' | 'oldest' | 'favorite';
  memoFavoriteOnly: boolean;
  onMemoSearchChange: (v: string) => void;
  onMemoFolderFilterChange: (v: string) => void;
  onMemoSortChange: (v: 'latest' | 'oldest' | 'favorite') => void;
  onMemoFavoriteOnlyToggle: () => void;
  onOpenDetail: (memoId: number) => void;
  onToggleMemoPinned: (memoId: number) => void;
  onSetMemoFolder: (memoId: number, folder: string) => void;
  onSetMemoTags: (memoId: number, tagsInput: string) => void;
  onToggleMemoFavorite: (memoId: number) => void;
  onDeleteMemo: (memoId: number) => void;
};

function memoPreview(item: MemoItem, emptyText: string) {
  if (!item.content_json) return emptyText;
  return richTextDocToPreviewText(item.content_json, emptyText);
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

export function MemoListPanel({
  memos,
  memoSearch,
  onOpenDetail,
}: Props) {
  const { colors } = useThemeMode();
  const { t } = useI18n();
  const s = createStyles(colors);

  return (
    <View style={[s.panel, { borderRadius: 18, padding: 8, gap: 8 }]}>
      <View style={{ gap: 6 }}>
        {memos.map((memo) => (
          <Pressable
            key={memo.memo_id}
            onPress={() => onOpenDetail(memo.memo_id)}
            style={[
              s.listRow,
              {
                borderRadius: 14,
                paddingVertical: 10,
                paddingHorizontal: 12,
                gap: 2,
                backgroundColor: colors.card,
              },
            ]}
          >
            <Text style={[s.itemTitle, { flex: 1 }]} numberOfLines={1}>
              {highlightText(memo.title, memoSearch).map((part, idx) => (
                <Text key={`title-${memo.memo_id}-${idx}`} style={part.hit ? { backgroundColor: '#FDE68A', color: '#92400E' } : undefined}>
                  {part.text}
                </Text>
              ))}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
              {new Date(memo.updated_at).toLocaleString()}
            </Text>
            <Text style={[s.itemMeta, { marginTop: 2 }]} numberOfLines={1}>
              {memoPreview(memo, t('memoNoContent'))}
            </Text>
          </Pressable>
        ))}
        {!memos.length ? <Text style={s.emptyText}>{t('memoEmpty')}</Text> : null}
      </View>
    </View>
  );
}
