import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateAccessToken, generateRefreshToken } from "@/lib/jwt";

/**
 * POST /api/auth/exchange-token
 * NextAuth 세션 토큰을 JWT로 교환합니다.
 * 웹 브라우저에서 로그인한 후 데스크톱 앱용 JWT가 필요할 때 사용
 */
export async function POST() {
  try {
    // NextAuth 세션 확인
    const session = await auth();

    if (!session?.user?.memberId) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // JWT 토큰 생성
    const payload = {
      memberId: session.user.memberId,
      nickname: session.user.nickname || "",
      provider: session.user.provider,
      email: session.user.email,
    };

    const accessToken = await generateAccessToken(payload);
    const refreshToken = await generateRefreshToken(payload);

    return NextResponse.json({
      accessToken,
      refreshToken,
      user: {
        memberId: session.user.memberId,
        nickname: session.user.nickname,
        email: session.user.email,
        provider: session.user.provider,
      },
    });
  } catch (error) {
    console.error("Token exchange error:", error);
    return NextResponse.json(
      { error: "Failed to exchange token" },
      { status: 500 }
    );
  }
}
