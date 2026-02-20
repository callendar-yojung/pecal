import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/kakao/start?callback=desktop-calendar://auth/callback
 * 데스크톱 앱에서 카카오 OAuth 인증을 시작합니다.
 *
 * Flow:
 * 1. 데스크톱 앱이 callback URL을 전달 (예: desktop-calendar://auth/callback)
 * 2. redirect_uri는 항상 https://pecal.site/api/auth/kakao/callback (카카오에 등록된 URL)
 * 3. callback URL은 state 파라미터에 저장되어 OAuth 흐름을 통해 전달됨
 * 4. 카카오 인증 후, 백엔드가 state에서 callback URL을 추출하여 토큰과 함께 리다이렉트
 */
export async function GET(request: NextRequest) {
  try {
    const KAKAO_AUTH_URL = "https://kauth.kakao.com/oauth/authorize";
    const KAKAO_CLIENT_ID = process.env.AUTH_KAKAO_ID;

    if (!KAKAO_CLIENT_ID) {
      console.error("AUTH_KAKAO_ID is not configured");
      return NextResponse.json(
        { error: "Kakao client ID not configured" },
        { status: 500 }
      );
    }

    // 데스크톱 앱의 callback URL (예: deskcal://auth/callback)
    const searchParams = request.nextUrl.searchParams;
    const appCallback = searchParams.get("callback");

    if (!appCallback) {
      return NextResponse.json(
        { error: "callback parameter is required" },
        { status: 400 }
      );
    }

    // redirect_uri는 항상 카카오에 등록된 HTTPS URL을 사용
    // 카카오는 커스텀 스킴(deskcal://)을 허용하지 않음
    const redirectUri = process.env.NODE_ENV === 'production'
        ? "https://pecal.site/api/auth/kakao/callback"
        : "http://localhost:3000/api/auth/kakao/callback";

    // state 파라미터에 앱의 callback URL을 저장
    // OAuth 흐름이 완료된 후 이 URL로 토큰을 전달함
    const state = appCallback;

    // 카카오 인증 URL 생성
    const params = new URLSearchParams({
      client_id: KAKAO_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      state: state,
    });

    const authUrl = `${KAKAO_AUTH_URL}?${params.toString()}`;

    return NextResponse.json({
      authUrl,
      redirectUri,
      state: appCallback,
    });
  } catch (error) {
    console.error("Kakao start error:", error);
    return NextResponse.json(
      { error: "Failed to start Kakao OAuth", details: String(error) },
      { status: 500 }
    );
  }
}
