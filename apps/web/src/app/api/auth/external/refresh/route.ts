import { NextRequest, NextResponse } from "next/server";
import { verifyToken, generateTokenPair } from "@/lib/jwt";

/**
 * POST /api/auth/external/refresh
 * 리프레시 토큰으로 새 액세스 토큰 발급
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refresh_token } = body;

    if (!refresh_token) {
      return NextResponse.json(
        { error: "refresh_token is required" },
        { status: 400 }
      );
    }

    // 리프레시 토큰 검증
    const payload = await verifyToken(refresh_token);

    if (!payload || payload.type !== "refresh") {
      return NextResponse.json(
        { error: "Invalid refresh token" },
        { status: 401 }
      );
    }

    // 새 토큰 발급
    const tokens = await generateTokenPair({
      memberId: payload.memberId,
      nickname: payload.nickname,
      provider: payload.provider,
      email: payload.email,
    });

    return NextResponse.json({
      success: true,
      ...tokens,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { error: "Token refresh failed" },
      { status: 500 }
    );
  }
}