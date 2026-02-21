import React from 'react';
import {
  View, Text, Pressable, StyleSheet, Image, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useApp, genId } from '@/lib/app-context';
import type { User } from '@/lib/types';

export default function LoginScreen() {
  const { dispatch } = useApp();

  const handleLogin = (provider: 'kakao' | 'google' | 'guest') => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const mockUsers: Record<string, User> = {
      kakao: {
        id: genId('user'),
        name: '카카오 사용자',
        email: 'kakao@example.com',
        provider: 'kakao',
        avatar: undefined,
      },
      google: {
        id: genId('user'),
        name: 'Google 사용자',
        email: 'google@example.com',
        provider: 'google',
        avatar: undefined,
      },
      guest: {
        id: genId('user'),
        name: '게스트',
        email: 'guest@example.com',
        provider: 'guest',
        avatar: undefined,
      },
    };

    dispatch({ type: 'LOGIN', payload: mockUsers[provider] });
    router.replace('/(tabs)');
  };

  return (
    <LinearGradient
      colors={['#3730A3', '#5B6CF6', '#7C3AED']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Logo & Title */}
      <View style={styles.hero}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.appName}>Pecal</Text>
        <Text style={styles.tagline}>일정·메모·파일을 한 곳에서</Text>
        <Text style={styles.subTagline}>개인과 팀을 위한 스마트 워크스페이스</Text>
      </View>

      {/* Login Buttons */}
      <View style={styles.buttonsContainer}>
        {/* Kakao */}
        <Pressable
          style={({ pressed }) => [styles.kakaoButton, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          onPress={() => handleLogin('kakao')}
        >
          <View style={styles.buttonInner}>
            <Text style={styles.kakaoIcon}>💬</Text>
            <Text style={styles.kakaoText}>카카오로 로그인</Text>
          </View>
        </Pressable>

        {/* Google */}
        <Pressable
          style={({ pressed }) => [styles.googleButton, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          onPress={() => handleLogin('google')}
        >
          <View style={styles.buttonInner}>
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleText}>Google로 로그인</Text>
          </View>
        </Pressable>

        {/* Guest */}
        <Pressable
          style={({ pressed }) => [styles.guestButton, pressed && { opacity: 0.7 }]}
          onPress={() => handleLogin('guest')}
        >
          <Text style={styles.guestText}>게스트로 시작하기</Text>
        </Pressable>
      </View>

      <Text style={styles.footer}>로그인 시 서비스 이용약관에 동의하게 됩니다</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 100,
    paddingBottom: 50,
    paddingHorizontal: 32,
  },
  hero: {
    alignItems: 'center',
    gap: 8,
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  logo: {
    width: 96,
    height: 96,
  },
  appName: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  subTagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  kakaoButton: {
    backgroundColor: '#FEE500',
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kakaoIcon: {
    fontSize: 20,
  },
  kakaoText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3C1E1E',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4285F4',
  },
  googleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1D2E',
  },
  guestButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  guestText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textDecorationLine: 'underline',
  },
  footer: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
});
