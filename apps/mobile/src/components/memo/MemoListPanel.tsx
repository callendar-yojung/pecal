import { richTextDocToPreviewText } from '@repo/utils';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
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
  memoSort,
  onMemoSearchChange,
  onMemoSortChange,
  onOpenDetail,
  onToggleMemoFavorite,
}: Props) {
  const { colors } = useThemeMode();
  const { t } = useI18n();
  const s = createStyles(colors);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortOptions: Array<{ key: 'latest' | 'oldest' | 'favorite'; label: string }> = [
    { key: 'latest', label: '최신순' },
    { key: 'oldest', label: '오래된순' },
    { key: 'favorite', label: '즐겨찾기 우선' },
  ];
  const currentSortLabel = sortOptions.find((option) => option.key === memoSort)?.label ?? '최신순';

  return (
    <View style={[s.panel, { borderRadius: 18, padding: 8, gap: 8 }]}>
      <View style={{ gap: 8, paddingHorizontal: 4, paddingTop: 2 }}>
        <View
          style={{
            minHeight: 48,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            value={memoSearch}
            onChangeText={onMemoSearchChange}
            placeholder="메모 제목 검색"
            placeholderTextColor={colors.textMuted}
            style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: '500', paddingVertical: 0 }}
          />
        </View>

        <View style={{ alignItems: 'flex-start' }}>
          <Pressable
            onPress={() => setSortMenuOpen((prev) => !prev)}
            style={{
              minHeight: 40,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{currentSortLabel}</Text>
            <Ionicons name={sortMenuOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
          </Pressable>
        </View>

        {sortMenuOpen ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              overflow: 'hidden',
              backgroundColor: colors.card,
            }}
          >
            {sortOptions.map((option, index) => {
              const active = option.key === memoSort;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => {
                    onMemoSortChange(option.key);
                    setSortMenuOpen(false);
                  }}
                  style={({ pressed }) => ({
                    minHeight: 44,
                    paddingHorizontal: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                    backgroundColor: pressed || active ? `${colors.primary}12` : colors.card,
                  })}
                >
                  <Text style={{ color: active ? colors.primary : colors.text, fontSize: 15, fontWeight: active ? '800' : '700' }}>
                    {option.label}
                  </Text>
                  {active ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <View style={{ gap: 6 }}>
        {memos.map((memo) => (
          <View key={memo.memo_id} style={{ position: 'relative' }}>
            <Pressable
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
              <Text style={[s.itemTitle, { flex: 1, paddingRight: 34 }]} numberOfLines={1}>
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
          </View>
        ))}
        {!memos.length ? <Text style={s.emptyText}>{t('memoEmpty')}</Text> : null}
      </View>
    </View>
  );
}
