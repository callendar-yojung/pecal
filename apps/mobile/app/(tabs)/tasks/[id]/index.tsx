import { useCallback, useMemo, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useMobileApp } from '../../../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../../../src/contexts/ThemeContext';
import { useI18n } from '../../../../src/contexts/I18nContext';
import { createStyles } from '../../../../src/styles/createStyles';
import { TaskDetailWebView } from '../../../../src/components/task/TaskDetailWebView';
import { GsxCard, GsxHeading } from '../../../../src/ui/gsx';

export default function TaskDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { auth, data } = useMobileApp();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [attachmentsLoading, setAttachmentsLoading] = useState(true);

  const taskId = Number(id);
  const task = useMemo(() => data.tasks.find((item) => item.id === taskId), [data.tasks, taskId]);
  const removeTask = useCallback(() => {
    Alert.alert('일정 삭제', '이 일정을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await data.deleteTask(taskId);
              router.replace('/tasks');
            } catch (error) {
              Alert.alert('오류', error instanceof Error ? error.message : '일정을 삭제하지 못했습니다.');
            }
          })();
        },
      },
    ]);
  }, [data, taskId, router]);

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
          session={auth.session}
          workspace={data.selectedWorkspace}
          availableTags={data.tags}
          minHeight={680}
          onBackToList={() => router.replace('/tasks')}
          onOpenEdit={() => router.push(`/tasks/${taskId}/edit`)}
          onOpenExport={() => router.push(`/tasks/${taskId}/export`)}
          onOpenDuplicate={() => router.push(`/tasks/${taskId}/duplicate`)}
          onDelete={removeTask}
          onAttachmentsLoadingChange={setAttachmentsLoading}
        />
      </ScrollView>
      {attachmentsLoading ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.bg + 'E6',
          }}
        >
          <GsxCard
            className="items-center gap-2"
            style={{
              minWidth: 180,
              maxWidth: 240,
              paddingHorizontal: 20,
              paddingVertical: 18,
              borderRadius: 20,
            }}
          >
            <ActivityIndicator color={colors.primary} />
            <GsxHeading className="text-sm">첨부파일 불러오는 중...</GsxHeading>
          </GsxCard>
        </View>
      ) : null}
    </View>
  );
}
