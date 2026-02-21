import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useThemeMode } from '../src/contexts/ThemeContext';
import { I18nProvider } from '../src/contexts/I18nContext';
import { MobileAppProvider } from '../src/contexts/MobileAppContext';

function RootNavigator() {
  const { mode } = useThemeMode();
  return (
    <>
      <Stack screenOptions={{ header: () => null }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="tasks/[id]" options={{ title: 'Task Detail' }} />
        <Stack.Screen name="files/[id]" options={{ title: 'File Detail' }} />
        <Stack.Screen name="team/settings" options={{ title: 'Team Settings' }} />
        <Stack.Screen name="auth/callback" />
      </Stack>
      <StatusBar style={mode === 'black' ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <MobileAppProvider>
          <RootNavigator />
        </MobileAppProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
