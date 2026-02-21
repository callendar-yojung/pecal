import { useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useMobileApp } from '../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { createStyles } from '../../src/styles/createStyles';

export default function FileDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useMobileApp();
  const { colors } = useThemeMode();
  const s = createStyles(colors);

  const fileId = Number(id);
  const file = data.files.find((item) => item.file_id === fileId);

  if (!file) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>파일을 찾을 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.content} contentContainerStyle={s.contentContainer}>
      <View style={[s.panel, { borderRadius: 16, gap: 10 }]}> 
        <Text style={[s.sectionTitle, { fontSize: 22 }]}>{file.original_name}</Text>
        <Text style={s.itemMeta}>크기: {file.file_size_formatted ?? `${file.file_size ?? 0} bytes`}</Text>
        <Text style={s.itemMeta}>경로: {file.file_path ?? '-'}</Text>
      </View>
    </ScrollView>
  );
}
