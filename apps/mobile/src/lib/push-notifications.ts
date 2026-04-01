import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiFetch } from './api';
import { ALARM_ENABLED_KEY } from './settings-storage';
import type { AuthSession } from './types';

type ExpoNotificationsModule = typeof import('expo-notifications');

let notificationsModulePromise: Promise<ExpoNotificationsModule | null> | null = null;
let notificationHandlerConfigured = false;
const PUSH_TOKEN_STORAGE_KEY = 'mobile_push_token';

async function loadNotificationsModule(): Promise<ExpoNotificationsModule | null> {
  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications')
      .then((mod) => mod)
      .catch((error) => {
        console.warn('[mobile] expo-notifications native module unavailable:', error);
        return null;
      });
  }
  return notificationsModulePromise;
}

async function ensureNotificationHandler() {
  if (notificationHandlerConfigured) return;
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '기본 알림',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
      sound: 'default',
      enableVibrate: true,
      showBadge: false,
    });
  }
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  notificationHandlerConfigured = true;
}

function getExpoProjectId() {
  const fromExpoConfig =
    (Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | null)?.extra?.eas?.projectId;
  const fromEasConfig = (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  return fromExpoConfig ?? fromEasConfig ?? undefined;
}

async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return null;
  await ensureNotificationHandler();

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return null;

  const projectId = getExpoProjectId();
  const tokenResponse = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();
  return tokenResponse.data ?? null;
}

async function getStoredPushToken() {
  const token = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  if (!token) return null;
  const normalized = token.trim();
  return normalized.length > 0 ? normalized : null;
}

async function setStoredPushToken(token: string | null) {
  if (!token) {
    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
}

async function isAlarmEnabled() {
  const value = await AsyncStorage.getItem(ALARM_ENABLED_KEY);
  if (value === '0') return false;
  return true;
}

export async function registerDevicePushToken(session: AuthSession): Promise<string | null> {
  const token = await getExpoPushToken();
  if (!token) return null;

  const appBuild = String(
    (Constants.expoConfig as { version?: string } | null)?.version ??
      (Constants as { manifest2?: { runtimeVersion?: string } }).manifest2?.runtimeVersion ??
      ''
  );
  const platformVersion = String(Platform.Version ?? '');
  const deviceName =
    (Constants as { deviceName?: string }).deviceName ??
    (Constants.expoConfig as { name?: string } | null)?.name ??
    'mobile';
  const deviceId = `${Platform.OS}-${platformVersion}-${deviceName}`.slice(0, 180);
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';

  await apiFetch<{ success: boolean }>(
    '/api/me/push-tokens',
    session,
    {
      method: 'POST',
      body: JSON.stringify({
        token,
        platform,
        device_id: deviceId,
        app_build: appBuild || null,
      }),
    }
  );

  await setStoredPushToken(token);
  return token;
}

export async function unregisterDevicePushToken(session: AuthSession): Promise<void> {
  const token = await getStoredPushToken();
  if (!token) return;

  await apiFetch<{ success: boolean }>(
    '/api/me/push-tokens',
    session,
    {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    }
  );
  await setStoredPushToken(null);
}

export async function syncDevicePushToken(session: AuthSession): Promise<void> {
  const enabled = await isAlarmEnabled();
  if (!enabled) {
    await unregisterDevicePushToken(session);
    return;
  }
  await registerDevicePushToken(session);
}
