import 'react-native-gesture-handler';
import "../global.css";
import { StatusBar } from 'expo-status-bar';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { I18nProvider } from '../src/contexts/I18nContext';
import { MobileAppProvider } from '../src/contexts/MobileAppContext';
import { useThemeMode } from '../src/contexts/ThemeContext';

function AppChrome() {
  const { appearance } = useThemeMode();

  return (
    <>
      <StatusBar
        style={appearance === 'dark' ? 'light' : 'dark'}
      />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <MobileAppProvider>
              <AppChrome />
            </MobileAppProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
