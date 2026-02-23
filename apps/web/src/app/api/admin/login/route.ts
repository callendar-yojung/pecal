import { NextRequest, NextResponse } from "next/server";
import { loginAdmin } from "@/lib/admin";
import { SignJWT } from "jose";
import { getRequiredEnv } from "@/lib/required-env";
import {
  checkAdminLoginAllowed,
  clearAdminLoginFailures,
  getClientIp,
  normalizeAdminUsername,
  recordAdminLoginFailure,
} from "@/lib/admin-login-rate-limit";

const secret = new TextEncoder().encode(getRequiredEnv("API_SECRET_KEY"));

// POST /api/admin/login - 관리자 로그인
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return NextResponse.json(
        { error: "아이디와 비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    const normalizedUsername = normalizeAdminUsername(username);
    const clientIp = getClientIp(request);
    const guard = await checkAdminLoginAllowed(normalizedUsername, clientIp);
    if (!guard.allowed) {
      const response = NextResponse.json(
        { error: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      );
      response.headers.set("Retry-After", String(guard.retryAfterSeconds));
      return response;
    }

    // 관리자 로그인 검증
    const admin = await loginAdmin(normalizedUsername, password);

    if (!admin) {
      await recordAdminLoginFailure(normalizedUsername, clientIp);
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    await clearAdminLoginFailures(normalizedUsername, clientIp);

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
