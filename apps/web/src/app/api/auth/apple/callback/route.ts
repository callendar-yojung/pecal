import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";
import { type NextRequest, NextResponse } from "next/server";
import { generateAccessToken, generateRefreshToken } from "@/lib/jwt";
import { findOrCreateMember } from "@/lib/member";
import { getOAuthRedirectUri } from "@/lib/oauth-redirect-uri";
import { verifyOAuthState } from "@/lib/oauth-state";

interface AppleTokenResponse {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token?: string;
  token_type: string;
}

interface AppleIdTokenPayload extends JWTPayload {
  sub: string;
  email?: string;
}

const APPLE_JWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);

async function verifyAppleIdToken(idToken: string, audience: string) {
  const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
    issuer: "https://appleid.apple.com",
    audience,
  });

  return payload as AppleIdTokenPayload;
}

async function handleAppleCallback(
  request: NextRequest,
  params: URLSearchParams,
) {
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");
  const appCallback = await verifyOAuthState("apple", state);

  const handleError = (errorMessage: string, status: number) => {
    if (appCallback) {
      const errorUrl = new URL(appCallback);
      errorUrl.searchParams.set("error", errorMessage);
      return NextResponse.redirect(errorUrl.toString());
    }
    return NextResponse.json({ error: errorMessage }, { status });
  };

  if (!appCallback) {
    return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
  }

  if (error) {
    return handleError(`Apple OAuth error: ${error}`, 400);
  }

  if (!code) {
    return handleError("Authorization code is missing", 400);
  }

  const appleClientId = process.env.AUTH_APPLE_ID;
  const appleClientSecret = process.env.AUTH_APPLE_SECRET;
  if (!appleClientId || !appleClientSecret) {
    return handleError("Apple OAuth is not configured", 500);
  }

  try {
    const redirectUri = getOAuthRedirectUri(request, "apple");

    const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: appleClientId,
        client_secret: appleClientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Apple token error:", errorData);
      return handleError("Failed to get Apple access token", 500);
    }

    const tokenData: AppleTokenResponse = await tokenResponse.json();
    const idTokenPayload = await verifyAppleIdToken(
      tokenData.id_token,
      appleClientId,
    );

    if (!idTokenPayload.sub) {
      return handleError("Failed to get Apple user info", 500);
    }

    const providerId = idTokenPayload.sub;
    const email =
      typeof idTokenPayload.email === "string" ? idTokenPayload.email : null;

    const member = await findOrCreateMember("apple", providerId, email);
    const memberNickname = member.nickname ?? "사용자";

    const accessToken = await generateAccessToken({
      memberId: member.member_id,
      nickname: memberNickname,
      provider: "apple",
      email: member.email,
    });

    const refreshToken = await generateRefreshToken({
      memberId: member.member_id,
      nickname: memberNickname,
      provider: "apple",
      email: member.email,
    });

    const callbackUrl = new URL(appCallback);
    callbackUrl.searchParams.set("accessToken", accessToken);
    callbackUrl.searchParams.set("refreshToken", refreshToken);
    callbackUrl.searchParams.set("memberId", String(member.member_id));
    callbackUrl.searchParams.set("nickname", memberNickname);
    callbackUrl.searchParams.set("provider", "apple");

    if (member.email) {
      callbackUrl.searchParams.set("email", member.email);
    }

    return NextResponse.redirect(callbackUrl.toString(), 307);
  } catch (error) {
    console.error("Apple callback error:", error);
    return handleError(
      error instanceof Error ? error.message : "Authentication failed",
      500,
    );
  }
}

export async function GET(request: NextRequest) {
  return handleAppleCallback(request, request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params = new URLSearchParams();
  for (const [key, value] of formData.entries()) {
    params.set(key, String(value));
  }
  return handleAppleCallback(request, params);
}
