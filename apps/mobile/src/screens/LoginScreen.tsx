import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { useThemeMode } from '../contexts/ThemeContext';
import { createStyles } from '../styles/createStyles';
import type { OAuthProvider } from '../lib/types';

type Props = {
  error: string | null;
  authLoading: OAuthProvider | 'local-login' | 'local-register' | null;
  onLogin: (provider: OAuthProvider) => void;
  onLocalLogin: (params: { loginId: string; password: string }) => void;
  onLocalRegister: (params: { loginId: string; password: string; nickname: string; email: string }) => void;
  onFindLoginId: (email: string) => Promise<{ success: boolean; message?: string }>;
  onSendPasswordResetCode: (loginId: string, email: string) => Promise<{ success: boolean; message?: string }>;
  onResetPassword: (params: {
    loginId: string;
    email: string;
    code: string;
    password: string;
  }) => Promise<{ success: boolean }>;
  onCheckLocalAvailability: (params: {
    loginId?: string;
    nickname?: string;
  }) => Promise<{
    loginId?: { available: boolean; message: string };
    nickname?: { available: boolean; message: string };
  }>;
  onSendRegisterVerificationCode: (email: string) => Promise<void>;
  onVerifyRegisterVerificationCode: (email: string, code: string) => Promise<void>;
};

type AvailabilityState = {
  value: string;
  available: boolean;
  message: string;
};

type AuthPanel = 'entry' | 'local' | 'social';

const EMAIL_VERIFICATION_TTL_SECONDS = 3 * 60;

function isValidRegisterPassword(password: string) {
  return password.length >= 8 && /[^A-Za-z0-9]/.test(password);
}

function getRegisterPasswordChecks(password: string) {
  return [
    { key: 'length', label: '8자 이상', satisfied: password.length >= 8 },
    { key: 'special', label: '특수문자 포함', satisfied: /[^A-Za-z0-9]/.test(password) },
  ] as const;
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${minutes}:${String(remain).padStart(2, '0')}`;
}

export function LoginScreen({
  error,
  authLoading,
  onLogin,
  onLocalLogin,
  onLocalRegister,
  onFindLoginId,
  onSendPasswordResetCode,
  onResetPassword,
  onCheckLocalAvailability,
  onSendRegisterVerificationCode,
  onVerifyRegisterVerificationCode,
}: Props) {
  const { t } = useI18n();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const [authPanel, setAuthPanel] = useState<AuthPanel>('entry');
  const [mode, setMode] = useState<'login' | 'register' | 'findId' | 'resetPassword'>('login');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [checkingLoginId, setCheckingLoginId] = useState(false);
  const [checkingNickname, setCheckingNickname] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [findingLoginId, setFindingLoginId] = useState(false);
  const [sendingResetCode, setSendingResetCode] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [loginIdCheck, setLoginIdCheck] = useState<AvailabilityState | null>(null);
  const [nicknameCheck, setNicknameCheck] = useState<AvailabilityState | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerifiedTarget, setEmailVerifiedTarget] = useState('');
  const [verificationExpiresAt, setVerificationExpiresAt] = useState<number | null>(null);
  const [verificationRemainingSeconds, setVerificationRemainingSeconds] = useState(0);
  const [emailMessage, setEmailMessage] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!verificationExpiresAt) {
      setVerificationRemainingSeconds(0);
      return;
    }

    const updateRemaining = () => {
      const remain = Math.max(0, Math.ceil((verificationExpiresAt - Date.now()) / 1000));
      setVerificationRemainingSeconds(remain);
    };

    updateRemaining();
    const timer = setInterval(updateRemaining, 1000);
    return () => clearInterval(timer);
  }, [verificationExpiresAt]);

  const registerMode = mode === 'register';
  const resetMode = mode === 'resetPassword';
  const registerPasswordChecks = getRegisterPasswordChecks(password);
  const passwordValid = (!registerMode && !resetMode) || isValidRegisterPassword(password);
  const passwordConfirmed = (!registerMode && !resetMode) || password === passwordConfirm;
  const submitDisabled =
    (mode === 'login' && (!loginId.trim() || !password.trim())) ||
    (mode === 'register' &&
      (!email.trim() ||
        !nickname.trim() ||
        !passwordValid ||
        !emailVerified ||
        emailVerifiedTarget !== email.trim().toLowerCase() ||
        !passwordConfirm.trim() ||
        !passwordConfirmed ||
        loginIdCheck?.available !== true ||
        loginIdCheck.value !== loginId.trim().toLowerCase() ||
        nicknameCheck?.available !== true ||
        nicknameCheck.value !== nickname.trim())) ||
    (mode === 'findId' && !email.trim()) ||
    (mode === 'resetPassword' &&
      (!loginId.trim() ||
        !email.trim() ||
        !verificationCode.trim() ||
        !password.trim() ||
        !passwordConfirm.trim() ||
        !passwordValid ||
        !passwordConfirmed));

  const openLocalPanel = (nextMode: typeof mode = 'login') => {
    setAuthPanel('local');
    setMode(nextMode);
    setLocalError(null);
    setLocalStatus(null);
    setEmailMessage(null);
  };

  const openSocialPanel = () => {
    setAuthPanel('social');
    setLocalError(null);
    setLocalStatus(null);
    setEmailMessage(null);
  };

  const checkAvailability = async (field: 'loginId' | 'nickname') => {
    try {
      setLocalError(null);
      setLocalStatus(null);
      setEmailMessage(null);
      if (field === 'loginId') setCheckingLoginId(true);
      else setCheckingNickname(true);
      const result = await onCheckLocalAvailability(
        field === 'loginId' ? { loginId: loginId.trim() } : { nickname: nickname.trim() },
      );
      if (field === 'loginId' && result.loginId) {
        setLoginIdCheck({ value: loginId.trim().toLowerCase(), ...result.loginId });
      }
      if (field === 'nickname' && result.nickname) {
        setNicknameCheck({ value: nickname.trim(), ...result.nickname });
      }
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : t('loginAvailabilityFailed'));
    } finally {
      if (field === 'loginId') setCheckingLoginId(false);
      else setCheckingNickname(false);
    }
  };

  const sendVerificationCode = async () => {
    try {
      setLocalError(null);
      setLocalStatus(null);
      setSendingCode(true);
      await onSendRegisterVerificationCode(email.trim());
      setEmailVerified(false);
      setEmailVerifiedTarget('');
      setVerificationCode('');
      setVerificationExpiresAt(Date.now() + EMAIL_VERIFICATION_TTL_SECONDS * 1000);
      setEmailMessage({ text: t('loginVerificationCodeSent'), tone: 'success' });
    } catch (e) {
      setEmailMessage({ text: e instanceof Error ? e.message : t('loginVerificationFailed'), tone: 'error' });
    } finally {
      setSendingCode(false);
    }
  };

  const verifyVerificationCode = async () => {
    try {
      setLocalError(null);
      setLocalStatus(null);
      setEmailMessage(null);
      setVerifyingCode(true);
      if (verificationRemainingSeconds <= 0) {
        setEmailMessage({ text: t('loginVerificationExpired'), tone: 'error' });
        return;
      }
      const normalizedEmail = email.trim().toLowerCase();
      await onVerifyRegisterVerificationCode(normalizedEmail, verificationCode.trim());
      setEmailVerified(true);
      setEmailVerifiedTarget(normalizedEmail);
      setEmailMessage({ text: t('loginVerificationVerified'), tone: 'success' });
    } catch (e) {
      setEmailVerified(false);
      setEmailVerifiedTarget('');
      setEmailMessage({ text: e instanceof Error ? e.message : t('loginVerificationFailed'), tone: 'error' });
    } finally {
      setVerifyingCode(false);
    }
  };

  const findLoginId = async () => {
    try {
      setLocalError(null);
      setLocalStatus(null);
      setFindingLoginId(true);
      const result = await onFindLoginId(email.trim());
      setLocalStatus(result.message ?? t('loginFindIdSent'));
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : t('loginFindIdFailed'));
    } finally {
      setFindingLoginId(false);
    }
  };

  const sendResetCode = async () => {
    try {
      setLocalError(null);
      setLocalStatus(null);
      setSendingResetCode(true);
      const result = await onSendPasswordResetCode(loginId.trim(), email.trim());
      setVerificationExpiresAt(Date.now() + EMAIL_VERIFICATION_TTL_SECONDS * 1000);
      setLocalStatus(result.message ?? t('loginResetCodeSent'));
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : t('loginResetCodeFailed'));
    } finally {
      setSendingResetCode(false);
    }
  };

  const resetPassword = async () => {
    try {
      setLocalError(null);
      setLocalStatus(null);
      setResettingPassword(true);
      if (verificationRemainingSeconds <= 0) {
        setLocalError(t('loginVerificationExpired'));
        return;
      }
      await onResetPassword({
        loginId: loginId.trim(),
        email: email.trim(),
        code: verificationCode.trim(),
        password,
      });
      setLocalStatus(t('loginResetPasswordSuccess'));
      setMode('login');
      setVerificationCode('');
      setPassword('');
      setPasswordConfirm('');
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : t('loginResetPasswordFailed'));
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.loginBackdrop}>
        <View style={[s.loginOrb, s.loginOrbPrimary]} />
        <View style={[s.loginOrb, s.loginOrbSoft]} />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1, width: '100%' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          style={{ flex: 1, width: '100%' }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 20,
            paddingTop: authPanel === 'entry' ? 24 : 16,
            paddingBottom: 40,
            alignItems: 'center',
            justifyContent: authPanel === 'entry' ? 'center' : 'flex-start',
          }}
          contentInsetAdjustmentBehavior="always"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={s.authCardModern}>
        <View style={s.loginBrandRow}>
          <View style={[s.loginBrandIcon, { backgroundColor: colors.primary }]}>
            <Text style={s.logoText}>P</Text>
          </View>
          <Text style={s.brandTitle}>{t('appName')}</Text>
        </View>
        <Text style={s.loginHeadline}>{t('loginTitle')}</Text>
        <Text style={s.subtleText}>{t('loginSubtitle')}</Text>

        {error || localError ? <Text style={s.errorText}>{localError || error}</Text> : null}
        {localStatus ? <Text style={[s.subtleText, { color: '#16A34A' }]}>{localStatus}</Text> : null}

        {authPanel === 'entry' ? (
          <View style={{ gap: 12 }}>
            <Pressable style={s.primaryButton} onPress={() => openLocalPanel('login')}>
              <Text style={s.primaryButtonText}>{t('loginEntryLocal')}</Text>
            </Pressable>
            <Pressable style={[s.secondaryButton, { width: '100%', paddingVertical: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }]} onPress={openSocialPanel}>
              <Text style={[s.secondaryButtonText, { flex: 1, textAlign: 'left' }]} numberOfLines={1}>
                {t('loginEntrySocial')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, flexShrink: 0 }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#FEE500', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }}>
                  <Ionicons name="chatbubble-ellipses" size={15} color="#191919" />
                </View>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="logo-google" size={15} color="#4285F4" />
                </View>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="logo-apple" size={15} color="#fff" />
                </View>
              </View>
            </Pressable>
          </View>
        ) : null}

        {authPanel === 'local' ? (
          <>
            <Pressable
              onPress={() => setAuthPanel('entry')}
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="arrow-back" size={14} color={colors.text} />
              <Text style={[s.subtleText, { color: colors.text }]}>{t('loginEntryBack')}</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {[
                ['login', t('loginLocal')],
                ['register', t('loginSignup')],
              ].map(([key, label]) => (
                <Pressable
                  key={key}
                  style={[
                    s.secondaryButtonHalf,
                    { flexBasis: '48%' },
                    mode === key ? { borderColor: colors.primary, backgroundColor: colors.card } : null,
                  ]}
                  onPress={() => {
                    setMode(key as typeof mode);
                    setLocalError(null);
                    setLocalStatus(null);
                  }}
                >
                  <Text style={s.secondaryButtonText}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={s.panel}>
              {mode !== 'findId' ? (
                <>
                  <Text style={s.formTitle}>{t('loginIdLabel')}</Text>
                  <TextInput
                    style={s.input}
                    value={loginId}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={t('loginIdPlaceholder')}
                    onChangeText={(value) => {
                      setLoginId(value);
                      setLoginIdCheck(null);
                    }}
                    placeholderTextColor={colors.textMuted}
                  />
                </>
              ) : null}

              {mode === 'register' ? (
                <>
                  <Pressable
                    style={[s.secondaryButton, { width: '100%', minHeight: 48, justifyContent: 'center', paddingHorizontal: 14 }, checkingLoginId || !loginId.trim() ? { opacity: 0.5 } : null]}
                    onPress={() => checkAvailability('loginId')}
                    disabled={checkingLoginId || !loginId.trim()}
                  >
                    <Text style={s.secondaryButtonText}>
                      {checkingLoginId ? t('loginChecking') : t('loginCheckId')}
                    </Text>
                  </Pressable>
                  {loginIdCheck ? (
                    <Text style={[s.subtleText, { color: loginIdCheck.available ? '#16A34A' : '#EF4444' }]}>
                      {loginIdCheck.message}
                    </Text>
                  ) : null}
                </>
              ) : null}

              {(mode === 'login' || mode === 'register' || mode === 'resetPassword') ? (
                <>
                  <Text style={s.formTitle}>{t('loginPasswordLabel')}</Text>
                  <TextInput
                    style={s.input}
                    value={password}
                    secureTextEntry
                    placeholder={t('loginPasswordPlaceholder')}
                    onChangeText={setPassword}
                    placeholderTextColor={colors.textMuted}
                  />
                  {(mode === 'register' || mode === 'resetPassword') ? (
                    <>
                      <Text style={s.subtleText}>{t('loginPasswordRule')}</Text>
                      {mode === 'register' && password.length > 0 ? (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 14,
                            marginTop: 8,
                          }}
                        >
                          {registerPasswordChecks.map((item) => (
                            <View
                              key={item.key}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                            >
                              <Ionicons
                                name={item.satisfied ? 'checkmark-circle' : 'ellipse-outline'}
                                size={14}
                                color={item.satisfied ? '#16A34A' : colors.textMuted}
                              />
                              <Text
                                style={[
                                  s.subtleText,
                                  { color: item.satisfied ? '#16A34A' : colors.textMuted },
                                ]}
                              >
                                {item.label}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : null}

              {(mode === 'register' || mode === 'resetPassword') ? (
                <>
                  <Text style={s.formTitle}>{t('loginPasswordConfirmLabel')}</Text>
                  <TextInput
                    style={s.input}
                    value={passwordConfirm}
                    secureTextEntry
                    placeholder={t('loginPasswordConfirmPlaceholder')}
                    onChangeText={setPasswordConfirm}
                    placeholderTextColor={colors.textMuted}
                  />
                  {passwordConfirm.trim() && !passwordConfirmed ? (
                    <Text style={[s.subtleText, { color: '#EF4444' }]}>{t('loginPasswordMismatch')}</Text>
                  ) : null}
                </>
              ) : null}

              {(mode === 'register' || mode === 'findId' || mode === 'resetPassword') ? (
                <>
                  <Text style={s.formTitle}>{t('loginEmailLabel')}</Text>
                  <TextInput
                    style={s.input}
                    value={email}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder={t('loginEmailPlaceholder')}
                    onChangeText={(value) => {
                      setEmail(value);
                      setEmailVerified(false);
                      setEmailVerifiedTarget('');
                      setVerificationExpiresAt(null);
                      setEmailMessage(null);
                    }}
                    placeholderTextColor={colors.textMuted}
                  />
                  {mode === 'register' && emailMessage ? (
                    <Text style={[s.subtleText, { color: emailMessage.tone === 'success' ? '#16A34A' : '#EF4444' }]}>
                      {emailMessage.text}
                    </Text>
                  ) : null}
                </>
              ) : null}

              {mode === 'register' ? (
                <Pressable
                  style={[s.secondaryButton, { width: '100%', minHeight: 48, justifyContent: 'center', paddingHorizontal: 14 }, sendingCode || !email.trim() ? { opacity: 0.5 } : null]}
                  onPress={sendVerificationCode}
                  disabled={sendingCode || !email.trim()}
                >
                  <Text style={s.secondaryButtonText}>
                    {sendingCode ? t('loginChecking') : t('loginSendVerificationCode')}
                  </Text>
                </Pressable>
              ) : null}

              {mode === 'resetPassword' ? (
                <Pressable
                  style={[s.secondaryButton, { width: '100%', minHeight: 48, justifyContent: 'center', paddingHorizontal: 14 }, sendingResetCode || !email.trim() || !loginId.trim() ? { opacity: 0.5 } : null]}
                  onPress={sendResetCode}
                  disabled={sendingResetCode || !email.trim() || !loginId.trim()}
                >
                  <Text style={s.secondaryButtonText}>
                    {sendingResetCode ? t('loginChecking') : t('loginSendResetCode')}
                  </Text>
                </Pressable>
              ) : null}

              {verificationExpiresAt && !emailVerified ? (
                <Text style={[s.subtleText, { color: verificationRemainingSeconds > 0 ? colors.textMuted : '#EF4444' }]}>
                  {verificationRemainingSeconds > 0
                    ? t('loginVerificationExpiresIn', { time: formatCountdown(verificationRemainingSeconds) })
                    : t('loginVerificationExpired')}
                </Text>
              ) : null}

              {(mode === 'register' || mode === 'resetPassword') ? (
                <>
                  <Text style={s.formTitle}>{t('loginVerificationCodeLabel')}</Text>
                  <TextInput
                    style={s.input}
                    value={verificationCode}
                    keyboardType="number-pad"
                    placeholder={t('loginVerificationCodePlaceholder')}
                    onChangeText={setVerificationCode}
                    placeholderTextColor={colors.textMuted}
                  />
                  {mode === 'register' ? (
                    <Pressable
                      style={[s.secondaryButton, { width: '100%', minHeight: 48, justifyContent: 'center', paddingHorizontal: 14 }, verifyingCode || !email.trim() || !verificationCode.trim() ? { opacity: 0.5 } : null]}
                      onPress={verifyVerificationCode}
                      disabled={verifyingCode || !email.trim() || !verificationCode.trim()}
                    >
                      <Text style={s.secondaryButtonText}>
                        {verifyingCode ? t('loginChecking') : t('loginVerifyVerificationCode')}
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}

              {mode === 'register' ? (
                <>
                  <Text style={s.formTitle}>{t('loginNicknameLabel')}</Text>
                  <TextInput
                    style={s.input}
                    value={nickname}
                    placeholder={t('loginNicknamePlaceholder')}
                    onChangeText={(value) => {
                      setNickname(value);
                      setNicknameCheck(null);
                    }}
                    placeholderTextColor={colors.textMuted}
                  />
                  <Pressable
                    style={[s.secondaryButton, { width: '100%', minHeight: 48, justifyContent: 'center', paddingHorizontal: 14 }, checkingNickname || !nickname.trim() ? { opacity: 0.5 } : null]}
                    onPress={() => checkAvailability('nickname')}
                    disabled={checkingNickname || !nickname.trim()}
                  >
                    <Text style={s.secondaryButtonText}>
                      {checkingNickname ? t('loginChecking') : t('loginCheckNickname')}
                    </Text>
                  </Pressable>
                  {nicknameCheck ? (
                    <Text style={[s.subtleText, { color: nicknameCheck.available ? '#16A34A' : '#EF4444' }]}>
                      {nicknameCheck.message}
                    </Text>
                  ) : null}
                </>
              ) : null}

              {mode === 'findId' ? (
                <>
                  <Text style={s.formTitle}>{t('loginEmailLabel')}</Text>
                  <TextInput
                    style={s.input}
                    value={email}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder={t('loginEmailPlaceholder')}
                    onChangeText={setEmail}
                    placeholderTextColor={colors.textMuted}
                  />
                </>
              ) : null}

              <Pressable
                style={[s.primaryButton, submitDisabled ? { opacity: 0.5 } : null]}
                disabled={submitDisabled || authLoading === 'local-login' || authLoading === 'local-register' || findingLoginId || resettingPassword}
                onPress={() => {
                  if (mode === 'login') {
                    onLocalLogin({ loginId, password });
                    return;
                  }
                  if (mode === 'register') {
                    onLocalRegister({ loginId, password, nickname, email });
                    return;
                  }
                  if (mode === 'findId') {
                    void findLoginId();
                    return;
                  }
                  void resetPassword();
                }}
              >
                {authLoading === 'local-login' || authLoading === 'local-register' || findingLoginId || resettingPassword ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.primaryButtonText}>
                    {mode === 'login'
                      ? t('loginLocalAction')
                      : mode === 'register'
                        ? t('loginSignupAction')
                        : mode === 'findId'
                          ? t('loginFindIdAction')
                          : t('loginResetPasswordAction')}
                  </Text>
                )}
              </Pressable>

              {mode === 'login' ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <Pressable onPress={() => setMode('findId')}>
                    <Text style={s.subtleText}>{t('loginFindId')}</Text>
                  </Pressable>
                  <Pressable onPress={() => setMode('resetPassword')}>
                    <Text style={s.subtleText}>{t('loginResetPassword')}</Text>
                  </Pressable>
                </View>
              ) : null}

              {mode === 'register' ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <Pressable onPress={() => setMode('findId')}>
                    <Text style={s.subtleText}>{t('loginFindId')}</Text>
                  </Pressable>
                  <Pressable onPress={() => setMode('resetPassword')}>
                    <Text style={s.subtleText}>{t('loginResetPassword')}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        {authPanel === 'social' ? (
          <>
            <Pressable
              onPress={() => setAuthPanel('entry')}
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="arrow-back" size={14} color={colors.text} />
              <Text style={[s.subtleText, { color: colors.text }]}>{t('loginEntryBack')}</Text>
            </Pressable>
            <Text style={[s.subtleText, { textAlign: 'center' }]}>{t('loginSocialDescription')}</Text>
            <Pressable style={[s.oauthButtonModern, s.kakaoButton]} onPress={() => onLogin('kakao')}>
              {authLoading === 'kakao' ? (
                <ActivityIndicator color="#111" />
              ) : (
                <View style={s.oauthRow}>
                  <Ionicons name="chatbubbles-outline" size={16} color="#111" />
                  <Text style={s.kakaoText}>{t('loginKakao')}</Text>
                </View>
              )}
            </Pressable>
            <Pressable style={[s.oauthButtonModern, s.googleButton]} onPress={() => onLogin('google')}>
              {authLoading === 'google' ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <View style={s.oauthRow}>
                  <Ionicons name="logo-google" size={16} color={colors.text} />
                  <Text style={[s.googleText, { color: colors.text }]}>{t('loginGoogle')}</Text>
                </View>
              )}
            </Pressable>
            {Platform.OS === 'ios' ? (
              <Pressable style={[s.oauthButtonModern, s.appleButton]} onPress={() => onLogin('apple')}>
                {authLoading === 'apple' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={s.oauthRow}>
                    <Ionicons name="logo-apple" size={16} color="#fff" />
                    <Text style={s.appleText}>{t('loginApple')}</Text>
                  </View>
                )}
              </Pressable>
            ) : null}
          </>
        ) : null}
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
