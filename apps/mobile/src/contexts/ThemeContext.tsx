import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeAppearance = 'light' | 'dark';
export type ThemePaletteKey = 'light' | 'cream' | 'pink' | 'mint' | 'black' | 'midnight';
export type ThemeMode = 'system' | ThemePaletteKey;
export type ResolvedThemeMode = ThemePaletteKey;

export type ThemeColors = {
  bg: string;
  card: string;
  cardSoft: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  nav: string;
};

export type ThemePalette = {
  key: ThemePaletteKey;
  appearance: ThemeAppearance;
  label: {
    ko: string;
    en: string;
  };
  colors: ThemeColors;
};

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  appearance: ThemeAppearance;
  colors: ThemeColors;
  themes: ThemePalette[];
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
};

export const themePalettes: ThemePalette[] = [
  {
    key: 'light',
    appearance: 'light',
    label: { ko: '라이트', en: 'Light' },
    colors: {
      bg: '#F8FAFC',
      card: '#FFFFFF',
      cardSoft: '#F1F5F9',
      text: '#0F172A',
      textMuted: '#64748B',
      border: '#E2E8F0',
      primary: '#2563EB',
      nav: '#FFFFFF',
    },
  },
  {
    key: 'cream',
    appearance: 'light',
    label: { ko: '크림', en: 'Cream' },
    colors: {
      bg: '#FAF6EF',
      card: '#FFFDFC',
      cardSoft: '#F6EFE5',
      text: '#2B2118',
      textMuted: '#8B7766',
      border: '#E8DCCB',
      primary: '#B7791F',
      nav: '#FFF8F0',
    },
  },
  {
    key: 'pink',
    appearance: 'light',
    label: { ko: '연핑크', en: 'Soft Pink' },
    colors: {
      bg: '#FFF6FA',
      card: '#FFFDFE',
      cardSoft: '#FCECF4',
      text: '#3A2431',
      textMuted: '#9A7284',
      border: '#F1D7E3',
      primary: '#E879A6',
      nav: '#FFF9FC',
    },
  },
  {
    key: 'mint',
    appearance: 'light',
    label: { ko: '연그린', en: 'Soft Green' },
    colors: {
      bg: '#F4FCF8',
      card: '#FCFFFD',
      cardSoft: '#EAF7F0',
      text: '#1F332A',
      textMuted: '#6F8F80',
      border: '#D4EBDD',
      primary: '#4FAF7A',
      nav: '#F8FFFB',
    },
  },
  {
    key: 'black',
    appearance: 'dark',
    label: { ko: '블랙', en: 'Black' },
    colors: {
      bg: '#07090E',
      card: '#10131B',
      cardSoft: '#171C28',
      text: '#F8FAFF',
      textMuted: '#8D98AF',
      border: '#202637',
      primary: '#7B88FF',
      nav: '#0D111A',
    },
  },
  {
    key: 'midnight',
    appearance: 'dark',
    label: { ko: '미드나이트', en: 'Midnight' },
    colors: {
      bg: '#0A1020',
      card: '#111A30',
      cardSoft: '#17223D',
      text: '#F4F7FF',
      textMuted: '#94A3C3',
      border: '#243252',
      primary: '#4DA3FF',
      nav: '#0D1528',
    },
  },
];

const paletteMap = Object.fromEntries(themePalettes.map((palette) => [palette.key, palette])) as Record<ThemePaletteKey, ThemePalette>;

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
        if (stored === 'system' || (stored && stored in paletteMap)) {
          setModeState(stored as ThemeMode);
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

  const appearance = paletteMap[resolvedMode].appearance;

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedMode,
      appearance,
      colors: paletteMap[resolvedMode].colors,
      themes: themePalettes,
      toggleMode: () => setModeState((prev) => {
        const cycle: ThemePaletteKey[] = themePalettes.map((theme) => theme.key);
        const effective = prev === 'system' ? (systemColorScheme === 'dark' ? 'black' : 'light') : prev;
        const currentIndex = cycle.indexOf(effective);
        const next = cycle[(currentIndex + 1 + cycle.length) % cycle.length];
        void AsyncStorage.setItem(THEME_MODE_KEY, next);
        return next;
      }),
      setMode,
    }),
    [mode, resolvedMode, appearance, systemColorScheme, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeProvider');
  return ctx;
}
