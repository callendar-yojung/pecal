import { SignJWT } from "jose";
import { type NextRequest, NextResponse } from "next/server";
import { changeAdminPassword, verifyAdminCurrentPassword } from "@/lib/admin";
import { getAdminJwtSecret } from "@/lib/admin-jwt-secret";
import { createAdminAuditLogFromRequest } from "@/lib/admin-audit-log";
import { requireAdminToken } from "@/lib/admin-auth";
import { getAdminSecurityState } from "@/lib/admin-security";

const secret = new TextEncoder().encode(getAdminJwtSecret());

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminToken(request, { allowPasswordChangeOnly: true });
    if ("error" in admin) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!body.currentPassword || !body.newPassword) {
      return NextResponse.json(
        { error: "현재 비밀번호와 새 비밀번호를 입력해주세요." },
        { status: 400 },
      );
    }

    if (body.newPassword.length < 8) {
      return NextResponse.json(
        { error: "새 비밀번호는 8자 이상이어야 합니다." },
        { status: 400 },
      );
    }

    const currentPasswordOk = await verifyAdminCurrentPassword(
      Number(admin.admin_id),
      body.currentPassword,
    );
    if (!currentPasswordOk) {
      return NextResponse.json({ error: "현재 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const changed = await changeAdminPassword(Number(admin.admin_id), body.newPassword);
    if (!changed) {
      return NextResponse.json({ error: "비밀번호 변경에 실패했습니다." }, { status: 500 });
    }

    const security = await getAdminSecurityState(Number(admin.admin_id));
    const token = await new SignJWT({
      admin_id: Number(admin.admin_id),
      username: String(admin.username),
      role: security?.role ?? admin.role,
      type: "admin",
      must_change_password: false,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(secret);

    const response = NextResponse.json({ success: true });
    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    await createAdminAuditLogFromRequest(request, {
      adminId: Number(admin.admin_id),
      action: "ADMIN_PASSWORD_CHANGE",
      targetType: "ADMIN",
      targetId: Number(admin.admin_id),
      payload: { username: String(admin.username) },
    });

    return response;
  } catch (error) {
    console.error("Admin change password error:", error);
    return NextResponse.json({ error: "비밀번호 변경 중 오류가 발생했습니다." }, { status: 500 });
  }
}
