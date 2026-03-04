import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useI18n } from '../../contexts/I18nContext';
import { useThemeMode } from '../../contexts/ThemeContext';
import { getApiBaseUrl } from '../../lib/api';
import type { TaskItem } from '../../lib/types';

type Props = {
  task: TaskItem;
  authToken?: string;
  availableTags?: Array<{ tag_id: number; name: string; color?: string }>;
  minHeight?: number;
};

type DetailMessage =
  | { type: 'ready' }
  | { type: 'height'; payload?: { height?: number } }
  | { type: 'error'; payload?: { message?: string } };

function taskContentText(content: string | null | undefined) {
  if (!content) return '';
  const trimmed = content.trim();
  if (!trimmed) return '';
  return trimmed;
}

export function TaskDetailWebView({ task, authToken, availableTags = [], minHeight = 460 }: Props) {
  const ref = useRef<WebView>(null);
  const readyRef = useRef(false);
  const { locale } = useI18n();
  const { resolvedMode } = useThemeMode();
  const webTheme = resolvedMode === 'black' ? 'dark' : 'light';
  const [webHeight, setWebHeight] = useState(minHeight);
  const [remoteUriIndex, setRemoteUriIndex] = useState(0);
  const [fallbackLocal, setFallbackLocal] = useState(false);
  const [webLoading, setWebLoading] = useState(true);

  const remoteUris = useMemo(() => {
    const base = getApiBaseUrl().replace(/\/+$/, '');
    const params = new URLSearchParams({ theme: webTheme });
    const query = params.toString();
    return [
      `${base}/${locale}/mobile/tasks/detail?${query}`,
      `${base}/mobile/tasks/detail?${query}`,
    ];
  }, [locale, webTheme]);
  const remoteUri = remoteUris[Math.min(remoteUriIndex, remoteUris.length - 1)];

  const postTask = useCallback(() => {
    if (fallbackLocal || !readyRef.current) return;
    ref.current?.postMessage(
      JSON.stringify({
        channel: 'pecal-task-detail',
        type: 'set-task',
        payload: {
          task: {
            id: task.id,
            title: task.title,
            start_time: task.start_time,
            end_time: task.end_time,
            content: task.content ?? '',
            status: task.status ?? 'TODO',
            color: task.color ?? '#3B82F6',
            tag_ids: task.tag_ids ?? [],
            is_all_day: !!task.is_all_day,
            reminder_minutes: task.reminder_minutes ?? null,
            rrule: task.rrule ?? null,
            theme: webTheme,
          },
          auth_token: authToken ?? '',
          tags: availableTags,
        },
      })
    );
  }, [authToken, availableTags, fallbackLocal, task, webTheme]);

  const handleRemoteFailure = useCallback(() => {
    if (fallbackLocal) return;
    readyRef.current = false;
    setWebLoading(false);
    setRemoteUriIndex((prev) => {
      const next = prev + 1;
      if (next < remoteUris.length) {
        return next;
      }
      setFallbackLocal(true);
      return prev;
    });
  }, [fallbackLocal, remoteUris.length]);

  useEffect(() => {
    postTask();
  }, [postTask]);

  if (fallbackLocal) {
    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: resolvedMode === 'black' ? '#2D3443' : '#D9E0EF',
          borderRadius: 12,
          padding: 12,
          backgroundColor: resolvedMode === 'black' ? '#141923' : '#FFFFFF',
          gap: 8,
        }}
      >
        <Text style={{ color: resolvedMode === 'black' ? '#F3F6FF' : '#111827', fontSize: 18, fontWeight: '700' }}>
          {task.title}
        </Text>
        <Text style={{ color: resolvedMode === 'black' ? '#A3AEC2' : '#667085' }}>
          {task.start_time} - {task.end_time}
        </Text>
        <Text style={{ color: resolvedMode === 'black' ? '#D0D7E7' : '#334155' }}>{taskContentText(task.content) || '내용 없음'}</Text>
      </View>
    );
  }

  return (
    <View style={{ minHeight: Math.max(webHeight, minHeight), borderRadius: 12 }}>
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{ uri: remoteUri }}
        scrollEnabled
        nestedScrollEnabled
        javaScriptEnabled
        scalesPageToFit={false}
        automaticallyAdjustContentInsets={false}
        contentInset={{ top: 0, bottom: 0, left: 0, right: 0 }}
        contentInsetAdjustmentBehavior="never"
        style={{ height: Math.max(minHeight, webHeight), backgroundColor: 'transparent' }}
        onLoadStart={() => setWebLoading(true)}
        onLoadEnd={() => setWebLoading(false)}
        onError={handleRemoteFailure}
        onHttpError={handleRemoteFailure}
        onMessage={(event) => {
          try {
            const raw = JSON.parse(event.nativeEvent.data) as
              | DetailMessage
              | { channel?: string; type?: string; payload?: { height?: number; message?: string } };
            if ((raw as { channel?: string }).channel !== 'pecal-task-detail') return;
            const message = raw as { type?: string; payload?: { height?: number } };
            if (message.type === 'ready') {
              readyRef.current = true;
              postTask();
              return;
            }
            if (message.type === 'height') {
              // Add a small buffer to avoid clipping due to border/pixel rounding differences.
              const measured = Number(message.payload?.height) || minHeight;
              const next = Math.max(minHeight, Math.min(6000, measured + 40));
              setWebHeight(next);
            }
          } catch {
            // ignore malformed bridge payload
          }
        }}
      />
      {webLoading ? (
        <View
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: resolvedMode === 'black' ? 'rgba(7,9,14,0.82)' : 'rgba(242,244,251,0.84)',
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
              borderColor: resolvedMode === 'black' ? '#2D3443' : '#D9E0EF',
              backgroundColor: resolvedMode === 'black' ? '#141923' : '#FFFFFF',
            }}
          >
            <Image source={require('../../../assets/icon.png')} style={{ width: 60, height: 60, borderRadius: 14 }} />
            <ActivityIndicator color={task.color ?? '#3B82F6'} />
            <Text style={{ color: resolvedMode === 'black' ? '#F3F6FF' : '#111827', fontSize: 13, fontWeight: '700' }}>
              로딩 중...
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
