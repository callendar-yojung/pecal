import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { I18nProvider } from '../src/contexts/I18nContext';
import { MobileAppProvider } from '../src/contexts/MobileAppContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <MobileAppProvider>
            <Slot />
          </MobileAppProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
