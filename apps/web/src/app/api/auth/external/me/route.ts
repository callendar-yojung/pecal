import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";

/**
 * GET /api/auth/external/me
 * 현재 로그인한 사용자 정보 조회
 * Authorization: Bearer {access_token}
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        memberId: user.memberId,
        nickname: user.nickname,
        email: user.email,
        provider: user.provider,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Failed to get user info" },
      { status: 500 }
    );
  }
}