import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateTimePickerField } from '../../../../src/components/task/DateTimePickerField';
import { useI18n } from '../../../../src/contexts/I18nContext';
import { useMobileApp } from '../../../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../../../src/contexts/ThemeContext';
import { apiFetch } from '../../../../src/lib/api';
import { createStyles } from '../../../../src/styles/createStyles';

type Visibility = 'public' | 'restricted';
type TaskExportResponse = { token: string; url: string; path: string };
const PUBLIC_WEB_ORIGIN = 'https://pecal.site';

function formatLocalMySqlDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

function getDefaultExpiryIso() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString();
}

function normalizeExportUrl(input: TaskExportResponse) {
  if (input.path?.startsWith('/')) {
    return `${PUBLIC_WEB_ORIGIN}${input.path}`;
  }
  try {
    const parsed = new URL(input.url);
    if (parsed.hostname === '0.0.0.0' || parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') {
      return `${PUBLIC_WEB_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // ignore invalid URL and fallback below
  }
  if (input.url?.startsWith('http://') || input.url?.startsWith('https://')) {
    return input.url;
  }
  return `${PUBLIC_WEB_ORIGIN}/${String(input.url || '').replace(/^\/+/, '')}`;
}

export default function TaskExportPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { auth } = useMobileApp();
  const { colors } = useThemeMode();
  const { t } = useI18n();
  const s = createStyles(colors);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const taskId = Number(id);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [useExpiry, setUseExpiry] = useState(false);
  const [expiresAt, setExpiresAt] = useState(getDefaultExpiryIso());
  const [creating, setCreating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const canSubmit = useMemo(() => Number.isFinite(taskId) && taskId > 0, [taskId]);

  const handleCreateExport = useCallback(async () => {
    if (!auth.session || !canSubmit) return;
    setCreating(true);
    try {
      const expires = useExpiry ? formatLocalMySqlDateTime(expiresAt) : null;
      const result = await apiFetch<TaskExportResponse>(
        `/api/tasks/${taskId}/export`,
        auth.session,
        {
          method: 'POST',
          body: JSON.stringify({
            visibility,
            expires_at: expires,
          }),
        },
      );
      if (!result?.url) {
        throw new Error('Export URL is missing');
      }
      setShareUrl(normalizeExportUrl(result));
      Alert.alert(t('tasksExportDoneTitle'), t('tasksExportDoneDescription'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('tasksExportFailedDescription');
      Alert.alert(t('tasksExportFailedTitle'), message);
    } finally {
      setCreating(false);
    }
  }, [auth.session, canSubmit, expiresAt, taskId, t, useExpiry, visibility]);

  const handleShare = useCallback(async () => {
    if (!shareUrl) return;
    setSharing(true);
    try {
      await Share.share({
        title: t('tasksExportShareTitle'),
        message: shareUrl,
        url: shareUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('tasksExportFailedDescription');
      Alert.alert(t('tasksExportFailedTitle'), message);
    } finally {
      setSharing(false);
    }
  }, [shareUrl, t]);

  if (!auth.session) return <Redirect href="/(auth)/login" />;

  if (!canSubmit) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>{t('tasksExportInvalidTask')}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={s.content}>
        <View style={[s.contentContainer, { gap: 12 }]}>
          <View style={[s.panel, { borderRadius: 16, gap: 10 }]}>
            <Text style={s.sectionTitle}>{t('tasksExportPageTitle')}</Text>
            <Text style={s.itemMeta}>{t('tasksExportPageDescription')}</Text>

            <Text style={s.formTitle}>{t('tasksExportVisibilityLabel')}</Text>
            <View style={s.row}>
              <Pressable
                onPress={() => setVisibility('public')}
                style={[
                  s.workspacePill,
                  { marginRight: 0, paddingVertical: 7, paddingHorizontal: 10 },
                  visibility === 'public' ? s.workspacePillActive : null,
                ]}
              >
                <Text style={[s.workspacePillText, visibility === 'public' ? s.workspacePillTextActive : null]}>
                  {t('tasksExportVisibilityPublic')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setVisibility('restricted')}
                style={[
                  s.workspacePill,
                  { marginRight: 0, paddingVertical: 7, paddingHorizontal: 10 },
                  visibility === 'restricted' ? s.workspacePillActive : null,
                ]}
              >
                <Text style={[s.workspacePillText, visibility === 'restricted' ? s.workspacePillTextActive : null]}>
                  {t('tasksExportVisibilityRestricted')}
                </Text>
              </Pressable>
            </View>

            <Text style={s.formTitle}>{t('tasksExportExpiryLabel')}</Text>
            <Pressable
              onPress={() => setUseExpiry((prev) => !prev)}
              style={[
                s.workspacePill,
                { alignSelf: 'flex-start', marginRight: 0, paddingVertical: 7, paddingHorizontal: 10 },
                useExpiry ? s.workspacePillActive : null,
              ]}
            >
              <Text style={[s.workspacePillText, useExpiry ? s.workspacePillTextActive : null]}>
                {useExpiry ? t('tasksExportExpiryEnabled') : t('tasksExportExpiryDisabled')}
              </Text>
            </Pressable>

            {useExpiry ? (
              <DateTimePickerField
                label={t('tasksExportExpiryPickerLabel')}
                value={expiresAt}
                onChange={setExpiresAt}
              />
            ) : null}

            {shareUrl ? (
              <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 }}>
                <Text style={s.formTitle}>{t('tasksExportLinkLabel')}</Text>
                <Text selectable style={s.itemMeta}>
                  {shareUrl}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 12, paddingBottom: Math.max(8, insets.bottom), paddingTop: 8, gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            style={s.secondaryButtonHalf}
            onPress={() => router.back()}
          >
            <Text style={s.secondaryButtonText}>{t('tasksBackToDetail')}</Text>
          </Pressable>
          <Pressable
            style={s.primaryButtonHalf}
            onPress={handleCreateExport}
            disabled={creating}
          >
            <Text style={s.primaryButtonText}>{creating ? t('tasksExporting') : t('tasksExportCreateLink')}</Text>
          </Pressable>
        </View>
        <Pressable
          style={[s.primaryButton, !shareUrl ? { opacity: 0.5 } : null]}
          disabled={!shareUrl || sharing}
          onPress={handleShare}
        >
          <Text style={s.primaryButtonText}>{sharing ? t('tasksSharing') : t('tasksShare')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
