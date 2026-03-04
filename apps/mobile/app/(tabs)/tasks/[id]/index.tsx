import { useCallback, useMemo, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMobileApp } from '../../../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../../../src/contexts/ThemeContext';
import { useI18n } from '../../../../src/contexts/I18nContext';
import { createStyles } from '../../../../src/styles/createStyles';
import { TaskDetailWebView } from '../../../../src/components/task/TaskDetailWebView';

export default function TaskDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { auth, data } = useMobileApp();
  const { colors } = useThemeMode();
  const { t } = useI18n();
  const s = createStyles(colors);
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
        />
      </ScrollView>

      <View style={{ paddingHorizontal: 12, paddingBottom: Math.max(8, insets.bottom), paddingTop: 8, gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            style={s.secondaryButtonHalf}
            onPress={() => router.replace('/tasks')}
          >
            <Text style={s.secondaryButtonText}>{t('tasksBackToList')}</Text>
          </Pressable>
          <Pressable
            style={s.primaryButtonHalf}
            onPress={() => router.push(`/tasks/${taskId}/edit`)}
          >
            <Text style={s.primaryButtonText}>{t('tasksOpenEditPage')}</Text>
          </Pressable>
        </View>
        <Pressable
          style={s.secondaryButton}
          onPress={() => router.push(`/tasks/${taskId}/export`)}
        >
          <Text style={s.secondaryButtonText}>
            {t('tasksExport')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
