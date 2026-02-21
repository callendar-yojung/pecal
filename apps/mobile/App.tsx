import { I18nProvider } from './src/contexts/I18nContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { MobileApp } from './src/legacy/MobileApp';

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <MobileApp />
      </I18nProvider>
    </ThemeProvider>
  );
}
