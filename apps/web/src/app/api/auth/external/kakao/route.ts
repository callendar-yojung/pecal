import { NextRequest, NextResponse } from "next/server";
import { findOrCreateMember } from "@/lib/member";
import { generateTokenPair } from "@/lib/jwt";

interface KakaoUserResponse {
  id: number;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
    };
  };
}

/**
 * POST /api/auth/external/kakao
 * 데스크탑 앱용 카카오 로그인 API
 * 카카오 access_token을 받아서 검증 후 JWT 발급
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

    // 카카오 API로 사용자 정보 조회 (토큰 검증)
    const kakaoResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
    });

    if (!kakaoResponse.ok) {
      return NextResponse.json(
        { error: "Invalid kakao access token" },
        { status: 401 }
      );
    }

    const kakaoUser: KakaoUserResponse = await kakaoResponse.json();

    if (!kakaoUser.id) {
      return NextResponse.json(
        { error: "Failed to get kakao user info" },
        { status: 401 }
      );
    }

    // DB에서 회원 조회 또는 생성
    const member = await findOrCreateMember(
      "kakao",
      String(kakaoUser.id),
      kakaoUser.kakao_account?.email || null
    );

    // JWT 토큰 발급
    const tokens = await generateTokenPair({
      memberId: member.member_id,
      nickname: member.nickname || "",
      provider: "kakao",
      email: member.email,
    });

    return NextResponse.json({
      success: true,
      user: {
        memberId: member.member_id,
        nickname: member.nickname,
        email: member.email,
        provider: "kakao",
      },
      ...tokens,
    });
  } catch (error) {
    console.error("External kakao login error:", error);
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
