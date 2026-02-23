import { useMemo } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useMobileApp } from '../../../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../../../src/contexts/ThemeContext';
import { createStyles } from '../../../../src/styles/createStyles';
import { TaskDetailWebView } from '../../../../src/components/task/TaskDetailWebView';

export default function TaskDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { auth, data } = useMobileApp();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const router = useRouter();

  const taskId = Number(id);
  const task = useMemo(() => data.tasks.find((item) => item.id === taskId), [data.tasks, taskId]);

  if (!auth.session) return <Redirect href="/(auth)/login" />;

  if (!task) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>일정을 찾을 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.content} contentContainerStyle={s.contentContainer}>
      <View style={[s.panel, { borderRadius: 16, gap: 12 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Text style={s.formTitle}>일정 상세</Text>
          <Pressable style={s.headerActionButton} onPress={() => router.replace(`/tasks/${taskId}/edit`)}>
            <Text style={s.headerActionText}>수정</Text>
          </Pressable>
        </View>
        <TaskDetailWebView task={task} minHeight={320} />
      </View>

      <View style={s.row}>
        <Pressable
          style={s.secondaryButtonHalf}
          onPress={() => router.replace('/tasks')}
        >
          <Text style={s.secondaryButtonText}>목록으로</Text>
        </Pressable>
        <Pressable
          style={s.primaryButtonHalf}
          onPress={() => router.replace(`/tasks/${taskId}/edit`)}
        >
          <Text style={s.primaryButtonText}>수정 페이지 열기</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
