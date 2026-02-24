import { Redirect } from 'expo-router';
import { Text, View } from 'react-native';
import { useMobileApp } from '../../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../../src/contexts/ThemeContext';
import { createStyles } from '../../../src/styles/createStyles';
import { FullPageWebView } from '../../../src/components/common/FullPageWebView';

export default function TaskCreatePage() {
  const { auth, data } = useMobileApp();
  const { colors, mode } = useThemeMode();
  const s = createStyles(colors);

  if (!auth.session) return <Redirect href="/(auth)/login" />;
  if (!data.selectedWorkspace) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>워크스페이스를 선택하세요.</Text>
      </View>
    );
  }

  return (
    <FullPageWebView
      path="/mobile/tasks/new"
      query={{
        token: auth.session.accessToken,
        workspace_id: data.selectedWorkspace.workspace_id,
        theme: mode === 'black' ? 'dark' : 'light',
      }}
    />
  );
}
