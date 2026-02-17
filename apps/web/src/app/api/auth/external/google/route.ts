import { NextRequest, NextResponse } from "next/server";
import { findOrCreateMember } from "@/lib/member";
import { generateTokenPair } from "@/lib/jwt";

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
 * POST /api/auth/external/google
 * 데스크탑 앱용 구글 로그인 API
 * 구글 access_token을 받아서 검증 후 JWT 발급
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { access_token } = body;

    if (!access_token) {
      return NextResponse.json(
        { error: "access_token is required" },
        { status: 400 }
      );
    }

    // 구글 API로 사용자 정보 조회 (토큰 검증)
    const googleResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!googleResponse.ok) {
      return NextResponse.json(
        { error: "Invalid google access token" },
        { status: 401 }
      );
    }

    const googleUser: GoogleUserResponse = await googleResponse.json();

    if (!googleUser.id) {
      return NextResponse.json(
        { error: "Failed to get google user info" },
        { status: 401 }
      );
    }

    // DB에서 회원 조회 또는 생성
    const member = await findOrCreateMember(
      "google",
      googleUser.id,
      googleUser.email || null
    );

    // JWT 토큰 발급
    const tokens = await generateTokenPair({
      memberId: member.member_id,
      nickname: member.nickname || "",
      provider: "google",
      email: member.email,
    });

    return NextResponse.json({
      success: true,
      user: {
        memberId: member.member_id,
        nickname: member.nickname,
        email: member.email,
        provider: "google",
      },
      ...tokens,
    });
  } catch (error) {
    console.error("External google login error:", error);
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
