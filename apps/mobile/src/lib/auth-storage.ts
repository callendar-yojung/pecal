import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthSession } from './types';

const STORAGE_KEY = 'pecal_mobile_auth';

export async function loadSession(): Promise<AuthSession | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as AuthSession;
}

export async function saveSession(session: AuthSession) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export async function clearSession() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
