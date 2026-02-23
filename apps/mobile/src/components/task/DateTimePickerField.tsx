import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useThemeMode } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/I18nContext';
import { getApiBaseUrl } from '../../lib/api';
import { createStyles } from '../../styles/createStyles';
import { formatDateTime } from '../../lib/date';

type Props = {
  label: string;
  value: string;
  onChange: (nextIso: string) => void;
};

type DateTimeMessage =
  | { type: 'ready' }
  | { type: 'change'; payload?: { value?: string } }
  | { type: 'error'; payload?: { message?: string } };

function toLocalDateTimeValue(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(localDateTimeValue: string) {
  const parsed = new Date(localDateTimeValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function buildHtml(input: { valueLocal: string; dark: boolean }) {
  const bg = input.dark ? '#10131B' : '#FFFFFF';
  const text = input.dark ? '#F8FAFF' : '#0F172A';
  const border = input.dark ? '#202637' : '#E5EAF5';
  const fieldBg = input.dark ? '#171C28' : '#F8FAFC';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: transparent;
        font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
      }
      .wrap {
        border: 1px solid ${border};
        border-radius: 10px;
        background: ${fieldBg};
        padding: 10px;
      }
      input {
        width: 100%;
        border: none;
        outline: none;
        background: transparent;
        color: ${text};
        font-size: 14px;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <input id="dt" type="datetime-local" value="${input.valueLocal}" />
    </div>
    <script>
      const dt = document.getElementById('dt');
      const bridge = window.ReactNativeWebView;

      function emit() {
        if (!bridge) return;
        bridge.postMessage(JSON.stringify({ type: 'change', value: dt.value || '' }));
      }

      dt.addEventListener('input', emit);
      dt.addEventListener('change', emit);
    </script>
  </body>
</html>`;
}

export function DateTimePickerField({ label, value, onChange }: Props) {
  const { colors, mode } = useThemeMode();
  const webTheme = mode === 'black' ? 'dark' : 'light';
  const { locale } = useI18n();
  const s = createStyles(colors);
  const ref = useRef<WebView>(null);
  const readyRef = useRef(false);
  const [remoteUriIndex, setRemoteUriIndex] = useState(0);
  const [fallbackLocal, setFallbackLocal] = useState(false);

  const valueLocal = useMemo(() => toLocalDateTimeValue(value), [value]);
  const html = useMemo(() => buildHtml({ valueLocal, dark: mode === 'black' }), [valueLocal, mode]);
  const remoteUris = useMemo(() => {
    const base = getApiBaseUrl().replace(/\/+$/, '');
    return [
      `${base}/${locale}/mobile/datetime`,
      `${base}/mobile/datetime`,
    ];
  }, [locale]);
  const remoteUri = remoteUris[Math.min(remoteUriIndex, remoteUris.length - 1)];
  const handleRemoteFailure = useCallback(() => {
    if (fallbackLocal) return;
    readyRef.current = false;
    setRemoteUriIndex((prev) => {
      const next = prev + 1;
      if (next < remoteUris.length) {
        return next;
      }
      setFallbackLocal(true);
      return prev;
    });
  }, [fallbackLocal, remoteUris.length]);

  const postSetValue = useCallback(() => {
    if (fallbackLocal || !readyRef.current) return;
    ref.current?.postMessage(
      JSON.stringify({
        channel: 'pecal-datetime',
        type: 'set-value',
        payload: {
          value: valueLocal,
          label,
          theme: webTheme,
        },
      })
    );
  }, [fallbackLocal, label, valueLocal, webTheme]);

  useEffect(() => {
    postSetValue();
  }, [postSetValue]);

  return (
    <View style={{ gap: 6 }}>
      <Text style={s.formTitle}>{label}</Text>
      <Text style={s.itemMeta}>{formatDateTime(value)}</Text>
      <View style={{ borderRadius: 10, overflow: 'hidden' }}>
        <WebView
          ref={ref}
          originWhitelist={['*']}
          source={fallbackLocal ? { html } : { uri: remoteUri }}
          scrollEnabled={false}
          javaScriptEnabled
          automaticallyAdjustContentInsets={false}
          style={{ height: fallbackLocal ? 56 : 86, backgroundColor: 'transparent' }}
          onError={handleRemoteFailure}
          onHttpError={handleRemoteFailure}
          onMessage={(event) => {
            try {
              const raw = JSON.parse(event.nativeEvent.data) as
                | DateTimeMessage
                | { channel?: string; type?: string; value?: string; payload?: { value?: string; message?: string } };
              if ((raw as { channel?: string }).channel === 'pecal-datetime') {
                const typed = raw as { type?: string; payload?: { value?: string; message?: string } };
                if (typed.type === 'ready') {
                  readyRef.current = true;
                  postSetValue();
                  return;
                }
                if (typed.type !== 'change') return;
                const nextValue = typed.payload?.value;
                if (!nextValue) return;
                onChange(nextValue);
                return;
              }

              const message = raw as { type?: string; value?: string };
              if (message.type !== 'change' || !message.value) return;
              const next = toIso(message.value);
              if (!next) return;
              onChange(next);
            } catch {
              // ignore malformed payload
            }
          }}
        />
      </View>
    </View>
  );
}
