import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useI18n } from '../../src/contexts/I18nContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { createStyles } from '../../src/styles/createStyles';

export default function SettingsThemePage() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const { colors, mode, resolvedMode, setMode } = useThemeMode();
  const s = createStyles(colors);
  const isKo = locale === 'ko';

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
            {isKo ? '테마' : 'Theme'}
          </Text>
          <View style={{ width: 58 }} />
        </View>

        <Text style={{ color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 }}>
          {isKo ? '테마' : 'Theme'}
        </Text>

        <View style={[s.panel, { borderRadius: 13 }]}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              style={[s.secondaryButtonHalf, mode === 'system' ? { borderColor: colors.primary, borderWidth: 1.5 } : null]}
              onPress={() => setMode('system')}
            >
              <Text style={s.secondaryButtonText}>{t('themeSystem')}</Text>
            </Pressable>
            <Pressable
              style={[s.secondaryButtonHalf, mode === 'light' ? { borderColor: colors.primary, borderWidth: 1.5 } : null]}
              onPress={() => setMode('light')}
            >
              <Text style={s.secondaryButtonText}>{t('themeLight')}</Text>
            </Pressable>
            <Pressable
              style={[s.secondaryButtonHalf, mode === 'black' ? { borderColor: colors.primary, borderWidth: 1.5 } : null]}
              onPress={() => setMode('black')}
            >
              <Text style={s.secondaryButtonText}>{t('themeBlack')}</Text>
            </Pressable>
          </View>
          <Text style={s.itemMeta}>
            {isKo ? '테마 설정' : 'Theme setting'}: {mode === 'system' ? t('themeSystem') : mode === 'light' ? t('themeLight') : t('themeBlack')}
          </Text>
          <Text style={s.itemMeta}>
            {isKo ? '현재 적용' : 'Currently applied'}: {resolvedMode === 'light' ? t('themeLight') : t('themeBlack')}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
