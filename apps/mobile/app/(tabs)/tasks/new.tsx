import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useMobileApp } from '../../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../../src/contexts/ThemeContext';
import { createStyles } from '../../../src/styles/createStyles';
import { FullPageWebView } from '../../../src/components/common/FullPageWebView';

const ALARM_ENABLED_KEY = 'mobile_settings_alarm_enabled';

export default function TaskCreatePage() {
  const params = useLocalSearchParams<{ date?: string }>();
  const { auth, data } = useMobileApp();
  const { colors, mode } = useThemeMode();
  const s = createStyles(colors);
  const router = useRouter();
  const selectedWorkspace = data.selectedWorkspace;
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const initialDate =
    typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : undefined;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const alarmRaw = await AsyncStorage.getItem(ALARM_ENABLED_KEY);
        if (!mounted) return;
        if (alarmRaw === '0' || alarmRaw === '1') {
          setAlarmEnabled(alarmRaw === '1');
        }
      } finally {
        if (mounted) setPrefsLoaded(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (!auth.session) return <Redirect href="/(auth)/login" />;
  if (!selectedWorkspace) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>워크스페이스를 선택하세요.</Text>
      </View>
    );
  }
  if (!prefsLoaded) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>설정 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <FullPageWebView
      path="/mobile/tasks/new"
      query={{
        mode: 'create',
        token: auth.session.accessToken,
        workspace_id: selectedWorkspace.workspace_id,
        owner_type: selectedWorkspace.type,
        owner_id: selectedWorkspace.owner_id,
        theme: mode === 'black' ? 'dark' : 'light',
        initial_date: initialDate,
        alarm_enabled: alarmEnabled ? 1 : 0,
      }}
      onMessage={(message) => {
        if (message.type !== 'task_saved' && message.type !== 'task_created') return;
        const payload = (message.payload ?? {}) as { taskId?: number; task_id?: number; id?: number };
        const createdTaskId = Number(payload.taskId ?? payload.task_id ?? payload.id ?? 0);
        if (!Number.isFinite(createdTaskId) || createdTaskId <= 0) return;
        data.setActiveScheduleId(createdTaskId);
        void data.loadDashboard(selectedWorkspace);
        router.replace(`/tasks/${createdTaskId}`);
      }}
    />
  );
}
