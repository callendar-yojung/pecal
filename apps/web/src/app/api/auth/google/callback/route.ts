import { type NextRequest, NextResponse } from "next/server";
import { generateTokenPair } from "@/lib/jwt";
import { findOrCreateMember } from "@/lib/member";
import { getOAuthRedirectUri } from "@/lib/oauth-redirect-uri";
import { verifyOAuthState } from "@/lib/oauth-state";
import { getSessionClientMeta } from "@/lib/session-client-meta";

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
}

interface GoogleUserResponse {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

/**
 * GET /api/auth/google/callback?code=XXX&state=deskcal://auth/callback
 * 구글 OAuth 콜백을 처리합니다.
 *
 * Flow:
 * 1. 구글에서 code와 state(앱 callback URL)를 포함하여 리다이렉트
 * 2. 구글 인증 코드로 액세스 토큰 교환 (redirect_uri는 반드시 구글에 등록된 URL 사용)
 * 3. 구글 사용자 정보 가져오기
 * 4. DB에서 멤버 찾기/생성
 * 5. JWT 토큰 생성
 * 6. state에 커스텀 스킴이 있으면 해당 URL로 토큰과 함께 리다이렉트
 *    없으면 JSON으로 반환 (레거시 호환)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const appCallback = await verifyOAuthState("google", state);

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
    return handleError(`Google OAuth error: ${error}`, 400);
  }

  if (!code) {
    return handleError("Authorization code is missing", 400);
  }

  try {
    const clientMeta = getSessionClientMeta(request);
    console.log("🔑 구글 OAuth 콜백 처리 시작:", {
      code: `${code.substring(0, 10)}...`,
      appCallback: appCallback,
    });

    const googleClientId = process.env.AUTH_GOOGLE_ID;
    const googleClientSecret = process.env.AUTH_GOOGLE_SECRET;
    if (!googleClientId || !googleClientSecret) {
      return handleError("Google OAuth is not configured", 500);
    }

    // redirect_uri는 반드시 구글에 등록된 URL을 사용해야 함
    const redirectUri = getOAuthRedirectUri(request, "google");

    // 1. 구글 액세스 토큰 받기
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: googleClientId,
        client_secret: googleClientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("❌ 구글 토큰 에러:", errorData);
      return handleError("Failed to get Google access token", 500);
    }

    const tokenData: GoogleTokenResponse = await tokenResponse.json();
    const googleAccessToken = tokenData.access_token;
    console.log("✅ 구글 액세스 토큰 획득");

    // 2. 구글 사용자 정보 가져오기
    const userResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
        },
      },
    );

    if (!userResponse.ok) {
      console.error("❌ 구글 사용자 정보 가져오기 실패");
      return handleError("Failed to get Google user info", 500);
    }

    const googleUser: GoogleUserResponse = await userResponse.json();
    const providerId = googleUser.id;
    const email = googleUser.email || null;
    console.log("✅ 구글 사용자 정보 획득:", { providerId, email });

    // 3. DB에서 멤버 찾기 또는 생성
    const member = await findOrCreateMember("google", providerId, email);
    console.log("✅ 멤버 처리 완료:", { memberId: member.member_id });

    // 4. JWT 토큰 생성
    const memberNickname = member.nickname ?? "사용자";
    const { accessToken, refreshToken } = await generateTokenPair({
      memberId: member.member_id,
      nickname: memberNickname,
      provider: "google",
      email: member.email,
      ...clientMeta,
    });

    console.log("✅ JWT 토큰 생성 완료");

    // 5. 검증된 callback URL로 리다이렉트
    const desktopCallback = appCallback;

    if (accessToken && refreshToken) {
      const callbackUrl = new URL(desktopCallback);

      callbackUrl.searchParams.set("accessToken", accessToken);
      callbackUrl.searchParams.set("refreshToken", refreshToken);
      callbackUrl.searchParams.set("memberId", String(member.member_id));
      callbackUrl.searchParams.set("nickname", memberNickname);
      callbackUrl.searchParams.set("provider", "google");

      if (member.email) {
        callbackUrl.searchParams.set("email", member.email);
      }

      console.log("✅ 데스크톱 앱으로 리다이렉트:", callbackUrl.toString());

      return NextResponse.redirect(callbackUrl.toString(), 307);
    }

    // JSON으로 토큰과 사용자 정보 반환 (레거시 호환)
    return NextResponse.json({
      accessToken,
      refreshToken,
      member: {
        memberId: member.member_id,
        nickname: memberNickname,
        email: member.email,
        provider: "google",
      },
    });
  } catch (error) {
    console.error("❌ 구글 콜백 처리 에러:", error);
    return handleError(
      error instanceof Error ? error.message : "Authentication failed",
      500,
    );
  }
}
