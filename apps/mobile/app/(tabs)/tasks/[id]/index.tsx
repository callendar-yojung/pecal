import { useCallback, useMemo, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

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

  const onRefresh = useCallback(async () => {
    if (!data.selectedWorkspace) return;
    setRefreshing(true);
    try {
      await data.loadDashboard(data.selectedWorkspace);
    } finally {
      setRefreshing(false);
    }
  }, [data]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={s.content}
        contentContainerStyle={[s.contentContainer, { paddingBottom: 170 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={[s.panel, { borderRadius: 16, gap: 12 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Text style={s.formTitle}>일정 상세</Text>
            <Pressable style={s.headerActionButton} onPress={() => router.push(`/tasks/${taskId}/edit`)}>
              <Text style={s.headerActionText}>수정</Text>
            </Pressable>
          </View>
          <TaskDetailWebView task={task} minHeight={320} />
        </View>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 76 + Math.max(8, insets.bottom),
          flexDirection: 'row',
          gap: 8,
        }}
      >
        <Pressable
          style={s.secondaryButtonHalf}
          onPress={() => router.replace('/tasks')}
        >
          <Text style={s.secondaryButtonText}>목록으로</Text>
        </Pressable>
        <Pressable
          style={s.primaryButtonHalf}
          onPress={() => router.push(`/tasks/${taskId}/edit`)}
        >
          <Text style={s.primaryButtonText}>수정 페이지 열기</Text>
        </Pressable>
      </View>
    </View>
  );
}
