import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { FileItem } from '../lib/types';
import { useThemeMode } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { createStyles } from '../styles/createStyles';

type Props = {
  files: FileItem[];
  onOpenFile?: (fileId: number) => void;
};

type FileFilter = 'all' | 'image' | 'document' | 'other';

function detectType(name: string): Exclude<FileFilter, 'all'> {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md'].includes(ext)) return 'document';
  return 'other';
}

function iconByType(type: Exclude<FileFilter, 'all'>) {
  if (type === 'image') return { symbol: '▣', color: '#10B981', labelKey: 'filesFilterImage' };
  if (type === 'document') return { symbol: '▤', color: '#5B6CF6', labelKey: 'filesFilterDocument' };
  return { symbol: '■', color: '#F97316', labelKey: 'filesFilterOther' };
}

export function FilesScreen({ files, onOpenFile }: Props) {
  const { colors } = useThemeMode();
  const { t } = useI18n();
  const s = createStyles(colors);
  const [filter, setFilter] = useState<FileFilter>('all');

  const stats = useMemo(() => {
    const image = files.filter((file) => detectType(file.original_name) === 'image').length;
    const document = files.filter((file) => detectType(file.original_name) === 'document').length;
    const other = files.filter((file) => detectType(file.original_name) === 'other').length;
    return { all: files.length, image, document, other };
  }, [files]);

  const filteredFiles = useMemo(() => {
    if (filter === 'all') return files;
    return files.filter((file) => detectType(file.original_name) === filter);
  }, [files, filter]);

  const filters: Array<{ key: FileFilter; label: string; count: number }> = [
    { key: 'all', label: t('filesFilterAll'), count: stats.all },
    { key: 'image', label: t('filesFilterImage'), count: stats.image },
    { key: 'document', label: t('filesFilterDocument'), count: stats.document },
    { key: 'other', label: t('filesFilterOther'), count: stats.other },
  ];

  return (
    <View style={s.section}>
      <View style={{ gap: 3 }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>{t('filesHeaderSub')}</Text>
        <Text style={[s.sectionTitle, { fontSize: 24 }]}>{t('commonFiles')}</Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {filters.map((item) => (
          <Pressable
            key={item.key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: filter === item.key ? colors.primary : colors.border,
              backgroundColor: filter === item.key ? `${colors.primary}22` : colors.card,
              paddingHorizontal: 12,
              paddingVertical: 7,
            }}
            onPress={() => setFilter(item.key)}
          >
            <Text style={{ color: filter === item.key ? colors.primary : colors.textMuted, fontWeight: '700', fontSize: 12 }}>
              {item.label}
            </Text>
            <View style={{ borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, backgroundColor: filter === item.key ? `${colors.primary}22` : colors.cardSoft }}>
              <Text style={{ color: filter === item.key ? colors.primary : colors.textMuted, fontSize: 11, fontWeight: '700' }}>{item.count}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={{ gap: 8 }}>
        {filteredFiles.map((file) => {
          const type = detectType(file.original_name);
          const icon = iconByType(type);
          return (
            <Pressable
              key={file.file_id}
              onPress={() => onOpenFile?.(file.file_id)}
              style={[s.listRow, { borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }]}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: `${icon.color}22`,
                }}
              >
                <Text style={{ color: icon.color, fontWeight: '800', fontSize: 15 }}>{icon.symbol}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.itemTitle} numberOfLines={1}>{file.original_name}</Text>
                <Text style={s.itemMeta}>{file.file_size_formatted ?? `${file.file_size ?? 0} bytes`} · {t(icon.labelKey)}</Text>
              </View>
            </Pressable>
          );
        })}
        {!filteredFiles.length ? <Text style={s.emptyText}>{t('filesEmpty')}</Text> : null}
      </View>
    </View>
  );
}
