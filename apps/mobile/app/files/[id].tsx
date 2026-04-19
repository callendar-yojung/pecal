import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaybeMobileApp } from '../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { useI18n } from '../../src/contexts/I18nContext';
import { apiFetch, getApiBaseUrl } from '../../src/lib/api';
import { downloadAndShareAttachment } from '../../src/lib/file-upload';
import type { FileItem } from '../../src/lib/types';
import { createStyles } from '../../src/styles/createStyles';

function isImageFile(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'heic', 'heif'].includes(ext);
}

function isPdfFile(name: string) {
  return name.split('.').pop()?.toLowerCase() === 'pdf';
}

function resolveFileUrl(filePath?: string) {
  if (!filePath) return null;
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  if (filePath.startsWith('/uploads/')) {
    return `${getApiBaseUrl().replace(/\/+$/, '')}${filePath}`;
  }
  return `${getApiBaseUrl().replace(/\/+$/, '')}/${filePath.replace(/^\/+/, '')}`;
}

export default function FileDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useMaybeMobileApp();
  const { colors } = useThemeMode();
  const { locale } = useI18n();
  const s = createStyles(colors);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const isKo = locale === 'ko';

  if (!app) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>{isKo ? '앱 초기화 중...' : 'Initializing app...'}</Text>
      </View>
    );
  }
  const { data, auth } = app;

  const fileId = Number(id);
  const cachedFile = data.files.find((item) => item.file_id === fileId);
  const [remoteFile, setRemoteFile] = useState<FileItem | null>(cachedFile ?? null);

  useEffect(() => {
    setRemoteFile(cachedFile ?? null);
  }, [cachedFile]);

  useEffect(() => {
    if (cachedFile || !auth.session || Number.isNaN(fileId)) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await apiFetch<{ file?: FileItem }>(`/api/files?id=${fileId}`, auth.session);
        if (!cancelled) {
          setRemoteFile(response.file ?? null);
        }
      } catch {
        if (!cancelled) {
          setRemoteFile(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.session, cachedFile, fileId]);

  const file = useMemo(() => remoteFile ?? cachedFile ?? null, [cachedFile, remoteFile]);
  const fileUrl = resolveFileUrl(file?.file_path);

  if (!file) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>{isKo ? '파일을 찾을 수 없습니다.' : 'File not found.'}</Text>
      </View>
    );
  }

  const imageFile = isImageFile(file.original_name);
  const pdfFile = isPdfFile(file.original_name);

  return (
    <ScrollView
      style={s.content}
      contentContainerStyle={[s.contentContainer, { paddingTop: Math.max(12, insets.top + 8) }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
        <Pressable
          onPress={() => router.replace('/(tabs)/files')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingRight: 8 }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>{isKo ? '뒤로' : 'Back'}</Text>
        </Pressable>
      </View>
      <View style={[s.panel, { borderRadius: 16, gap: 10 }]}>
        <Text style={[s.sectionTitle, { fontSize: 22 }]}>{file.original_name}</Text>
        <Text style={s.itemMeta}>{isKo ? '크기' : 'Size'}: {file.file_size_formatted ?? `${file.file_size ?? 0} bytes`}</Text>

        {imageFile && fileUrl ? (
          <Image
            source={{ uri: fileUrl }}
            style={{
              width: '100%',
              aspectRatio: 1.2,
              borderRadius: 12,
              backgroundColor: colors.cardSoft,
            }}
            resizeMode="contain"
          />
        ) : pdfFile && fileUrl ? (
          <View
            style={{
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              backgroundColor: colors.cardSoft,
              height: 560,
            }}
          >
            <WebView
              source={{ uri: fileUrl }}
              style={{ flex: 1, backgroundColor: colors.cardSoft }}
              originWhitelist={['*']}
              startInLoadingState
              allowsInlineMediaPlayback
            />
          </View>
        ) : (
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 14,
              backgroundColor: colors.cardSoft,
            }}
          >
            <Text style={s.itemTitle} numberOfLines={1}>
              {file.original_name}
            </Text>
          </View>
        )}

        <Pressable
          style={s.primaryButton}
          onPress={async () => {
            if (!fileUrl) {
              Alert.alert(isKo ? '오류' : 'Error', isKo ? '다운로드 주소가 없습니다.' : 'Download URL is missing.');
              return;
            }
            try {
              await downloadAndShareAttachment({
                url: fileUrl,
                fileName: file.original_name,
                mimeType: file.mime_type,
                session: auth.session,
              });
            } catch (error) {
              Alert.alert(
                isKo ? '오류' : 'Error',
                error instanceof Error ? error.message : isKo ? '파일을 다운로드할 수 없습니다.' : 'Unable to download the file.',
              );
            }
          }}
        >
          <Text style={s.primaryButtonText}>{isKo ? '다운로드' : 'Download'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
