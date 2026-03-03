import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useI18n } from '../../contexts/I18nContext';
import { useThemeMode } from '../../contexts/ThemeContext';
import { getApiBaseUrl } from '../../lib/api';
import { createStyles } from '../../styles/createStyles';

type Props = {
  path: string;
  query?: Record<string, string | number | undefined | null>;
  onMessage?: (message: { type: string; payload?: unknown; raw: string }) => void;
  onNavigationStateChange?: (url: string) => void;
};

export function FullPageWebView({ path, query, onMessage, onNavigationStateChange }: Props) {
  const { locale } = useI18n();
  const { colors, resolvedMode } = useThemeMode();
  const s = createStyles(colors);
  const [error, setError] = useState<string | null>(null);
  const [webLoading, setWebLoading] = useState(true);
  const hasFinishedInitialLoadRef = useRef(false);
  const webTheme = resolvedMode === 'black' ? 'dark' : 'light';

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

  useEffect(() => {
    hasFinishedInitialLoadRef.current = false;
    setWebLoading(true);
  }, [uri]);

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
        style={{ flex: 1, backgroundColor: colors.bg }}
        onLoadStart={() => {
          if (!hasFinishedInitialLoadRef.current) {
            setWebLoading(true);
          }
        }}
        onLoadEnd={() => {
          hasFinishedInitialLoadRef.current = true;
          setWebLoading(false);
        }}
        onHttpError={(event) => {
          hasFinishedInitialLoadRef.current = true;
          setWebLoading(false);
          setError(`WebView HTTP ${event.nativeEvent.statusCode}`);
        }}
        onError={(event) => {
          hasFinishedInitialLoadRef.current = true;
          setWebLoading(false);
          setError(event.nativeEvent.description || 'WebView load error');
        }}
        onNavigationStateChange={(nav) => {
          if (nav.url) {
            setError(null);
          }
          onNavigationStateChange?.(nav.url);
        }}
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
      {webLoading ? (
        <View
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: resolvedMode === 'black' ? '#07090E' : '#F2F4FB',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <View
            style={{
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 22,
              paddingVertical: 18,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <Image source={require('../../../assets/icon.png')} style={{ width: 60, height: 60, borderRadius: 14 }} />
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>로딩 중...</Text>
          </View>
        </View>
      ) : null}
      {error ? (
        <View style={s.webViewErrorBanner}>
          <Text style={s.webViewErrorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}
