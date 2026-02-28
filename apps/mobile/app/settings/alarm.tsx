import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useI18n } from '../../src/contexts/I18nContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { createStyles } from '../../src/styles/createStyles';

const ALARM_ENABLED_KEY = 'mobile_settings_alarm_enabled';
const MARKETING_CONSENT_KEY = 'mobile_settings_marketing_consent';

export default function SettingsAlarmPage() {
  const router = useRouter();
  const { locale } = useI18n();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const isKo = locale === 'ko';
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [marketingConsent, setMarketingConsent] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [alarmRaw, marketingRaw] = await Promise.all([
        AsyncStorage.getItem(ALARM_ENABLED_KEY),
        AsyncStorage.getItem(MARKETING_CONSENT_KEY),
      ]);
      if (!mounted) return;
      if (alarmRaw === '0' || alarmRaw === '1') setAlarmEnabled(alarmRaw === '1');
      if (marketingRaw === '0' || marketingRaw === '1') setMarketingConsent(marketingRaw === '1');
    })().catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const setAlarm = async (next: boolean) => {
    setAlarmEnabled(next);
    await AsyncStorage.setItem(ALARM_ENABLED_KEY, next ? '1' : '0');
  };

  const setMarketing = async (next: boolean) => {
    setMarketingConsent(next);
    await AsyncStorage.setItem(MARKETING_CONSENT_KEY, next ? '1' : '0');
  };

  const rowBase = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 14,
    paddingVertical: 13,
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
            {isKo ? '알람' : 'Alarm'}
          </Text>
          <View style={{ width: 58 }} />
        </View>

        <Text style={{ color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 }}>
          {isKo ? '알람' : 'Alarm'}
        </Text>

        <View style={[s.panel, { borderRadius: 13, gap: 0, paddingHorizontal: 0, overflow: 'hidden' }]}>
          <View style={[rowBase, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[s.itemTitle, { fontSize: 16, fontWeight: '600' }]}>
                {isKo ? '알림 받기' : 'Allow Notifications'}
              </Text>
              <Text style={s.itemMeta}>
                {isKo ? '일정 알림을 수신합니다.' : 'Receive reminder notifications.'}
              </Text>
            </View>
            <Switch
              value={alarmEnabled}
              onValueChange={(next) => {
                void setAlarm(next);
              }}
              trackColor={{ false: '#D1D5DB', true: colors.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#D1D5DB"
            />
          </View>

          <View style={rowBase}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[s.itemTitle, { fontSize: 16, fontWeight: '600' }]}>
                {isKo ? '마케팅 정보 수신 동의' : 'Marketing Consent'}
              </Text>
              <Text style={s.itemMeta}>
                {isKo ? '이벤트/혜택 알림을 수신합니다.' : 'Receive event and promotion updates.'}
              </Text>
            </View>
            <Switch
              value={marketingConsent}
              onValueChange={(next) => {
                void setMarketing(next);
              }}
              trackColor={{ false: '#D1D5DB', true: colors.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#D1D5DB"
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
