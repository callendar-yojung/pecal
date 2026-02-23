import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthSession } from './types';

const STORAGE_KEY = 'pecal_mobile_auth';
type SecureStoreModule = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

let secureStoreCache: Promise<SecureStoreModule | null> | null = null;

function isSecureStoreModule(value: unknown): value is SecureStoreModule {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SecureStoreModule>;
  return (
    typeof candidate.getItemAsync === 'function' &&
    typeof candidate.setItemAsync === 'function' &&
    typeof candidate.deleteItemAsync === 'function'
  );
}

async function getSecureStore(): Promise<SecureStoreModule | null> {
  if (secureStoreCache) return secureStoreCache;

  secureStoreCache = (async () => {
    try {
      // Keep runtime-optional: fallback to AsyncStorage when module is unavailable.
      const dynamicRequire = new Function('name', 'return require(name)') as (name: string) => unknown;
      const mod = dynamicRequire('expo-secure-store') as { default?: unknown } | unknown;
      const resolved = (mod && typeof mod === 'object' && 'default' in mod ? mod.default : mod) ?? null;
      return isSecureStoreModule(resolved) ? resolved : null;
    } catch {
      return null;
    }
  })();

  return secureStoreCache;
}

export async function loadSession(): Promise<AuthSession | null> {
  const secureStore = await getSecureStore();

  if (secureStore) {
    const raw = await secureStore.getItemAsync(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AuthSession;
  }

  // Backward compatibility + one-time migration from old plain storage.
  const legacyRaw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!legacyRaw) return null;

  const session = JSON.parse(legacyRaw) as AuthSession;
  if (secureStore) {
    await secureStore.setItemAsync(STORAGE_KEY, legacyRaw);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
  return session;
}

export async function saveSession(session: AuthSession) {
  const raw = JSON.stringify(session);
  const secureStore = await getSecureStore();
  if (secureStore) {
    await secureStore.setItemAsync(STORAGE_KEY, raw);
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, raw);
}

export async function clearSession() {
  const secureStore = await getSecureStore();
  if (secureStore) {
    await secureStore.deleteItemAsync(STORAGE_KEY);
  }
  await AsyncStorage.removeItem(STORAGE_KEY);
}
