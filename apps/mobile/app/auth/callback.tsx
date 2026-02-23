import { useEffect } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMobileApp } from '../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { createStyles } from '../../src/styles/createStyles';

export default function AuthCallbackPage() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { auth } = useMobileApp();
  const { colors } = useThemeMode();
  const s = createStyles(colors);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const error = Array.isArray(params.error) ? params.error[0] : params.error;
      if (error) {
        auth.setError(String(error));
        if (mounted) router.replace('/(auth)/login');
        return;
      }

      const ok = await auth.applyAuthCallbackParams(
        params as Record<string, string | string[] | undefined>
      );
      if (!mounted) return;
      router.replace(ok ? '/(tabs)/overview' : '/(auth)/login');
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [params]);

  if (auth.session) return <Redirect href="/(tabs)/overview" />;

  return (
    <SafeAreaView style={s.centerScreen}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={s.subtleText}>Signing in...</Text>
    </SafeAreaView>
  );
}
