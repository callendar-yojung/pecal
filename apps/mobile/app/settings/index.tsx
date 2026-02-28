import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useI18n } from '../../src/contexts/I18nContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { createStyles } from '../../src/styles/createStyles';

type MenuItem = {
  key: 'profile' | 'alarm' | 'theme';
  labelKo: string;
  labelEn: string;
  descriptionKo: string;
  descriptionEn: string;
  route: '/settings/profile' | '/settings/alarm' | '/settings/theme';
  icon: keyof typeof Ionicons.glyphMap;
};

const SETTINGS_ITEMS: MenuItem[] = [
  {
    key: 'profile',
    labelKo: '프로필',
    labelEn: 'Profile',
    descriptionKo: '계정 정보와 워크스페이스 확인',
    descriptionEn: 'View account and workspace',
    route: '/settings/profile',
    icon: 'person-circle-outline',
  },
  {
    key: 'alarm',
    labelKo: '알람',
    labelEn: 'Alarm',
    descriptionKo: '알림 사용 여부와 기본 시간',
    descriptionEn: 'Notification settings',
    route: '/settings/alarm',
    icon: 'notifications-outline',
  },
  {
    key: 'theme',
    labelKo: '테마',
    labelEn: 'Theme',
    descriptionKo: '라이트/블랙 테마 선택',
    descriptionEn: 'Choose light or black theme',
    route: '/settings/theme',
    icon: 'color-palette-outline',
  },
];

export default function SettingsHomePage() {
  const router = useRouter();
  const { locale } = useI18n();
  const { colors } = useThemeMode();
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
              {isKo ? '뒤로' : 'Back'}
            </Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
            {isKo ? '설정' : 'Settings'}
          </Text>
          <View style={{ width: 58 }} />
        </View>

        <Text
          style={{
            color: colors.text,
            fontSize: 34,
            fontWeight: '800',
            letterSpacing: -0.7,
            marginTop: 2,
            marginBottom: 4,
          }}
        >
          {isKo ? '설정' : 'Settings'}
        </Text>

        <View style={[s.panel, { paddingHorizontal: 0, overflow: 'hidden', borderRadius: 13 }]}>
          {SETTINGS_ITEMS.map((item, index) => (
            <Pressable
              key={item.key}
              onPress={() => router.push(item.route)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 13,
                borderBottomWidth: index < SETTINGS_ITEMS.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
                backgroundColor: pressed ? `${colors.primary}10` : colors.card,
              })}
            >
              <Ionicons name={item.icon} size={20} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[s.itemTitle, { fontSize: 17, fontWeight: '500' }]}>
                  {isKo ? item.labelKo : item.labelEn}
                </Text>
                <Text style={s.itemMeta}>
                  {isKo ? item.descriptionKo : item.descriptionEn}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
