import { Pressable, Text, View } from 'react-native';
import { useThemeMode } from '../../contexts/ThemeContext';

export type DetailTagItem = {
  id: number | string;
  name: string;
  color?: string;
};

export type DetailAttachmentItem = {
  id: number | string;
  name: string;
  sizeLabel?: string;
  onOpen?: () => void;
  onDownload?: () => void;
};

export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { resolvedMode } = useThemeMode();
  const softColor = resolvedMode === 'black' ? '#A3AEC2' : '#667085';

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: softColor, fontSize: 12, fontWeight: '700' }}>{title}</Text>
      {children}
    </View>
  );
}

export function DetailTagSection({
  title,
  tags,
}: {
  title: string;
  tags: DetailTagItem[];
}) {
  const { resolvedMode } = useThemeMode();
  const textColor = resolvedMode === 'black' ? '#F3F6FF' : '#111827';

  if (!tags.length) return null;

  return (
    <DetailSection title={title}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {tags.map((tag) => (
          <View
            key={tag.id}
            style={{
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 6,
              backgroundColor: `${tag.color ?? '#5B6CFF'}22`,
            }}
          >
            <Text style={{ color: tag.color ?? textColor, fontSize: 12, fontWeight: '700' }}>{tag.name}</Text>
          </View>
        ))}
      </View>
    </DetailSection>
  );
}

export function DetailAttachmentSection({
  title,
  emptyLabel,
  attachments,
}: {
  title: string;
  emptyLabel: string;
  attachments: DetailAttachmentItem[];
}) {
  const { resolvedMode } = useThemeMode();
  const borderColor = resolvedMode === 'black' ? '#2D3443' : '#D9E0EF';
  const cardColor = resolvedMode === 'black' ? '#1A2130' : '#F8FAFF';
  const textColor = resolvedMode === 'black' ? '#F3F6FF' : '#111827';
  const softColor = resolvedMode === 'black' ? '#A3AEC2' : '#667085';

  return (
    <DetailSection title={title}>
      {attachments.length === 0 ? (
        <Text style={{ color: softColor, fontSize: 13 }}>{emptyLabel}</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {attachments.map((attachment) => (
            <View
              key={attachment.id}
              style={{
                borderWidth: 1,
                borderColor,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                backgroundColor: cardColor,
                gap: 8,
              }}
            >
              <View style={{ gap: 2 }}>
                <Text style={{ color: textColor, fontSize: 14, fontWeight: '700' }}>{attachment.name}</Text>
                {attachment.sizeLabel ? (
                  <Text style={{ color: softColor, fontSize: 12 }}>{attachment.sizeLabel}</Text>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {attachment.onOpen ? (
                  <Pressable
                    onPress={attachment.onOpen}
                    style={{
                      borderWidth: 1,
                      borderColor,
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      backgroundColor: resolvedMode === 'black' ? '#141923' : '#FFFFFF',
                    }}
                  >
                    <Text style={{ color: textColor, fontSize: 12, fontWeight: '700' }}>열기</Text>
                  </Pressable>
                ) : null}
                {attachment.onDownload ? (
                  <Pressable
                    onPress={attachment.onDownload}
                    style={{
                      borderWidth: 1,
                      borderColor,
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      backgroundColor: resolvedMode === 'black' ? '#141923' : '#FFFFFF',
                    }}
                  >
                    <Text style={{ color: textColor, fontSize: 12, fontWeight: '700' }}>다운로드</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </DetailSection>
  );
}
