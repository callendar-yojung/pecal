import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../contexts/I18nContext';
import { useThemeMode } from '../contexts/ThemeContext';
import { createStyles } from '../styles/createStyles';
import type { OAuthProvider } from '../lib/types';

type Props = {
  error: string | null;
  authLoading: OAuthProvider | null;
  onLogin: (provider: OAuthProvider) => void;
};

export function LoginScreen({ error, authLoading, onLogin }: Props) {
  const { t } = useI18n();
  const { colors } = useThemeMode();
  const s = createStyles(colors);

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

        {error ? <Text style={s.errorText}>{error}</Text> : null}

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
