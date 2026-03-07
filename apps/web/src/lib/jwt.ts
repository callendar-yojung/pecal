import { type JWTPayload, jwtVerify, SignJWT } from "jose";
import {
  blacklistToken,
  createSessionId,
  createTokenId,
  isTokenBlacklisted,
  storeRefreshSession,
} from "@/lib/auth-token-store";
import { getRequiredEnv } from "@/lib/required-env";

export interface TokenPayload extends JWTPayload {
  memberId: number;
  nickname: string;
  provider: string;
  email?: string | null;
  sid?: string;
  type: "access" | "refresh";
}

const JWT_SECRET = new TextEncoder().encode(getRequiredEnv("AUTH_SECRET"));

const ACCESS_TOKEN_EXPIRY = "1h";
const REFRESH_TOKEN_EXPIRY = "7d";

export async function generateAccessToken(payload: {
  memberId: number;
  nickname: string;
  provider: string;
  email?: string | null;
  sessionId: string;
  tokenId?: string;
}): Promise<string> {
  const { sessionId, tokenId, ...claims } = payload;
  return new SignJWT({ ...claims, sid: sessionId, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setJti(tokenId ?? createTokenId())
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function generateRefreshToken(payload: {
  memberId: number;
  nickname: string;
  provider: string;
  email?: string | null;
  sessionId: string;
  tokenId?: string;
}): Promise<string> {
  const { sessionId, tokenId, ...claims } = payload;
  return new SignJWT({ ...claims, sid: sessionId, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setJti(tokenId ?? createTokenId())
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const typedPayload = payload as TokenPayload;
    if (await isTokenBlacklisted(typedPayload.type, typedPayload.jti)) {
      return null;
    }
    return typedPayload;
  } catch {
    return null;
  }
}

export async function blacklistVerifiedToken(payload: TokenPayload | null) {
  if (!payload?.jti || !payload.exp) return;
  await blacklistToken({
    type: payload.type,
    tokenId: payload.jti,
    expiresAt: payload.exp,
  });
}

export async function generateTokenPair(memberData: {
  memberId: number;
  nickname: string;
  provider: string;
  email?: string | null;
  clientPlatform?: string;
  clientName?: string;
  appVersion?: string | null;
  userAgent?: string | null;
  sessionId?: string;
  revokeRefreshTokenId?: string | null;
  revokeRefreshTokenExpiresAt?: number | null;
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const sessionId = memberData.sessionId ?? createSessionId();
  const accessTokenId = createTokenId();
  const refreshTokenId = createTokenId();

  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken({ ...memberData, sessionId, tokenId: accessTokenId }),
    generateRefreshToken({ ...memberData, sessionId, tokenId: refreshTokenId }),
  ]);

  const [accessPayload, refreshPayload] = (await Promise.all([
    verifyToken(accessToken),
    verifyToken(refreshToken),
  ])) as [TokenPayload | null, TokenPayload | null];
  if (
    !accessPayload?.exp ||
    !accessPayload.jti ||
    !refreshPayload?.exp ||
    !refreshPayload.jti
  ) {
    throw new Error("Failed to build token session");
  }

  await storeRefreshSession({
    sessionId,
    accessTokenId: accessPayload.jti,
    accessTokenExpiresAt: accessPayload.exp,
    refreshTokenId: refreshPayload.jti,
    refreshToken,
    memberId: memberData.memberId,
    provider: memberData.provider,
    nickname: memberData.nickname,
    email: memberData.email,
    expiresAt: refreshPayload.exp,
    clientPlatform: memberData.clientPlatform ?? "unknown",
    clientName: memberData.clientName ?? "Pecal",
    appVersion: memberData.appVersion,
    userAgent: memberData.userAgent,
  });

  if (
    memberData.revokeRefreshTokenId &&
    memberData.revokeRefreshTokenExpiresAt
  ) {
    await blacklistToken({
      type: "refresh",
      tokenId: memberData.revokeRefreshTokenId,
      expiresAt: memberData.revokeRefreshTokenExpiresAt,
    });
  }

  return {
    accessToken,
    refreshToken,
    expiresIn: 3600, // 1시간 (초 단위)
  };
}
