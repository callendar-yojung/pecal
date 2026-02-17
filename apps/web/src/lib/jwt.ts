import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export interface TokenPayload extends JWTPayload {
  memberId: number;
  nickname: string;
  provider: string;
  email?: string | null;
  type: "access" | "refresh";
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "fallback-secret-key-change-in-production"
);

const ACCESS_TOKEN_EXPIRY = "1h";
const REFRESH_TOKEN_EXPIRY = "7d";

export async function generateAccessToken(payload: {
  memberId: number;
  nickname: string;
  provider: string;
  email?: string | null;
}): Promise<string> {
  return new SignJWT({ ...payload, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function generateRefreshToken(payload: {
  memberId: number;
  nickname: string;
  provider: string;
  email?: string | null;
}): Promise<string> {
  return new SignJWT({ ...payload, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

export async function generateTokenPair(memberData: {
  memberId: number;
  nickname: string;
  provider: string;
  email?: string | null;
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(memberData),
    generateRefreshToken(memberData),
  ]);

  return {
    accessToken,
    refreshToken,
    expiresIn: 3600, // 1시간 (초 단위)
  };
}