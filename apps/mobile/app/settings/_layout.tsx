import { Slot } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeMode } from '../../src/contexts/ThemeContext';

export default function SettingsLayout() {
  const { colors } = useThemeMode();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Slot />
    </SafeAreaView>
  );
}
