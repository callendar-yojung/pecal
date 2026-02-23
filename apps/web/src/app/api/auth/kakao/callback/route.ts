import { NextRequest, NextResponse } from "next/server";
import { findOrCreateMember } from "@/lib/member";
import { generateAccessToken, generateRefreshToken } from "@/lib/jwt";
import {
  getOAuthStateCookieName,
  getOAuthStateCookieOptions,
  verifyOAuthState,
} from "@/lib/oauth-state";

/**
 * GET /api/auth/kakao/callback?code=XXX&state=deskcal://auth/callback
 * 카카오 OAuth 콜백을 처리합니다.
 *
 * Flow:
 * 1. 카카오에서 code와 state(앱 callback URL)를 포함하여 리다이렉트
 * 2. 카카오 인증 코드로 액세스 토큰 교환 (redirect_uri는 반드시 카카오에 등록된 URL 사용)
 * 3. 카카오 사용자 정보 가져오기
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
  const stateCookieName = getOAuthStateCookieName("kakao");
  const stateNonce = request.cookies.get(stateCookieName)?.value ?? null;
  const appCallback = await verifyOAuthState("kakao", state, stateNonce);

  const withClearedStateCookie = (response: NextResponse) => {
    response.cookies.set(stateCookieName, "", {
      ...getOAuthStateCookieOptions("kakao"),
      maxAge: 0,
    });
    return response;
  };

  const handleError = (errorMessage: string, status: number) => {
    if (appCallback) {
      const errorUrl = new URL(appCallback);
      errorUrl.searchParams.set("error", errorMessage);
      return withClearedStateCookie(NextResponse.redirect(errorUrl.toString()));
    }
    return withClearedStateCookie(
      NextResponse.json({ error: errorMessage }, { status })
    );
  };

  if (!appCallback) {
    return withClearedStateCookie(
      NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 })
    );
  }

  if (error) {
    return handleError(`Kakao OAuth error: ${error}`, 400);
  }

  if (!code) {
    return handleError("Authorization code is missing", 400);
  }

  try {
    console.log("🔑 카카오 OAuth 콜백 처리 시작:", {
      code: code.substring(0, 10) + "...",
      appCallback: appCallback
    });

    // redirect_uri는 반드시 카카오에 등록된 URL을 사용해야 함
    const redirectUri = process.env.NODE_ENV === 'production'
        ? "https://pecal.site/api/auth/kakao/callback"
        : "http://localhost:3000/api/auth/kakao/callback";


    // 1. 카카오 액세스 토큰 받기
    const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.AUTH_KAKAO_ID!,
        client_secret: process.env.AUTH_KAKAO_SECRET!,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("❌ 카카오 토큰 에러:", errorData);
      return handleError("Failed to get Kakao access token", 500);
    }

    const tokenData = await tokenResponse.json();
    const kakaoAccessToken = tokenData.access_token;
    console.log("✅ 카카오 액세스 토큰 획득");

    // 2. 카카오 사용자 정보 가져오기
    const userResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: {
        Authorization: `Bearer ${kakaoAccessToken}`,
      },
    });

    if (!userResponse.ok) {
      console.error("❌ 카카오 사용자 정보 가져오기 실패");
      return handleError("Failed to get Kakao user info", 500);
    }

    const kakaoUser = await userResponse.json();
    const providerId = String(kakaoUser.id);
    const email = kakaoUser.kakao_account?.email || null;
    console.log("✅ 카카오 사용자 정보 획득:", { providerId, email });

    // 3. DB에서 멤버 찾기 또는 생성
    const member = await findOrCreateMember("kakao", providerId, email);
    console.log("✅ 멤버 처리 완료:", { memberId: member.member_id });

    // 4. JWT 토큰 생성
    const memberNickname = member.nickname ?? "사용자";
    const accessToken = await generateAccessToken({
      memberId: member.member_id,
      nickname: memberNickname,
      provider: "kakao",
      email: member.email,
    });

    const refreshToken = await generateRefreshToken({
      memberId: member.member_id,
      nickname: memberNickname,
      provider: "kakao",
      email: member.email,
    });

    console.log("✅ JWT 토큰 생성 완료");

    // 5. 검증된 callback URL로 리다이렉트
    const desktopCallback = appCallback;

    if (accessToken && refreshToken) {
      const callbackUrl = new URL(desktopCallback);

      // ⚠️ 가능하면 토큰 말고 1회용 code 추천
      callbackUrl.searchParams.set('accessToken', accessToken);
      callbackUrl.searchParams.set('refreshToken', refreshToken);
      callbackUrl.searchParams.set('memberId', String(member.member_id));
      callbackUrl.searchParams.set('nickname', memberNickname);
      callbackUrl.searchParams.set('provider', 'kakao');

      if (member.email) {
        callbackUrl.searchParams.set('email', member.email);
      }

      console.log('✅ 데스크톱 앱으로 리다이렉트:', callbackUrl.toString());

      return withClearedStateCookie(
        NextResponse.redirect(callbackUrl.toString(), 307)
      );
    }

    // JSON으로 토큰과 사용자 정보 반환 (레거시 호환)
    return withClearedStateCookie(
      NextResponse.json({
        accessToken,
        refreshToken,
        member: {
          memberId: member.member_id,
          nickname: memberNickname,
          email: member.email,
          provider: "kakao",
        },
      })
    );

  } catch (error) {
    console.error("❌ 카카오 콜백 처리 에러:", error);
    return handleError(
      error instanceof Error ? error.message : "Authentication failed",
      500
    );
  }
}
