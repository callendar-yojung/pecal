import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/kakao/start
 * 데스크톱 앱에서 카카오 OAuth 인증을 시작합니다.
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

        // 프론트엔드에서 받을 콜백 URL (선택적)
        const searchParams = request.nextUrl.searchParams;
        const customCallback = searchParams.get("callback");

        // 기본 콜백 URL: 백엔드 API
        const baseUrl =
            process.env.NEXTAUTH_URL ||
            `${request.nextUrl.protocol}//${request.nextUrl.host}`;
        const redirectUri = customCallback || `${baseUrl}/api/auth/kakao/callback`;

        // 카카오 인증 URL 생성
        const params = new URLSearchParams({
            client_id: KAKAO_CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: "code",
        });

        const authUrl = `${KAKAO_AUTH_URL}?${params.toString()}`;

        return NextResponse.json({
            authUrl,
            redirectUri,
        });
    } catch (error) {
        console.error("Kakao start error:", error);
        return NextResponse.json(
            { error: "Failed to start Kakao OAuth", details: String(error) },
            { status: 500 }
        );
    }
}
