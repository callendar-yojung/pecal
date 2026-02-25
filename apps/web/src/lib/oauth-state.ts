import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";
import { getRequiredEnv } from "@/lib/required-env";

type OAuthProvider = "google" | "kakao" | "apple";

const OAUTH_STATE_TTL_SECONDS = 60 * 10;
const OAUTH_STATE_COOKIE_PREFIX = "oauth_state_";

interface OAuthStatePayload {
  type: "oauth_state";
  provider: OAuthProvider;
  callback: string;
  nonceHash: string;
}

function getOAuthSecret(): Uint8Array {
  return new TextEncoder().encode(getRequiredEnv("AUTH_SECRET"));
}

function normalizeCallbackUrl(input: string): string | null {
  try {
    const parsed = new URL(input);
    if (["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return null;
  }
}

function getAllowedCallbacks(): Set<string> {
  const allowlist = new Set<string>();
  const envCandidates = [
    process.env.APP_DEEPLINK_SCHEME,
    process.env.APP_DEEPLINK_SCHEME_ALLOWLIST,
  ];

  for (const candidate of envCandidates) {
    if (!candidate) continue;
    for (const value of candidate.split(",")) {
      const normalized = normalizeCallbackUrl(value.trim());
      if (normalized) allowlist.add(normalized);
    }
  }

  // Backward compatibility defaults
  for (const value of [
    "deskcal://auth/callback",
    "deskcal-dev://auth/callback",
    "myapp://auth/callback",
  ]) {
    const normalized = normalizeCallbackUrl(value);
    if (normalized) allowlist.add(normalized);
  }

  return allowlist;
}

export function isAllowedOAuthCallback(callback: string): boolean {
  const normalized = normalizeCallbackUrl(callback);
  if (!normalized) return false;
  return getAllowedCallbacks().has(normalized);
}

export function getOAuthStateCookieName(provider: OAuthProvider): string {
  return `${OAUTH_STATE_COOKIE_PREFIX}${provider}`;
}

export function getOAuthStateCookiePath(provider: OAuthProvider): string {
  return `/api/auth/${provider}/callback`;
}

export function getOAuthStateCookieOptions(provider: OAuthProvider) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: getOAuthStateCookiePath(provider),
    maxAge: OAUTH_STATE_TTL_SECONDS,
  };
}

export async function createOAuthState(
  provider: OAuthProvider,
  callback: string
): Promise<{ state: string }> {
  const normalized = normalizeCallbackUrl(callback);
  if (!normalized || !isAllowedOAuthCallback(normalized)) {
    throw new Error("Invalid OAuth callback");
  }

  // Random entropy is still included to make each state unique and non-guessable.
  const nonce = randomBytes(24).toString("base64url");
  const state = await new SignJWT({
    type: "oauth_state",
    provider,
    callback: normalized,
    nonceHash: nonce,
  } satisfies OAuthStatePayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${OAUTH_STATE_TTL_SECONDS}s`)
    .sign(getOAuthSecret());

  return { state };
}

export async function verifyOAuthState(
  provider: OAuthProvider,
  state: string | null
): Promise<string | null> {
  if (!state) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(state, getOAuthSecret());
    if (payload.type !== "oauth_state") return null;
    if (payload.provider !== provider) return null;
    if (typeof payload.callback !== "string") return null;
    if (!isAllowedOAuthCallback(payload.callback)) return null;
    return payload.callback;
  } catch {
    return null;
  }
}
