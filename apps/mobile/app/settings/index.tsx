import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useI18n } from '../../src/contexts/I18nContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { createStyles } from '../../src/styles/createStyles';

type MenuItem = {
  key: 'profile' | 'security' | 'plan' | 'alarm' | 'theme';
  section: 'account' | 'plan' | 'preferences';
  labelKo: string;
  labelEn: string;
  descriptionKo: string;
  descriptionEn: string;
  route: '/settings/profile' | '/settings/security' | '/settings/plan' | '/settings/alarm' | '/settings/theme';
  icon: keyof typeof Ionicons.glyphMap;
};

const SETTINGS_ITEMS: MenuItem[] = [
  {
    key: 'profile',
    section: 'account',
    labelKo: '프로필',
    labelEn: 'Profile',
    descriptionKo: '계정 정보와 워크스페이스 확인',
    descriptionEn: 'View account and workspace',
    route: '/settings/profile',
    icon: 'person-circle-outline',
  },
  {
    key: 'security',
    section: 'account',
    labelKo: '보안',
    labelEn: 'Security',
    descriptionKo: '로그인 기기와 세션 관리',
    descriptionEn: 'Manage devices and sessions',
    route: '/settings/security',
    icon: 'shield-checkmark-outline',
  },
  {
    key: 'plan',
    section: 'plan',
    labelKo: '플랜',
    labelEn: 'Plan',
    descriptionKo: '플랜, 사용량, 결제 정보 관리',
    descriptionEn: 'Manage plan, usage, and billing',
    route: '/settings/plan',
    icon: 'card-outline',
  },
  {
    key: 'alarm',
    section: 'preferences',
    labelKo: '알람',
    labelEn: 'Alarm',
    descriptionKo: '알림/마케팅 동의 설정',
    descriptionEn: 'Notification and marketing settings',
    route: '/settings/alarm',
    icon: 'notifications-outline',
  },
  {
    key: 'theme',
    section: 'preferences',
    labelKo: '테마',
    labelEn: 'Theme',
    descriptionKo: '시스템설정/라이트/블랙 선택',
    descriptionEn: 'Choose system, light, or black',
    route: '/settings/theme',
    icon: 'color-palette-outline',
  },
];
const SHOW_PLAN_SETTINGS = false;

export default function SettingsHomePage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const { locale } = useI18n();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const isKo = locale === 'ko';
  const returnTo = typeof params.from === 'string' && params.from ? params.from : '/(tabs)/overview';
  const groupedItems = {
    account: SETTINGS_ITEMS.filter((item) => item.section === 'account'),
    plan: SHOW_PLAN_SETTINGS ? SETTINGS_ITEMS.filter((item) => item.section === 'plan') : [],
    preferences: SETTINGS_ITEMS.filter((item) => item.section === 'preferences'),
  } as const;
  const visibleSections = (['account', 'plan', 'preferences'] as const).filter(
    (section) => groupedItems[section].length > 0,
  );

  const sectionTitle = (section: keyof typeof groupedItems) => {
    if (section === 'account') return isKo ? '계정' : 'Account';
    if (section === 'plan') return isKo ? '플랜' : 'Plan';
    return isKo ? '환경설정' : 'Preferences';
  };

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

        {visibleSections.map((section) => (
          <View key={section} style={{ gap: 8 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', paddingHorizontal: 4 }}>
              {sectionTitle(section)}
            </Text>
            <View style={[s.panel, { paddingHorizontal: 0, overflow: 'hidden', borderRadius: 13 }]}>
              {groupedItems[section].map((item, index) => (
                <Pressable
                  key={item.key}
                  onPress={() => router.push({ pathname: item.route, params: { from: returnTo } })}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    borderBottomWidth: index < groupedItems[section].length - 1 ? 1 : 0,
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
        ))}
      </View>
    </ScrollView>
  );
}
