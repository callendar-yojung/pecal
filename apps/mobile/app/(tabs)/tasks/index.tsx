import { Redirect, useRouter } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { useMobileApp } from '../../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../../src/contexts/ThemeContext';
import { createStyles } from '../../../src/styles/createStyles';
import { TasksScreen } from '../../../src/screens/TasksScreen';

export default function TasksTab() {
  const { auth, data } = useMobileApp();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const router = useRouter();

  if (!auth.session) return <Redirect href="/(auth)/login" />;

  return (
    <ScrollView style={s.content} contentContainerStyle={s.contentContainer}>
      {data.error || auth.error ? <Text style={s.errorText}>{data.error || auth.error}</Text> : null}
      {!data.selectedWorkspace ? <Text style={s.emptyText}>워크스페이스를 선택하세요.</Text> : null}
      {data.selectedWorkspace ? (
        <TasksScreen
          tasks={data.tasks}
          tags={data.tags}
          onOpenCreateTask={() => router.push('/tasks/new')}
          onOpenTask={(taskId) => router.push(`/tasks/${taskId}`)}
        />
      ) : null}
    </ScrollView>
  );
}
