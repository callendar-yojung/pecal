import { Image, Pressable, Text, View } from 'react-native';
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
  previewUrl?: string | null;
  isImage?: boolean;
  onOpen?: () => void;
  onDownload?: () => void;
  onRemove?: () => void;
  removing?: boolean;
};

export function DetailSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const { appearance } = useThemeMode();
  const softColor = appearance === 'dark' ? '#A3AEC2' : '#667085';

  return (
    <View style={{ gap: 8 }}>
      {title ? <Text style={{ color: softColor, fontSize: 12, fontWeight: '700' }}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function DetailTagSection({
  title,
  tags,
}: {
  title?: string;
  tags: DetailTagItem[];
}) {
  const { appearance } = useThemeMode();
  const textColor = appearance === 'dark' ? '#F3F6FF' : '#111827';

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
  title?: string;
  emptyLabel: string;
  attachments: DetailAttachmentItem[];
}) {
  const { appearance } = useThemeMode();
  const borderColor = appearance === 'dark' ? '#2D3443' : '#D9E0EF';
  const cardColor = appearance === 'dark' ? '#1A2130' : '#F8FAFF';
  const textColor = appearance === 'dark' ? '#F3F6FF' : '#111827';
  const softColor = appearance === 'dark' ? '#A3AEC2' : '#667085';

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
                {attachment.isImage && attachment.previewUrl ? (
                  <Image
                    source={{ uri: attachment.previewUrl }}
                    resizeMode="cover"
                    style={{
                      width: '100%',
                      height: 148,
                      borderRadius: 10,
                      marginBottom: 6,
                      backgroundColor: appearance === 'dark' ? '#0F172A' : '#E9EEF8',
                    }}
                  />
                ) : null}
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
                      backgroundColor: appearance === 'dark' ? '#141923' : '#FFFFFF',
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
                      backgroundColor: appearance === 'dark' ? '#141923' : '#FFFFFF',
                    }}
                  >
                    <Text style={{ color: textColor, fontSize: 12, fontWeight: '700' }}>다운로드</Text>
                  </Pressable>
                ) : null}
                {attachment.onRemove ? (
                  <Pressable
                    disabled={attachment.removing}
                    onPress={attachment.onRemove}
                    style={{
                      borderWidth: 1,
                      borderColor: '#FCA5A5',
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      backgroundColor: '#FFF5F5',
                      opacity: attachment.removing ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '700' }}>제거</Text>
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
