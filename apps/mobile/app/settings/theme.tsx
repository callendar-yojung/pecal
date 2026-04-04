import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useI18n } from '../../src/contexts/I18nContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { createStyles } from '../../src/styles/createStyles';

export default function SettingsThemePage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const { locale, t } = useI18n();
  const { colors, mode, resolvedMode, themes, setMode } = useThemeMode();
  const s = createStyles(colors);
  const isKo = locale === 'ko';
  const returnTo = typeof params.from === 'string' && params.from ? params.from : '/(tabs)/overview';
  const [menuOpen, setMenuOpen] = useState(false);
  const selectedLabel =
    mode === 'system'
      ? t('themeSystem')
      : (themes.find((theme) => theme.key === mode)?.label[isKo ? 'ko' : 'en'] ?? mode);
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(returnTo as never);
  };

  return (
    <ScrollView style={s.content} contentContainerStyle={s.contentContainer}>
      <View style={s.section}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
          <Pressable
            onPress={handleBack}
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

        <View style={[s.panel, { borderRadius: 13, gap: 10 }]}>
          <Pressable
            onPress={() => setMenuOpen((prev) => !prev)}
            style={[
              s.input,
              {
                minHeight: 48,
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              },
            ]}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
              {selectedLabel}
            </Text>
            <Ionicons
              name={menuOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </Pressable>

          {menuOpen ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                overflow: 'hidden',
                backgroundColor: colors.card,
              }}
            >
              <Pressable
                onPress={() => {
                  setMode('system');
                  setMenuOpen(false);
                }}
                style={({ pressed }) => ({
                  minHeight: 46,
                  paddingHorizontal: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: pressed || mode === 'system' ? `${colors.primary}12` : colors.card,
                })}
              >
                <Text style={{ color: mode === 'system' ? colors.primary : colors.text, fontSize: 15, fontWeight: mode === 'system' ? '800' : '700' }}>
                  {t('themeSystem')}
                </Text>
                {mode === 'system' ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
              </Pressable>
              {themes.map((theme, index) => (
                <Pressable
                  key={theme.key}
                  onPress={() => {
                    setMode(theme.key);
                    setMenuOpen(false);
                  }}
                  style={({ pressed }) => ({
                    minHeight: 46,
                    paddingHorizontal: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTopWidth: index === 0 ? 1 : 1,
                    borderTopColor: colors.border,
                    backgroundColor: pressed || mode === theme.key ? `${colors.primary}12` : colors.card,
                  })}
                >
                  <Text style={{ color: mode === theme.key ? colors.primary : colors.text, fontSize: 15, fontWeight: mode === theme.key ? '800' : '700' }}>
                    {isKo ? theme.label.ko : theme.label.en}
                  </Text>
                  {mode === theme.key ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={{ gap: 4 }}>
            <Text style={s.itemMeta}>
              {isKo ? '테마 설정' : 'Theme setting'}: {selectedLabel}
            </Text>
            <Text style={s.itemMeta}>
              {isKo ? '현재 적용' : 'Currently applied'}: {themes.find((theme) => theme.key === resolvedMode)?.label[isKo ? 'ko' : 'en'] ?? resolvedMode}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
