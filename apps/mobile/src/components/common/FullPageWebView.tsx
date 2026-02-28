import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useI18n } from '../../contexts/I18nContext';
import { useThemeMode } from '../../contexts/ThemeContext';
import { getApiBaseUrl } from '../../lib/api';
import { createStyles } from '../../styles/createStyles';

type Props = {
  path: string;
  query?: Record<string, string | number | undefined | null>;
  onMessage?: (message: { type: string; payload?: unknown; raw: string }) => void;
};

export function FullPageWebView({ path, query, onMessage }: Props) {
  const { locale } = useI18n();
  const { colors, mode } = useThemeMode();
  const s = createStyles(colors);
  const [error, setError] = useState<string | null>(null);
  const webTheme = mode === 'black' ? 'dark' : 'light';

  const uri = useMemo(() => {
    const normalizedBase = getApiBaseUrl().replace(/\/+$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const params = new URLSearchParams();
    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      params.set(key, String(value));
    });
    if (!params.has('theme')) {
      params.set('theme', webTheme);
    }
    const queryString = params.toString();
    return `${normalizedBase}/${locale}${normalizedPath}${queryString ? `?${queryString}` : ''}`;
  }, [locale, path, query, webTheme]);

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <WebView
        source={{ uri }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        pullToRefreshEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        startInLoadingState
        style={{ flex: 1, backgroundColor: colors.bg }}
        onHttpError={(event) => setError(`WebView HTTP ${event.nativeEvent.statusCode}`)}
        onError={(event) => setError(event.nativeEvent.description || 'WebView load error')}
        onMessage={(event) => {
          if (!onMessage) return;
          const raw = event.nativeEvent.data ?? '';
          if (!raw) return;
          try {
            const parsed = JSON.parse(raw) as { type?: string; payload?: unknown };
            if (typeof parsed?.type === 'string') {
              onMessage({ type: parsed.type, payload: parsed.payload, raw });
              return;
            }
          } catch {
            // no-op: raw text fallback below
          }
          onMessage({ type: 'raw', payload: raw, raw });
        }}
      />
      {error ? (
        <View style={s.webViewErrorBanner}>
          <Text style={s.webViewErrorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}
