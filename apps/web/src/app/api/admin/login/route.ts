import { NextRequest, NextResponse } from "next/server";
import { loginAdmin } from "@/lib/admin";
import { SignJWT } from "jose";

const secret = new TextEncoder().encode(
  process.env.API_SECRET_KEY || "default-secret-key"
);

// POST /api/admin/login - 관리자 로그인
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "아이디와 비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    // 관리자 로그인 검증
    const admin = await loginAdmin(username, password);

    if (!admin) {
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    // JWT 토큰 생성
    const token = await new SignJWT({
      admin_id: admin.admin_id,
      username: admin.username,
      role: admin.role,
      type: "admin",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(secret);

    // 쿠키에 토큰 저장
    const response = NextResponse.json({
      success: true,
      admin: {
        admin_id: admin.admin_id,
        username: admin.username,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });

    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24시간
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { error: "로그인 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

