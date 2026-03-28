import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

type ThemeMode = 'system' | 'light' | 'black';
type ResolvedThemeMode = 'light' | 'black';

type ThemeColors = {
  bg: string;
  card: string;
  cardSoft: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  nav: string;
};

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  colors: ThemeColors;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
};

const palettes: Record<ResolvedThemeMode, ThemeColors> = {
  light: {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    cardSoft: '#F1F5F9',
    text: '#0F172A',
    textMuted: '#64748B',
    border: '#E2E8F0',
    primary: '#2563EB',
    nav: '#FFFFFF',
  },
  black: {
    bg: '#07090E',
    card: '#10131B',
    cardSoft: '#171C28',
    text: '#F8FAFF',
    textMuted: '#8D98AF',
    border: '#202637',
    primary: '#7B88FF',
    nav: '#0D111A',
  },
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_MODE_KEY = 'mobile_theme_mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    void AsyncStorage.setItem(THEME_MODE_KEY, nextMode);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_MODE_KEY);
        if (!mounted) return;
        if (stored === 'system' || stored === 'light' || stored === 'black') {
          setModeState(stored);
        }
      } catch {
        // ignore restore failures and keep default
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  const resolvedMode: ResolvedThemeMode = useMemo(() => {
    if (mode === 'system') {
      return systemColorScheme === 'dark' ? 'black' : 'light';
    }
    return mode;
  }, [mode, systemColorScheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedMode,
      colors: palettes[resolvedMode],
      toggleMode: () => setModeState((prev) => {
        const effective = prev === 'system' ? (systemColorScheme === 'dark' ? 'black' : 'light') : prev;
        const next = effective === 'light' ? 'black' : 'light';
        void AsyncStorage.setItem(THEME_MODE_KEY, next);
        return next;
      }),
      setMode,
    }),
    [mode, resolvedMode, systemColorScheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeProvider');
  return ctx;
}
