import { createHash, randomUUID } from "node:crypto";
import { getRedisClient, toRedisKey } from "./redis-cache";

type TokenType = "access" | "refresh";

type RefreshSessionRecord = {
  memberId: number;
  sessionId: string;
  currentAccessTokenId: string | null;
  currentAccessTokenExpiresAt: number | null;
  currentRefreshTokenId: string | null;
  currentRefreshTokenExpiresAt: number | null;
  provider: string;
  email?: string | null;
  nickname: string;
  clientPlatform: string;
  clientName: string;
  appVersion?: string | null;
  userAgent?: string | null;
  createdAt: string;
  lastSeenAt: string;
};

function tokenBlacklistKey(type: TokenType, tokenId: string) {
  return toRedisKey(`auth:blacklist:${type}:${tokenId}`);
}

function refreshSessionKey(sessionId: string) {
  return toRedisKey(`auth:refresh:session:${sessionId}`);
}

function memberSessionsKey(memberId: number) {
  return toRedisKey(`auth:refresh:member:${memberId}`);
}

function refreshTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function secondsUntil(unixSeconds: number) {
  return Math.max(1, unixSeconds - Math.floor(Date.now() / 1000));
}

const BROWSER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export function createTokenId() {
  return randomUUID();
}

export function createSessionId() {
  return randomUUID();
}

export async function blacklistToken(params: {
  type: TokenType;
  tokenId: string;
  expiresAt: number;
}) {
  const redis = getRedisClient();
  if (!redis) return;

  await redis.set(
    tokenBlacklistKey(params.type, params.tokenId),
    "1",
    "EX",
    secondsUntil(params.expiresAt),
  );
}

export async function isTokenBlacklisted(
  type: TokenType,
  tokenId?: string | null,
) {
  if (!tokenId) return false;
  const redis = getRedisClient();
  if (!redis) return false;
  const exists = await redis.exists(tokenBlacklistKey(type, tokenId));
  return exists === 1;
}

export async function storeRefreshSession(params: {
  sessionId: string;
  accessTokenId: string;
  accessTokenExpiresAt: number;
  refreshTokenId: string;
  refreshToken: string;
  memberId: number;
  provider: string;
  nickname: string;
  email?: string | null;
  expiresAt: number;
  clientPlatform: string;
  clientName: string;
  appVersion?: string | null;
  userAgent?: string | null;
}) {
  const redis = getRedisClient();
  if (!redis) return;

  const existingRaw = await redis.get(refreshSessionKey(params.sessionId));
  let existingRecord: RefreshSessionRecord | null = null;
  if (existingRaw) {
    try {
      existingRecord = JSON.parse(existingRaw) as RefreshSessionRecord;
    } catch {
      existingRecord = null;
    }
  }

  const nowIso = new Date().toISOString();
  const payload: RefreshSessionRecord = {
    sessionId: params.sessionId,
    memberId: params.memberId,
    currentAccessTokenId: params.accessTokenId,
    currentAccessTokenExpiresAt: params.accessTokenExpiresAt,
    currentRefreshTokenId: params.refreshTokenId,
    currentRefreshTokenExpiresAt: params.expiresAt,
    provider: params.provider,
    nickname: params.nickname,
    email: params.email,
    clientPlatform: params.clientPlatform,
    clientName: params.clientName,
    appVersion: params.appVersion,
    userAgent: params.userAgent,
    createdAt: existingRecord?.createdAt ?? nowIso,
    lastSeenAt: nowIso,
  };

  const ttl = secondsUntil(params.expiresAt);
  await redis
    .multi()
    .set(
      refreshSessionKey(params.sessionId),
      JSON.stringify({
        ...payload,
        tokenHash: refreshTokenHash(params.refreshToken),
      }),
      "EX",
      ttl,
    )
    .sadd(memberSessionsKey(params.memberId), params.sessionId)
    .expire(memberSessionsKey(params.memberId), ttl)
    .exec();
}

export async function storeBrowserSession(params: {
  sessionId: string;
  memberId: number;
  provider: string;
  nickname: string;
  email?: string | null;
  clientPlatform?: string;
  clientName?: string;
  appVersion?: string | null;
  userAgent?: string | null;
}) {
  const redis = getRedisClient();
  if (!redis) return;

  const existingRaw = await redis.get(refreshSessionKey(params.sessionId));
  let existingRecord: RefreshSessionRecord | null = null;
  if (existingRaw) {
    try {
      existingRecord = JSON.parse(existingRaw) as RefreshSessionRecord;
    } catch {
      existingRecord = null;
    }
  }

  const nowIso = new Date().toISOString();
  const payload: RefreshSessionRecord = {
    sessionId: params.sessionId,
    memberId: params.memberId,
    currentAccessTokenId: existingRecord?.currentAccessTokenId ?? null,
    currentAccessTokenExpiresAt:
      existingRecord?.currentAccessTokenExpiresAt ?? null,
    currentRefreshTokenId: existingRecord?.currentRefreshTokenId ?? null,
    currentRefreshTokenExpiresAt:
      existingRecord?.currentRefreshTokenExpiresAt ?? null,
    provider: params.provider,
    nickname: params.nickname,
    email: params.email,
    clientPlatform: params.clientPlatform ?? "web",
    clientName: params.clientName ?? "Pecal Web",
    appVersion: params.appVersion ?? null,
    userAgent: params.userAgent ?? existingRecord?.userAgent ?? null,
    createdAt: existingRecord?.createdAt ?? nowIso,
    lastSeenAt: nowIso,
  };

  await redis
    .multi()
    .set(
      refreshSessionKey(params.sessionId),
      JSON.stringify(payload),
      "EX",
      BROWSER_SESSION_TTL_SECONDS,
    )
    .sadd(memberSessionsKey(params.memberId), params.sessionId)
    .expire(memberSessionsKey(params.memberId), BROWSER_SESSION_TTL_SECONDS)
    .exec();
}

export async function validateRefreshSession(params: {
  sessionId?: string | null;
  tokenId?: string | null;
  refreshToken: string;
  memberId: number;
}) {
  if (!params.sessionId || !params.tokenId) return false;
  const redis = getRedisClient();
  if (!redis) return true;

  const raw = await redis.get(refreshSessionKey(params.sessionId));
  if (!raw) return false;

  let parsed: (RefreshSessionRecord & { tokenHash?: string }) | null = null;
  try {
    parsed = JSON.parse(raw) as RefreshSessionRecord & { tokenHash?: string };
  } catch {
    return false;
  }

  if (!parsed) return false;
  if (parsed.memberId !== params.memberId) return false;
  if (parsed.currentRefreshTokenId !== params.tokenId) return false;
  if (
    !parsed.tokenHash ||
    parsed.tokenHash !== refreshTokenHash(params.refreshToken)
  ) {
    return false;
  }

  return true;
}

export async function revokeRefreshSession(params: {
  sessionId?: string | null;
  memberId: number;
  refreshTokenId?: string | null;
  refreshTokenExpiresAt?: number | null;
}) {
  const redis = getRedisClient();
  if (!redis) return;

  const jobs: Array<Promise<unknown>> = [];
  if (params.sessionId) {
    jobs.push(redis.del(refreshSessionKey(params.sessionId)));
    jobs.push(redis.srem(memberSessionsKey(params.memberId), params.sessionId));
  }
  if (params.refreshTokenId && params.refreshTokenExpiresAt) {
    jobs.push(
      blacklistToken({
        type: "refresh",
        tokenId: params.refreshTokenId,
        expiresAt: params.refreshTokenExpiresAt,
      }),
    );
  }
  await Promise.all(jobs);
}

export async function revokeAllMemberRefreshSessions(memberId: number) {
  const redis = getRedisClient();
  if (!redis) return;

  const setKey = memberSessionsKey(memberId);
  const sessionIds = await redis.smembers(setKey);
  if (sessionIds.length === 0) return;

  const multi = redis.multi();
  for (const sessionId of sessionIds) {
    multi.del(refreshSessionKey(sessionId));
    multi.srem(setKey, sessionId);
  }
  multi.del(setKey);
  await multi.exec();
}

export async function isMemberSessionActive(params: {
  memberId: number;
  sessionId?: string | null;
}) {
  if (!params.sessionId) return false;
  const redis = getRedisClient();
  if (!redis) return true;

  const raw = await redis.get(refreshSessionKey(params.sessionId));
  if (!raw) return false;

  try {
    const session = JSON.parse(raw) as RefreshSessionRecord;
    return session.memberId === params.memberId;
  } catch {
    return false;
  }
}

export async function getMemberRefreshSessions(memberId: number) {
  const redis = getRedisClient();
  if (!redis) return [] as RefreshSessionRecord[];

  const sessionIds = await redis.smembers(memberSessionsKey(memberId));
  if (sessionIds.length === 0) return [];

  const rawRecords = await redis.mget(
    sessionIds.map((sessionId) => refreshSessionKey(sessionId)),
  );

  const sessions = rawRecords
    .map((raw) => {
      if (!raw) return null;
      try {
        return JSON.parse(raw) as RefreshSessionRecord & { tokenHash?: string };
      } catch {
        return null;
      }
    })
    .filter(
      (session): session is RefreshSessionRecord & { tokenHash?: string } =>
        !!session,
    )
    .map(({ tokenHash: _tokenHash, ...session }) => session)
    .sort((a, b) => {
      return (
        new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
      );
    });

  return sessions;
}

export async function revokeMemberSession(params: {
  memberId: number;
  sessionId: string;
}) {
  const redis = getRedisClient();
  if (!redis) return false;

  const raw = await redis.get(refreshSessionKey(params.sessionId));
  if (!raw) return false;

  let session: RefreshSessionRecord | null = null;
  try {
    session = JSON.parse(raw) as RefreshSessionRecord;
  } catch {
    return false;
  }

  if (!session || session.memberId !== params.memberId) {
    return false;
  }

  const jobs: Array<Promise<unknown>> = [
    redis.del(refreshSessionKey(params.sessionId)),
    redis.srem(memberSessionsKey(params.memberId), params.sessionId),
  ];

  if (session.currentAccessTokenId && session.currentAccessTokenExpiresAt) {
    jobs.push(
      blacklistToken({
        type: "access",
        tokenId: session.currentAccessTokenId,
        expiresAt: session.currentAccessTokenExpiresAt,
      }),
    );
  }
  if (session.currentRefreshTokenId && session.currentRefreshTokenExpiresAt) {
    jobs.push(
      blacklistToken({
        type: "refresh",
        tokenId: session.currentRefreshTokenId,
        expiresAt: session.currentRefreshTokenExpiresAt,
      }),
    );
  }

  await Promise.all(jobs);
  return true;
}
