import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useMobileApp } from '../../src/contexts/MobileAppContext';
import { useI18n } from '../../src/contexts/I18nContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { apiFetch } from '../../src/lib/api';
import { createStyles } from '../../src/styles/createStyles';

function providerToLabel(provider?: string, isKo?: boolean) {
  if (provider === 'apple') return isKo ? 'Apple 계정' : 'Apple';
  if (provider === 'google') return isKo ? 'Google 계정' : 'Google';
  if (provider === 'kakao') return isKo ? '카카오 계정' : 'Kakao';
  return isKo ? '기타' : 'Other';
}

export default function SettingsProfilePage() {
  const router = useRouter();
  const { auth } = useMobileApp();
  const { locale } = useI18n();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const isKo = locale === 'ko';

  const [serverEmail, setServerEmail] = useState<string>('');
  const [currentNickname, setCurrentNickname] = useState(auth.session?.nickname ?? '');
  const [nicknameInput, setNicknameInput] = useState(auth.session?.nickname ?? '');
  const [checking, setChecking] = useState(false);
  const [checkOk, setCheckOk] = useState<boolean | null>(null);
  const [checkedNickname, setCheckedNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!auth.session) return;
    const run = async () => {
      try {
        const me = await apiFetch<{ email?: string | null; nickname?: string }>(
          '/api/me/account',
          auth.session,
        );
        setServerEmail(typeof me.email === 'string' ? me.email : '');
        if (typeof me.nickname === 'string' && me.nickname.trim()) {
          setCurrentNickname(me.nickname);
          setNicknameInput(me.nickname);
        }
      } catch {
        setServerEmail(auth.session?.email ?? '');
      }
    };
    void run();
  }, [auth.session]);

  const displayEmail = useMemo(() => {
    const email = serverEmail || auth.session?.email || '';
    return email.trim() ? email : isKo ? '이메일 없음' : 'No email';
  }, [auth.session?.email, isKo, serverEmail]);

  const providerLabel = providerToLabel(auth.session?.provider, isKo);
  const nicknameTrimmed = nicknameInput.trim();
  const nicknameChanged = nicknameTrimmed !== currentNickname.trim();

  const onCheckNickname = async () => {
    if (!auth.session) return;
    if (!nicknameTrimmed) {
      setMessage(isKo ? '닉네임을 입력하세요.' : 'Enter a nickname.');
      setCheckOk(false);
      return;
    }
    if (!nicknameChanged) {
      setCheckOk(true);
      setCheckedNickname(nicknameTrimmed);
      setMessage(isKo ? '현재 사용 중인 닉네임입니다.' : 'This is your current nickname.');
      return;
    }

    setChecking(true);
    setMessage('');
    try {
      const result = await apiFetch<{ available: boolean; reason?: string | null }>(
        `/api/me/account/nickname-check?nickname=${encodeURIComponent(nicknameTrimmed)}`,
        auth.session,
      );
      if (result.available) {
        setCheckOk(true);
        setCheckedNickname(nicknameTrimmed);
        setMessage(isKo ? '사용 가능한 닉네임입니다.' : 'Nickname is available.');
      } else {
        setCheckOk(false);
        const reason = result.reason;
        if (reason === 'taken') {
          setMessage(isKo ? '이미 사용 중인 닉네임입니다.' : 'Nickname is already taken.');
        } else if (reason === 'reserved') {
          setMessage(isKo ? '사용할 수 없는 닉네임입니다.' : 'Nickname is reserved.');
        } else if (reason === 'too_long') {
          setMessage(isKo ? '닉네임이 너무 깁니다.' : 'Nickname is too long.');
        } else {
          setMessage(isKo ? '중복 확인에 실패했습니다.' : 'Failed to check nickname.');
        }
      }
    } catch {
      setCheckOk(false);
      setMessage(isKo ? '중복 확인 중 오류가 발생했습니다.' : 'Error while checking nickname.');
    } finally {
      setChecking(false);
    }
  };

  const onSaveNickname = async () => {
    if (!auth.session) return;
    if (!nicknameChanged) {
      setMessage(isKo ? '변경할 닉네임이 없습니다.' : 'No nickname changes.');
      return;
    }
    if (!(checkOk && checkedNickname === nicknameTrimmed)) {
      setMessage(isKo ? '닉네임 중복확인을 먼저 진행하세요.' : 'Check nickname availability first.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      await apiFetch<{ success: boolean; nickname?: string }>(
        '/api/me/account',
        auth.session,
        {
          method: 'PATCH',
          body: JSON.stringify({ nickname: nicknameTrimmed }),
        },
      );
      setCurrentNickname(nicknameTrimmed);
      setCheckedNickname(nicknameTrimmed);
      setCheckOk(true);
      await auth.updateSessionProfile({ nickname: nicknameTrimmed });
      setMessage(isKo ? '닉네임이 변경되었습니다.' : 'Nickname updated.');
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : String(error);
      if (text.includes('taken')) {
        setMessage(isKo ? '이미 사용 중인 닉네임입니다.' : 'Nickname is already taken.');
      } else {
        setMessage(isKo ? '닉네임 변경에 실패했습니다.' : 'Failed to update nickname.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={s.content} contentContainerStyle={s.contentContainer}>
      <View style={s.section}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingRight: 6 }}
          >
            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>
              {isKo ? '설정' : 'Settings'}
            </Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
            {isKo ? '프로필' : 'Profile'}
          </Text>
          <View style={{ width: 58 }} />
        </View>

        <Text style={{ color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 }}>
          {isKo ? '프로필' : 'Profile'}
        </Text>

        <View style={[s.panel, { borderRadius: 13, gap: 0, paddingHorizontal: 0, overflow: 'hidden' }]}>
          <View style={{ paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>{isKo ? '닉네임' : 'Nickname'}</Text>
            <Text style={{ color: colors.text, fontSize: 16, marginTop: 4 }}>{currentNickname || '-'}</Text>
          </View>
          <View style={{ paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>{isKo ? '이메일' : 'Email'}</Text>
            <Text style={{ color: colors.text, fontSize: 16, marginTop: 4 }}>{displayEmail}</Text>
          </View>
          <View style={{ paddingHorizontal: 14, paddingVertical: 13 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>
              {isKo ? '로그인 방식' : 'Sign-in Method'}
            </Text>
            <Text style={{ color: colors.text, fontSize: 16, marginTop: 4 }}>{providerLabel}</Text>
          </View>
        </View>

        <View style={[s.panel, { borderRadius: 13, gap: 10 }]}>
          <Text style={s.formTitle}>{isKo ? '닉네임 변경' : 'Change Nickname'}</Text>
          <TextInput
            value={nicknameInput}
            onChangeText={(value) => {
              setNicknameInput(value);
              setCheckOk(null);
              setCheckedNickname('');
            }}
            placeholder={isKo ? '새 닉네임 입력' : 'Enter new nickname'}
            style={s.input}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              style={s.secondaryButtonHalf}
              onPress={() => {
                void onCheckNickname();
              }}
              disabled={checking}
            >
              <Text style={s.secondaryButtonText}>
                {checking ? (isKo ? '확인 중...' : 'Checking...') : (isKo ? '중복 확인' : 'Check')}
              </Text>
            </Pressable>
            <Pressable
              style={s.primaryButtonHalf}
              onPress={() => {
                void onSaveNickname();
              }}
              disabled={saving}
            >
              <Text style={s.primaryButtonText}>
                {saving ? (isKo ? '변경 중...' : 'Saving...') : (isKo ? '닉네임 변경' : 'Save Nickname')}
              </Text>
            </Pressable>
          </View>
          {checkOk !== null ? (
            <Text style={{ color: checkOk ? '#10B981' : '#EF4444', fontSize: 12, fontWeight: '600' }}>
              {checkOk ? (isKo ? '중복 확인 완료' : 'Checked') : (isKo ? '중복 확인 필요' : 'Check required')}
            </Text>
          ) : null}
          {message ? <Text style={s.itemMeta}>{message}</Text> : null}
        </View>
      </View>
    </ScrollView>
  );
}
