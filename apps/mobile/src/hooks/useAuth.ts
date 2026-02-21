import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, getApiBaseUrl, setApiAuthHandlers } from '../lib/api';
import { clearSession, loadSession, saveSession } from '../lib/auth-storage';
import type { AuthSession, OAuthProvider } from '../lib/types';

WebBrowser.maybeCompleteAuthSession();

function parseAuthCallback(url: string): AuthSession | null {
  const parsed = Linking.parse(url);
  const params = parsed.queryParams ?? {};

  const accessToken = String(params.accessToken ?? '');
  const refreshToken = String(params.refreshToken ?? '');
  const memberId = Number(params.memberId ?? 0);
  const nickname = String(params.nickname ?? 'User');
  const provider = String(params.provider ?? 'kakao') as OAuthProvider;
  const email = params.email ? String(params.email) : undefined;

  if (!accessToken || !refreshToken || !memberId) return null;
  return { accessToken, refreshToken, memberId, nickname, email, provider };
}

function parseAuthCallbackFromQuery(params: Record<string, string | string[] | undefined>): AuthSession | null {
  const raw = (key: string) => params[key];
  const get = (key: string) => {
    const value = raw(key);
    return Array.isArray(value) ? value[0] : value;
  };

  const accessToken = String(get('accessToken') ?? '');
  const refreshToken = String(get('refreshToken') ?? '');
  const memberId = Number(get('memberId') ?? 0);
  const nickname = String(get('nickname') ?? 'User');
  const provider = String(get('provider') ?? 'kakao') as OAuthProvider;
  const email = get('email') ? String(get('email')) : undefined;

  if (!accessToken || !refreshToken || !memberId) return null;
  return { accessToken, refreshToken, memberId, nickname, email, provider };
}

function toFriendlyOAuthError(error: string) {
  const lower = error.toLowerCase();
  if (lower.includes('cancel')) return '로그인이 취소되었습니다.';
  if (lower.includes('state')) return '인증 보안 검증(state)에 실패했습니다. 다시 시도해 주세요.';
  if (lower.includes('network') || lower.includes('failed to fetch')) return '네트워크 연결이 불안정합니다. 연결 후 다시 시도해 주세요.';
  return `로그인에 실패했습니다: ${error}`;
}

export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshPromiseRef = useRef<Promise<AuthSession | null> | null>(null);

  const callbackUrl = useMemo(() => Linking.createURL('auth/callback'), []);

  const persistSession = async (next: AuthSession | null) => {
    if (next) {
      await saveSession(next);
      setSession(next);
      return;
    }
    await clearSession();
    setSession(null);
  };

  const refreshSession = async (baseSession: AuthSession): Promise<AuthSession | null> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const job = (async () => {
      try {
        const base = getApiBaseUrl();
        const res = await fetch(`${base}/api/auth/external/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: baseSession.refreshToken }),
        });

        if (!res.ok) {
          return null;
        }

        const data = (await res.json()) as {
          accessToken?: string;
          refreshToken?: string;
        };

        if (!data.accessToken || !data.refreshToken) {
          return null;
        }

        const next: AuthSession = {
          ...baseSession,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        };
        await persistSession(next);
        return next;
      } catch {
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = job;
    return job;
  };

  const forceLogout = async (reason: 'unauthorized' | 'session_conflict' | 'refresh_expired') => {
    await persistSession(null);
    if (reason === 'session_conflict') {
      setError('다른 기기 로그인으로 현재 세션이 종료되었습니다. 다시 로그인해 주세요.');
      return;
    }
    if (reason === 'refresh_expired') {
      setError('로그인이 만료되었습니다. 다시 로그인해 주세요.');
      return;
    }
    setError('인증이 필요합니다. 다시 로그인해 주세요.');
  };

  const validateSession = async (baseSession: AuthSession) => {
    const base = getApiBaseUrl();
    try {
      const meRes = await fetch(`${base}/api/auth/external/me`, {
        headers: { Authorization: `Bearer ${baseSession.accessToken}` },
      });

      if (meRes.ok) {
        return baseSession;
      }

      if (meRes.status === 401) {
        const refreshed = await refreshSession(baseSession);
        if (!refreshed) {
          await forceLogout('refresh_expired');
          return null;
        }

        const recheck = await fetch(`${base}/api/auth/external/me`, {
          headers: { Authorization: `Bearer ${refreshed.accessToken}` },
        });

        if (recheck.ok) return refreshed;

        if (recheck.status === 401) {
          await forceLogout('session_conflict');
          return null;
        }
      }

      return baseSession;
    } catch {
      // 네트워크 장애 시 기존 세션은 유지하고 이후 API 재시도에 맡김
      return baseSession;
    }
  };

  const restore = async () => {
    try {
      const stored = await loadSession();
      if (stored) {
        const validated = await validateSession(stored);
        if (validated) setSession(validated);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const login = async (provider: OAuthProvider) => {
    try {
      setError(null);
      setAuthLoading(provider);
      const base = getApiBaseUrl();
      const startRes = await fetch(`${base}/api/auth/${provider}/start?callback=${encodeURIComponent(callbackUrl)}`);
      if (!startRes.ok) throw new Error(await startRes.text());

      const { authUrl } = (await startRes.json()) as { authUrl?: string };
      if (!authUrl) throw new Error('authUrl is missing');

      const result = await WebBrowser.openAuthSessionAsync(authUrl, callbackUrl);
      if (result.type === 'cancel') {
        setError('로그인이 취소되었습니다.');
        return;
      }
      if (result.type === 'dismiss') {
        setError('로그인 화면이 닫혔습니다. 다시 시도해 주세요.');
        return;
      }
      if (result.type !== 'success' || !result.url) {
        setError('로그인 결과를 처리하지 못했습니다. 다시 시도해 주세요.');
        return;
      }

      const parsedUrl = Linking.parse(result.url);
      if (parsedUrl.queryParams?.error) {
        setError(toFriendlyOAuthError(String(parsedUrl.queryParams.error)));
        return;
      }

      const parsed = parseAuthCallback(result.url);
      if (!parsed) throw new Error('Invalid callback payload');

      await persistSession(parsed);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else if (e instanceof Error) {
        setError(toFriendlyOAuthError(e.message));
      } else {
        setError('로그인 중 알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setAuthLoading(null);
    }
  };

  const logout = async () => {
    await persistSession(null);
  };

  const applyAuthCallbackParams = async (params: Record<string, string | string[] | undefined>) => {
    const parsed = parseAuthCallbackFromQuery(params);
    if (!parsed) {
      setError('로그인 콜백 값이 올바르지 않습니다.');
      return false;
    }
    await persistSession(parsed);
    setError(null);
    return true;
  };

  useEffect(() => {
    setApiAuthHandlers({
      getSession: () => session,
      refreshSession,
      onAuthFailure: (reason) => {
        void forceLogout(reason);
      },
    });
    return () => setApiAuthHandlers(null);
  }, [session, refreshSession, forceLogout]);

  return {
    session,
    loading,
    authLoading,
    error,
    setError,
    restore,
    login,
    logout,
    applyAuthCallbackParams,
    forceLogout,
  };
}
