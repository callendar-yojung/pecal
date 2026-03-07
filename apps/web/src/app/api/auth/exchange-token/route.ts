import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isMemberSessionActive } from "@/lib/auth-token-store";
import { generateTokenPair } from "@/lib/jwt";
import { getSessionClientMeta } from "@/lib/session-client-meta";

const ACCESS_TOKEN_COOKIE_NAME = "PECAL_ACCESS_TOKEN";
const REFRESH_TOKEN_COOKIE_NAME = "PECAL_REFRESH_TOKEN";
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * POST /api/auth/exchange-token
 * NextAuth 세션 토큰을 JWT로 교환합니다.
 * 웹 브라우저에서 로그인한 후 데스크톱 앱용 JWT가 필요할 때 사용
 */
export async function POST(request: NextRequest) {
  try {
    // NextAuth 세션 확인
    const session = await auth();

    if (!session?.user?.memberId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const isActive = await isMemberSessionActive({
      memberId: session.user.memberId,
      sessionId: session.user.sessionId,
    });
    if (!isActive) {
      return NextResponse.json({ error: "Session revoked" }, { status: 401 });
    }

    const clientMeta = getSessionClientMeta(request);
    // JWT 토큰 생성
    const payload = {
      memberId: session.user.memberId,
      nickname: session.user.nickname || "",
      provider: session.user.provider,
      email: session.user.email,
      sessionId: session.user.sessionId,
      ...clientMeta,
    };

    const { accessToken, refreshToken } = await generateTokenPair(payload);

    const response = NextResponse.json({
      accessToken,
      refreshToken,
      user: {
        memberId: session.user.memberId,
        nickname: session.user.nickname,
        email: session.user.email,
        provider: session.user.provider,
      },
    });

    response.cookies.set({
      name: ACCESS_TOKEN_COOKIE_NAME,
      value: accessToken,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ACCESS_TOKEN_TTL_SECONDS,
    });
    response.cookies.set({
      name: REFRESH_TOKEN_COOKIE_NAME,
      value: refreshToken,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: REFRESH_TOKEN_TTL_SECONDS,
    });

    return response;
  } catch (error) {
    console.error("Token exchange error:", error);
    return NextResponse.json(
      { error: "Failed to exchange token" },
      { status: 500 },
    );
  }
}
