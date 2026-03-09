import {
  ApiError,
  createRequestCoordinator,
  isRetryableStatus,
  mapStatusToApiCode,
  toApiError,
  type ApiErrorSource,
} from '@repo/api-client';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import type { AuthSession } from './types';
export { ApiError } from '@repo/api-client';

const envApiBaseUrl =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.EXPO_PUBLIC_API_BASE_URL;
const API_BASE_URL = envApiBaseUrl || 'https://pecal.site';

export function getApiBaseUrl() {
  return API_BASE_URL;
}

type ApiAuthHandlers = {
  getSession: () => AuthSession | null;
  refreshSession: (session: AuthSession) => Promise<AuthSession | null>;
  onAuthFailure: (reason: 'unauthorized' | 'session_conflict' | 'refresh_expired') => void;
};

let authHandlers: ApiAuthHandlers | null = null;
const coordinator = createRequestCoordinator();
const SOURCE: ApiErrorSource = 'mobile';

function getMobileClientName() {
  const deviceName = Device.deviceName?.trim();
  const modelName = Device.modelName?.trim();
  const modelId = Device.modelId?.trim();

  const invalidTokens = new Set(['arm64', 'x64', 'x86_64', 'simulator', 'unknown']);
  const isInvalidName = (value?: string | null) => {
    if (!value) return true;
    return invalidTokens.has(value.trim().toLowerCase());
  };

  // iOS modelName is often just "iPhone", which is too generic for session management.
  if (Platform.OS === 'ios') {
    if (!isInvalidName(deviceName)) return deviceName!;
    if (!isInvalidName(modelId)) return modelId!;
    if (!isInvalidName(modelName)) return modelName!;
  }

  const explicitModel = !isInvalidName(deviceName)
    ? deviceName
    : !isInvalidName(modelName)
      ? modelName
      : !isInvalidName(modelId)
        ? modelId
        : null;
  if (explicitModel) return explicitModel;
  return Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Android' : 'Mobile';
}

export function getMobileClientHeaders() {
  return {
    'X-Client-Platform': Platform.OS === 'ios' ? 'ios' : Platform.OS,
    'X-Client-Name': getMobileClientName(),
    'X-App-Version': Constants.expoConfig?.version || Constants.nativeAppVersion || 'unknown',
  };
}

export function setApiAuthHandlers(handlers: ApiAuthHandlers | null) {
  authHandlers = handlers;
}

async function requestJson(
  path: string,
  session: AuthSession | null,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getMobileClientHeaders(),
    ...(options.headers as Record<string, string> | undefined),
  };

  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  }

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    const text = await res.text();
    let data: unknown = {};
    if (text) {
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        data = { message: text };
      }
    }
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    const normalized = toApiError(error, SOURCE);
    throw new ApiError({
      message: '네트워크 연결을 확인해 주세요.',
      status: 0,
      code: normalized.code,
      retryable: true,
      source: SOURCE,
      details: error,
    });
  }
}

export async function apiFetch<T>(path: string, session: AuthSession | null, options: RequestInit = {}): Promise<T> {
  // Prefer the latest in-memory session over a possibly stale caller snapshot.
  const activeSession = authHandlers?.getSession() ?? session ?? null;
  const first = await requestJson(path, activeSession, options);

  if (first.ok) return first.data as T;

  const firstMessage =
    (first.data as { error?: string; message?: string })?.error ||
    (first.data as { error?: string; message?: string })?.message ||
    `Request failed: ${first.status}`;

  // 401 자동 재발급 + 1회 재시도
  if (first.status === 401 && activeSession && authHandlers) {
    const refreshBaseSession = authHandlers.getSession() ?? activeSession;
    const refreshed = await authHandlers.refreshSession(refreshBaseSession);
    if (refreshed?.accessToken) {
      const retried = await requestJson(path, refreshed, options);
      if (retried.ok) return retried.data as T;

      if (retried.status === 401) {
        authHandlers.onAuthFailure('session_conflict');
        throw new ApiError({
          message: '다른 기기에서 로그인되어 세션이 만료되었습니다. 다시 로그인해 주세요.',
          status: 401,
          code: 'SESSION_CONFLICT',
          retryable: false,
          source: SOURCE,
          details: retried.data,
        });
      }

      const retryMessage =
        (retried.data as { error?: string; message?: string })?.error ||
        (retried.data as { error?: string; message?: string })?.message ||
        `Request failed: ${retried.status}`;
      throw new ApiError({
        message: retryMessage,
        status: retried.status,
        code: mapStatusToApiCode(retried.status),
        retryable: isRetryableStatus(retried.status),
        source: SOURCE,
        details: retried.data,
      });
    }

    authHandlers.onAuthFailure('refresh_expired');
    throw new ApiError({
      message: '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.',
      status: 401,
      code: 'REFRESH_EXPIRED',
      retryable: false,
      source: SOURCE,
      details: first.data,
    });
  }

  if (first.status === 401 && authHandlers) {
    authHandlers.onAuthFailure('unauthorized');
  }

  throw new ApiError({
    message: firstMessage,
    status: first.status,
    code: mapStatusToApiCode(first.status),
    retryable: isRetryableStatus(first.status),
    source: SOURCE,
    details: first.data,
  });
}

export async function cachedApiFetch<T>(
  cacheKey: string,
  path: string,
  session: AuthSession | null,
  options: RequestInit = {},
  opts?: { cacheMs?: number; dedupe?: boolean; retries?: number }
): Promise<T> {
  return coordinator.run(
    cacheKey,
    () => apiFetch<T>(path, session, options),
    {
      cacheMs: opts?.cacheMs ?? 0,
      dedupe: opts?.dedupe ?? true,
      retries: opts?.retries ?? 1,
    }
  );
}

export function invalidateApiCache(prefix?: string) {
  coordinator.invalidate(prefix);
}
