import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaybeMobileApp } from '../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { getApiBaseUrl } from '../../src/lib/api';
import { createStyles } from '../../src/styles/createStyles';

function isImageFile(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'heic', 'heif'].includes(ext);
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
  const s = createStyles(colors);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  if (!app) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>앱 초기화 중...</Text>
      </View>
    );
  }
  const { data } = app;

  const fileId = Number(id);
  const file = data.files.find((item) => item.file_id === fileId);
  const fileUrl = resolveFileUrl(file?.file_path);

  if (!file) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>파일을 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const imageFile = isImageFile(file.original_name);

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
          <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>뒤로</Text>
        </Pressable>
      </View>
      <View style={[s.panel, { borderRadius: 16, gap: 10 }]}>
        <Text style={[s.sectionTitle, { fontSize: 22 }]}>{file.original_name}</Text>
        <Text style={s.itemMeta}>크기: {file.file_size_formatted ?? `${file.file_size ?? 0} bytes`}</Text>

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
              Alert.alert('오류', '다운로드 주소가 없습니다.');
              return;
            }
            const canOpen = await Linking.canOpenURL(fileUrl);
            if (!canOpen) {
              Alert.alert('오류', '파일을 열 수 없습니다.');
              return;
            }
            await Linking.openURL(fileUrl);
          }}
        >
          <Text style={s.primaryButtonText}>다운로드</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
