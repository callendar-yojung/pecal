import { Redirect } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { useMobileApp } from '../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { createStyles } from '../../src/styles/createStyles';
import { OverviewScreen } from '../../src/screens/OverviewScreen';

export default function OverviewTab() {
  const { auth, data } = useMobileApp();
  const { colors } = useThemeMode();
  const s = createStyles(colors);

  if (!auth.session) return <Redirect href="/(auth)/login" />;

  return (
    <ScrollView style={s.content} contentContainerStyle={s.contentContainer}>
      {data.dashboardLoading ? null : null}
      {data.error || auth.error ? <Text style={s.errorText}>{data.error || auth.error}</Text> : null}
      {!data.selectedWorkspace ? <Text style={s.emptyText}>워크스페이스를 선택하세요.</Text> : null}
      {data.selectedWorkspace ? (
        <OverviewScreen taskCount={data.tasks.length} memoCount={data.memos.length} fileCount={data.files.length} unreadCount={data.unreadCount} />
      ) : null}
    </ScrollView>
  );
}
