import { NextRequest, NextResponse } from "next/server";
import {
  createOAuthState,
  getOAuthStateCookieName,
  getOAuthStateCookieOptions,
  isAllowedOAuthCallback,
} from "@/lib/oauth-state";
import { getOAuthRedirectUri } from "@/lib/oauth-redirect-uri";

/**
 * GET /api/auth/google/start?callback=deskcal://auth/callback
 * 데스크톱 앱에서 구글 OAuth 인증을 시작합니다.
 *
 * Flow:
 * 1. 데스크톱 앱이 callback URL을 전달 (예: deskcal://auth/callback)
 * 2. redirect_uri는 항상 https://pecal.site/api/auth/google/callback (구글에 등록된 URL)
 * 3. callback URL은 state 파라미터에 저장되어 OAuth 흐름을 통해 전달됨
 * 4. 구글 인증 후, 백엔드가 state에서 callback URL을 추출하여 토큰과 함께 리다이렉트
 */
export async function GET(request: NextRequest) {
  try {
    const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
    const GOOGLE_CLIENT_ID = process.env.AUTH_GOOGLE_ID;

    if (!GOOGLE_CLIENT_ID) {
      console.error("AUTH_GOOGLE_ID is not configured");
      return NextResponse.json(
        { error: "Google client ID not configured" },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const appCallback = searchParams.get("callback");

    if (!appCallback) {
      return NextResponse.json(
        { error: "callback parameter is required" },
        { status: 400 }
      );
    }

    if (!isAllowedOAuthCallback(appCallback)) {
      return NextResponse.json(
        { error: "Invalid callback URL" },
        { status: 400 }
      );
    }

    // redirect_uri는 항상 구글에 등록된 HTTPS URL을 사용
    // 구글은 커스텀 스킴(deskcal://)을 웹 앱에서는 허용하지 않음
    const redirectUri = getOAuthRedirectUri(request, "google");

    const { state, nonce } = await createOAuthState("google", appCallback);

    // 구글 인증 URL 생성
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state: state,
      access_type: "offline",
      prompt: "consent",
    });

    const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

    const response = NextResponse.json({
      authUrl,
      redirectUri,
      state,
    });
    response.cookies.set(
      getOAuthStateCookieName("google"),
      nonce,
      getOAuthStateCookieOptions("google")
    );
    return response;
  } catch (error) {
    console.error("Google start error:", error);
    return NextResponse.json(
      { error: "Failed to start Google OAuth", details: String(error) },
      { status: 500 }
    );
  }
}
