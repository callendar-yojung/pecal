import { createContext, useContext, useMemo, useState } from 'react';

type ThemeMode = 'light' | 'black';

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
  colors: ThemeColors;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
};

const palettes: Record<ThemeMode, ThemeColors> = {
  light: {
    bg: '#F2F4FB',
    card: '#FFFFFF',
    cardSoft: '#ECEFF7',
    text: '#0F172A',
    textMuted: '#7C8599',
    border: '#E5EAF5',
    primary: '#5B6CFF',
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: palettes[mode],
      toggleMode: () => setMode((prev) => (prev === 'light' ? 'black' : 'light')),
      setMode,
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeProvider');
  return ctx;
}
