import { useCallback, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMobileApp } from '../../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../../src/contexts/ThemeContext';
import { createStyles } from '../../../src/styles/createStyles';
import { TasksScreen } from '../../../src/screens/TasksScreen';

export default function TasksTab() {
  const { auth, data } = useMobileApp();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const bottomBarHeight = 96;

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={s.content}
        contentContainerStyle={[
          s.contentContainer,
          {
            paddingBottom: bottomBarHeight + insets.bottom + 16,
          },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {data.error || auth.error ? <Text style={s.errorText}>{data.error || auth.error}</Text> : null}
        {!data.selectedWorkspace ? <Text style={s.emptyText}>워크스페이스를 선택하세요.</Text> : null}
        {data.selectedWorkspace ? (
          <TasksScreen
            tasks={data.tasks}
            categories={data.categories}
            tags={data.tags}
            onOpenTask={(taskId) => router.push(`/tasks/${taskId}`)}
            onChangeTaskStatus={(taskId, status) => void data.updateTask(taskId, { status })}
            onDeleteTasks={async (taskIds) => data.deleteTasks(taskIds)}
          />
        ) : null}
      </ScrollView>

      {data.selectedWorkspace ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: Math.max(insets.bottom, 10),
          }}
        >
          <Pressable
            onPress={() => router.push('/tasks/new')}
            style={({ pressed }) => [
              {
                minHeight: 56,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.primary,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOpacity: 0.08,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
                opacity: pressed ? 0.92 : 1,
                transform: [{ scale: pressed ? 0.99 : 1 }],
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="add" size={22} color={colors.primary} />
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 20,
                  fontWeight: '800',
                  letterSpacing: -0.4,
                }}
              >
                생성
              </Text>
            </View>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
