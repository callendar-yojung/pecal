import { SignJWT } from "jose";
import { type NextRequest, NextResponse } from "next/server";
import { loginAdmin } from "@/lib/admin";
import { createAdminAuditLog } from "@/lib/admin-audit-log";
import { getAdminSecurityState, isPasswordChangeRequired, verifyAdminTotpCode } from "@/lib/admin-security";
import {
  checkAdminLoginAllowed,
  clearAdminLoginFailures,
  getClientIp,
  normalizeAdminUsername,
  recordAdminLoginFailure,
} from "@/lib/admin-login-rate-limit";
import { getAdminJwtSecret } from "@/lib/admin-jwt-secret";

const secret = new TextEncoder().encode(getAdminJwtSecret());

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, otpCode } = body as {
      username?: string;
      password?: string;
      otpCode?: string;
    };

    if (!username || !password) {
      return NextResponse.json(
        { error: "아이디와 비밀번호를 입력해주세요." },
        { status: 400 },
      );
    }

    const normalizedUsername = normalizeAdminUsername(username);
    const clientIp = getClientIp(request);
    const guard = await checkAdminLoginAllowed(normalizedUsername, clientIp);
    if (!guard.allowed) {
      const response = NextResponse.json(
        { error: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429 },
      );
      response.headers.set("Retry-After", String(guard.retryAfterSeconds));
      return response;
    }

    const admin = await loginAdmin(normalizedUsername, password);
    if (!admin) {
      await recordAdminLoginFailure(normalizedUsername, clientIp);
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 },
      );
    }

    const security = await getAdminSecurityState(admin.admin_id);
    const twoFactorEnabled = security?.twoFactorEnabled ?? false;
    if (twoFactorEnabled) {
      if (!otpCode?.trim()) {
        return NextResponse.json(
          { error: "2FA_CODE_REQUIRED", requiresTwoFactor: true },
          { status: 401 },
        );
      }

      const verified = await verifyAdminTotpCode(admin.admin_id, otpCode.trim());
      if (!verified) {
        await recordAdminLoginFailure(normalizedUsername, clientIp);
        return NextResponse.json(
          { error: "2FA_CODE_INVALID", requiresTwoFactor: true },
          { status: 401 },
        );
      }
    }

    await clearAdminLoginFailures(normalizedUsername, clientIp);

    const requiresPasswordChange = isPasswordChangeRequired({
      passwordChangedAt: security?.passwordChangedAt ?? admin.password_changed_at ?? null,
      forcePasswordChange: security?.forcePasswordChange ?? admin.force_password_change ?? false,
    });

    const token = await new SignJWT({
      admin_id: admin.admin_id,
      username: admin.username,
      role: security?.role ?? admin.role,
      type: "admin",
      must_change_password: requiresPasswordChange,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(secret);

    const response = NextResponse.json({
      success: true,
      admin: {
        admin_id: admin.admin_id,
        username: admin.username,
        name: admin.name,
        email: admin.email,
        role: security?.role ?? admin.role,
      },
      requiresPasswordChange,
      twoFactorEnabled,
    });

    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    await createAdminAuditLog({
      adminId: admin.admin_id,
      action: "ADMIN_LOGIN",
      targetType: "AUTH",
      targetId: admin.admin_id,
      ip: clientIp,
      payload: {
        username: admin.username,
        role: security?.role ?? admin.role,
        twoFactorEnabled,
        requiresPasswordChange,
      },
    });

    return response;
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { error: "로그인 처리 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
