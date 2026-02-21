import { Redirect } from 'expo-router';
import { ActivityIndicator, SafeAreaView, Text } from 'react-native';
import { useMobileApp } from '../src/contexts/MobileAppContext';
import { useThemeMode } from '../src/contexts/ThemeContext';
import { createStyles } from '../src/styles/createStyles';
import { useI18n } from '../src/contexts/I18nContext';

export default function IndexPage() {
  const { auth } = useMobileApp();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const { t } = useI18n();

  if (auth.loading) {
    return (
      <SafeAreaView style={s.centerScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={s.subtleText}>{t('loading')}</Text>
      </SafeAreaView>
    );
  }

  if (!auth.session) return <Redirect href="/(auth)/login" />;
  return <Redirect href="/(tabs)/overview" />;
}
