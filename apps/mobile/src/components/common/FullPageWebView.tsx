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
};

export function FullPageWebView({ path, query }: Props) {
  const { locale } = useI18n();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const [error, setError] = useState<string | null>(null);

  const uri = useMemo(() => {
    const normalizedBase = getApiBaseUrl().replace(/\/+$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const params = new URLSearchParams();
    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      params.set(key, String(value));
    });
    const queryString = params.toString();
    return `${normalizedBase}/${locale}${normalizedPath}${queryString ? `?${queryString}` : ''}`;
  }, [locale, path, query]);

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <WebView
        source={{ uri }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        startInLoadingState
        style={{ flex: 1, backgroundColor: colors.bg }}
        onHttpError={(event) => setError(`WebView HTTP ${event.nativeEvent.statusCode}`)}
        onError={(event) => setError(event.nativeEvent.description || 'WebView load error')}
      />
      {error ? (
        <View style={s.webViewErrorBanner}>
          <Text style={s.webViewErrorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}
