import { useCallback, useMemo, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useMobileApp } from '../../../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../../../src/contexts/ThemeContext';
import { useI18n } from '../../../../src/contexts/I18nContext';
import { createStyles } from '../../../../src/styles/createStyles';
import { TaskDetailWebView } from '../../../../src/components/task/TaskDetailWebView';

export default function TaskDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { auth, data } = useMobileApp();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const taskId = Number(id);
  const task = useMemo(() => data.tasks.find((item) => item.id === taskId), [data.tasks, taskId]);
  const onRefresh = useCallback(async () => {
    if (!data.selectedWorkspace) return;
    setRefreshing(true);
    try {
      await data.loadDashboard(data.selectedWorkspace);
    } finally {
      setRefreshing(false);
    }
  }, [data]);

  if (!auth.session) return <Redirect href="/(auth)/login" />;

  if (!task) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>일정을 찾을 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={s.content}
        contentContainerStyle={[s.contentContainer, { paddingBottom: 12 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <TaskDetailWebView
          task={task}
          authToken={auth.session.accessToken}
          availableTags={data.tags}
          minHeight={680}
          onBackToList={() => router.replace('/tasks')}
          onOpenEdit={() => router.push(`/tasks/${taskId}/edit`)}
          onOpenExport={() => router.push(`/tasks/${taskId}/export`)}
        />
      </ScrollView>
    </View>
  );
}
