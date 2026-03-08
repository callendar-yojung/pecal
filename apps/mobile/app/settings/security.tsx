import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useMobileApp } from '../../src/contexts/MobileAppContext';
import { useI18n } from '../../src/contexts/I18nContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { apiFetch } from '../../src/lib/api';
import { createStyles } from '../../src/styles/createStyles';

type LoginSessionItem = {
  session_id: string;
  provider: string;
  client_platform: string;
  client_name: string;
  app_version?: string | null;
  user_agent?: string | null;
  created_at: string;
  last_seen_at: string;
  current: boolean;
};

function providerToLabel(provider?: string, isKo?: boolean) {
  if (provider === 'apple') return isKo ? 'Apple 계정' : 'Apple';
  if (provider === 'google') return isKo ? 'Google 계정' : 'Google';
  if (provider === 'kakao') return isKo ? '카카오 계정' : 'Kakao';
  return isKo ? '기타' : 'Other';
}

function detectBrowser(userAgent?: string | null) {
  if (!userAgent) return null;
  const agent = userAgent.toLowerCase();
  if (agent.includes('edg/')) return 'Microsoft Edge';
  if (agent.includes('chrome/') && !agent.includes('edg/')) return 'Google Chrome';
  if (agent.includes('safari/') && !agent.includes('chrome/')) return 'Safari';
  if (agent.includes('firefox/')) return 'Firefox';
  return null;
}

function detectDeviceType(item: LoginSessionItem, isKo: boolean) {
  if (item.client_platform === 'desktop') return isKo ? '데스크탑 앱' : 'Desktop app';
  if (item.client_platform === 'ios' || item.client_platform === 'android') {
    return isKo ? '모바일 앱' : 'Mobile app';
  }
  if (item.client_platform === 'web') {
    const agent = item.user_agent?.toLowerCase() ?? '';
    return /iphone|ipad|android|mobile/.test(agent)
      ? isKo
        ? '모바일 브라우저'
        : 'Mobile browser'
      : isKo
        ? '데스크탑 브라우저'
        : 'Desktop browser';
  }
  return item.client_platform;
}

function detectHardware(item: LoginSessionItem) {
  const clientName = item.client_name?.trim();
  if (
    clientName &&
    clientName !== 'Pecal' &&
    clientName !== 'Pecal Mobile' &&
    clientName !== 'Pecal Desktop' &&
    clientName !== 'Pecal Web'
  ) {
    return clientName;
  }

  const agent = item.user_agent?.toLowerCase() ?? '';
  if (item.client_platform === 'ios') return 'iPhone';
  if (item.client_platform === 'android') return 'Android';
  if (item.client_platform === 'desktop') return 'Desktop';
  if (agent.includes('iphone')) return 'iPhone';
  if (agent.includes('ipad')) return 'iPad';
  if (agent.includes('android') && agent.includes('mobile')) return 'Android phone';
  if (agent.includes('android')) return 'Android tablet';
  if (agent.includes('mac os x') || agent.includes('macintosh')) return 'Mac';
  if (agent.includes('windows')) return 'Windows PC';
  return clientName || item.client_platform;
}

function buildDeviceLabel(item: LoginSessionItem) {
  const version = item.app_version ? ` · v${item.app_version}` : '';
  return `${detectHardware(item)}${version}`;
}

function buildEnvironmentLabel(item: LoginSessionItem, isKo: boolean) {
  const parts = [
    detectDeviceType(item, isKo),
    detectBrowser(item.user_agent),
  ].filter(Boolean);
  return parts.join(' · ') || item.client_platform;
}

export default function SettingsSecurityPage() {
  const router = useRouter();
  const { auth } = useMobileApp();
  const { locale } = useI18n();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const isKo = locale === 'ko';

  const [sessions, setSessions] = useState<LoginSessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort((left, right) => {
        if (left.current && !right.current) return -1;
        if (!left.current && right.current) return 1;
        return new Date(right.last_seen_at).getTime() - new Date(left.last_seen_at).getTime();
      }),
    [sessions],
  );

  useEffect(() => {
    if (!auth.session) return;
    const run = async () => {
      try {
        setLoading(true);
        const data = await apiFetch<{ sessions?: LoginSessionItem[] }>(
          '/api/me/sessions',
          auth.session,
        );
        setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      } catch {
        setSessions([]);
        setMessage(
          isKo ? '로그인 기기 목록을 불러오지 못했습니다.' : 'Failed to load signed-in devices.',
        );
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [auth.session, isKo]);

  const onLogout = () => {
    if (!auth.session) return;

    Alert.alert(
      isKo ? '로그아웃' : 'Log out',
      isKo ? '현재 계정에서 로그아웃하시겠습니까?' : 'Do you want to log out of the current account?',
      [
        { text: isKo ? '취소' : 'Cancel', style: 'cancel' },
        {
          text: isKo ? '로그아웃' : 'Log out',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await auth.logout();
              router.replace('/(auth)/login');
            })();
          },
        },
      ],
    );
  };

  const onRevokeSession = (target: LoginSessionItem) => {
    if (!auth.session || target.current || revokingSessionId) return;

    Alert.alert(
      isKo ? '기기 로그아웃' : 'Sign out device',
      isKo
        ? '선택한 기기의 로그인 세션을 종료하시겠습니까?'
        : 'Do you want to revoke the selected device session?',
      [
        { text: isKo ? '취소' : 'Cancel', style: 'cancel' },
        {
          text: isKo ? '로그아웃' : 'Sign out',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                setRevokingSessionId(target.session_id);
                await apiFetch<{ success: boolean }>(
                  `/api/me/sessions/${target.session_id}`,
                  auth.session,
                  { method: 'DELETE' },
                );
                setSessions((prev) => prev.filter((item) => item.session_id !== target.session_id));
              } catch {
                setMessage(
                  isKo
                    ? '기기 로그아웃에 실패했습니다.'
                    : 'Failed to revoke the device session.',
                );
              } finally {
                setRevokingSessionId(null);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={s.content} contentContainerStyle={s.contentContainer}>
      <View style={s.section}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingRight: 6 }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>
              {isKo ? '설정' : 'Settings'}
            </Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
            {isKo ? '보안' : 'Security'}
          </Text>
          <View style={{ width: 58 }} />
        </View>

        <Text style={{ color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 }}>
          {isKo ? '보안' : 'Security'}
        </Text>

        <View style={[s.panel, { borderRadius: 13, gap: 10 }]}>
          <Text style={s.formTitle}>{isKo ? '세션' : 'Session'}</Text>
          <Text style={s.itemMeta}>
            {isKo ? '현재 기기 로그아웃과 다른 기기 세션 종료를 관리합니다.' : 'Manage log out on this device and other active sessions.'}
          </Text>
          <Pressable
            style={[
              s.secondaryButtonHalf,
              {
                width: '100%',
              },
            ]}
            onPress={onLogout}
          >
            <Text style={s.secondaryButtonText}>
              {isKo ? '로그아웃' : 'Log out'}
            </Text>
          </Pressable>
        </View>

        <View style={[s.panel, { borderRadius: 13, gap: 10 }]}>
          <Text style={s.formTitle}>{isKo ? '로그인 기기' : 'Logged-in Devices'}</Text>
          <Text style={s.itemMeta}>
            {isKo
              ? '현재 로그인된 기기와 브라우저를 확인하고 다른 세션을 종료할 수 있습니다.'
              : 'Review active devices and browsers, then revoke other sessions.'}
          </Text>
          {loading ? (
            <Text style={s.itemMeta}>{isKo ? '불러오는 중...' : 'Loading...'}</Text>
          ) : sortedSessions.length === 0 ? (
            <Text style={s.itemMeta}>{isKo ? '표시할 기기가 없습니다.' : 'No devices to display.'}</Text>
          ) : (
            sortedSessions.map((item) => (
              <View
                key={item.session_id}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 11,
                  gap: 6,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 }}>
                    {buildDeviceLabel(item)}
                  </Text>
                  <Text
                    style={{
                      color: item.current ? colors.primary : colors.textMuted,
                      fontSize: 11,
                      fontWeight: '700',
                    }}
                  >
                    {item.current ? (isKo ? '현재 기기' : 'Current') : item.client_platform}
                  </Text>
                </View>
                <Text style={s.itemMeta}>
                  {isKo ? '브라우저/기기' : 'Browser / Device'}: {buildEnvironmentLabel(item, isKo)}
                </Text>
                <Text style={s.itemMeta}>
                  {isKo ? '로그인 방식' : 'Provider'}: {providerToLabel(item.provider, isKo)}
                </Text>
                <Text style={s.itemMeta}>
                  {isKo ? '최근 사용' : 'Last active'}: {new Date(item.last_seen_at).toLocaleString()}
                </Text>
                {!item.current ? (
                  <Pressable
                    style={s.secondaryButtonHalf}
                    onPress={() => onRevokeSession(item)}
                    disabled={revokingSessionId === item.session_id}
                  >
                    <Text style={s.secondaryButtonText}>
                      {revokingSessionId === item.session_id
                        ? (isKo ? '처리 중...' : 'Revoking...')
                        : (isKo ? '이 기기 로그아웃' : 'Sign out this device')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
          {message ? <Text style={s.itemMeta}>{message}</Text> : null}
        </View>
      </View>
    </ScrollView>
  );
}
