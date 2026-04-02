import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useI18n } from '../../src/contexts/I18nContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { createStyles } from '../../src/styles/createStyles';

export default function SettingsPlanPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const { locale } = useI18n();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const isKo = locale === 'ko';
  const returnTo = typeof params.from === 'string' && params.from ? params.from : '/(tabs)/overview';

  return (
    <ScrollView style={s.content} contentContainerStyle={s.contentContainer}>
      <View style={s.section}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
          <Pressable
            onPress={() => router.replace(returnTo as never)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingRight: 6 }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>
              {isKo ? '설정' : 'Settings'}
            </Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
            {isKo ? '플랜' : 'Plan'}
          </Text>
          <View style={{ width: 58 }} />
        </View>

        <Text style={{ color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 }}>
          {isKo ? '플랜' : 'Plan'}
        </Text>

        <View style={[s.panel, { borderRadius: 13, gap: 8 }]}>
          <Text style={s.formTitle}>{isKo ? '준비 중' : 'Coming Soon'}</Text>
          <Text style={s.itemMeta}>
            {isKo
              ? '모바일 앱에서는 플랜/결제 기능을 현재 제공하지 않습니다.'
              : 'Plan and billing features are currently unavailable in the mobile app.'}
          </Text>
          <Pressable
            onPress={() => router.replace(returnTo as never)}
            style={[s.primaryButtonHalf, { width: '100%' }]}
          >
            <Text style={s.primaryButtonText}>{isKo ? '설정으로 돌아가기' : 'Back to Settings'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
