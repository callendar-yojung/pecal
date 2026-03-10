import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Platform } from 'react-native';
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

const EMAIL_VERIFICATION_TTL_SECONDS = 3 * 60;

function isValidRegisterPassword(password: string) {
  return password.length >= 8 && /[^A-Za-z0-9]/.test(password);
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

  const checkAvailability = async (field: 'loginId' | 'nickname') => {
    try {
      setLocalError(null);
      setLocalStatus(null);
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
      setLocalStatus(t('loginVerificationCodeSent'));
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : t('loginVerificationFailed'));
    } finally {
      setSendingCode(false);
    }
  };

  const verifyVerificationCode = async () => {
    try {
      setLocalError(null);
      setLocalStatus(null);
      setVerifyingCode(true);
      if (verificationRemainingSeconds <= 0) {
        setLocalError(t('loginVerificationExpired'));
        return;
      }
      const normalizedEmail = email.trim().toLowerCase();
      await onVerifyRegisterVerificationCode(normalizedEmail, verificationCode.trim());
      setEmailVerified(true);
      setEmailVerifiedTarget(normalizedEmail);
      setLocalStatus(t('loginVerificationVerified'));
    } catch (e) {
      setEmailVerified(false);
      setEmailVerifiedTarget('');
      setLocalError(e instanceof Error ? e.message : t('loginVerificationFailed'));
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
    <SafeAreaView style={s.centerScreen}>
      <View style={s.loginBackdrop}>
        <View style={[s.loginOrb, s.loginOrbPrimary]} />
        <View style={[s.loginOrb, s.loginOrbSoft]} />
      </View>
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

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            ['login', t('loginLocal')],
            ['register', t('loginSignup')],
            ['findId', t('loginFindId')],
            ['resetPassword', t('loginResetPassword')],
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
                style={[s.secondaryButtonHalf, checkingLoginId || !loginId.trim() ? { opacity: 0.5 } : null]}
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
          <Text style={s.formTitle}>{t('loginPasswordLabel')}</Text>
          {mode === 'login' || mode === 'register' || mode === 'resetPassword' ? (
            <>
              <TextInput
                style={s.input}
                value={password}
                secureTextEntry
                placeholder={t('loginPasswordPlaceholder')}
                onChangeText={setPassword}
                placeholderTextColor={colors.textMuted}
              />
              {(mode === 'register' || mode === 'resetPassword') ? <Text style={s.subtleText}>{t('loginPasswordRule')}</Text> : null}
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
                <Text style={[s.subtleText, { color: '#EF4444' }]}>
                  {t('loginPasswordMismatch')}
                </Text>
              ) : null}
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
                }}
                placeholderTextColor={colors.textMuted}
              />
              {mode === 'register' ? (
                <Pressable
                  style={[s.secondaryButtonHalf, sendingCode || !email.trim() ? { opacity: 0.5 } : null]}
                  onPress={sendVerificationCode}
                  disabled={sendingCode || !email.trim()}
                >
                  <Text style={s.secondaryButtonText}>
                    {sendingCode ? t('loginChecking') : t('loginSendVerificationCode')}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[s.secondaryButtonHalf, sendingResetCode || !email.trim() || !loginId.trim() ? { opacity: 0.5 } : null]}
                  onPress={sendResetCode}
                  disabled={sendingResetCode || !email.trim() || !loginId.trim()}
                >
                  <Text style={s.secondaryButtonText}>
                    {sendingResetCode ? t('loginChecking') : t('loginSendResetCode')}
                  </Text>
                </Pressable>
              )}
              {verificationExpiresAt && !emailVerified ? (
                <Text
                  style={[
                    s.subtleText,
                    { color: verificationRemainingSeconds > 0 ? colors.textMuted : '#EF4444' },
                  ]}
                >
                  {verificationRemainingSeconds > 0
                    ? t('loginVerificationExpiresIn', {
                        time: formatCountdown(verificationRemainingSeconds),
                      })
                    : t('loginVerificationExpired')}
                </Text>
              ) : null}
              <Text style={s.formTitle}>{t('loginVerificationCodeLabel')}</Text>
              <TextInput
                style={s.input}
                value={verificationCode}
                keyboardType="number-pad"
                placeholder={t('loginVerificationCodePlaceholder')}
                onChangeText={setVerificationCode}
                placeholderTextColor={colors.textMuted}
              />
              <Pressable
                style={[
                  s.secondaryButtonHalf,
                  verifyingCode || !email.trim() || !verificationCode.trim() ? { opacity: 0.5 } : null,
                ]}
                onPress={verifyVerificationCode}
                disabled={verifyingCode || !email.trim() || !verificationCode.trim()}
              >
                <Text style={s.secondaryButtonText}>
                  {verifyingCode ? t('loginChecking') : t('loginVerifyVerificationCode')}
                </Text>
              </Pressable>
              {mode === 'register' && emailVerified && emailVerifiedTarget === email.trim().toLowerCase() ? (
                <Text style={[s.subtleText, { color: '#16A34A' }]}>
                  {t('loginVerificationVerified')}
                </Text>
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
                style={[s.secondaryButtonHalf, checkingNickname || !nickname.trim() ? { opacity: 0.5 } : null]}
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
            disabled={
              submitDisabled ||
              authLoading === 'local-login' ||
              authLoading === 'local-register' ||
              findingLoginId ||
              resettingPassword
            }
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
        </View>

        <Text style={[s.subtleText, { textAlign: 'center' }]}>{t('loginDivider')}</Text>

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
      </View>
    </SafeAreaView>
  );
}
