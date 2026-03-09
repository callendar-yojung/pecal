import { type NextRequest, NextResponse } from "next/server";
import { createAdmin, getAllAdmins, updateAdmin } from "@/lib/admin";
import { createAdminAuditLogFromRequest } from "@/lib/admin-audit-log";
import { isValidAdminRole, requireAdminRole } from "@/lib/admin-auth";
import { ADMIN_ROLES } from "@/lib/admin-security";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminRole(request, ["SUPER_ADMIN"]);
    if ("error" in admin) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const admins = await getAllAdmins();
    return NextResponse.json({ success: true, admins, roles: ADMIN_ROLES });
  } catch (error) {
    console.error("Admin admins error:", error);
    return NextResponse.json({ error: "관리자 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminRole(request, ["SUPER_ADMIN"]);
    if ("error" in admin) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const body = (await request.json()) as {
      username?: string;
      password?: string;
      name?: string;
      email?: string;
      role?: string;
      force_password_change?: boolean;
    };

    if (!body.username || !body.password || !body.name || !body.email) {
      return NextResponse.json({ error: "필수 항목을 모두 입력해주세요." }, { status: 400 });
    }

    const role = isValidAdminRole(body.role) ? body.role : "OPS";
    const adminId = await createAdmin({
      username: body.username.trim(),
      password: body.password,
      name: body.name.trim(),
      email: body.email.trim(),
      role,
      force_password_change: body.force_password_change !== false,
    });

    await createAdminAuditLogFromRequest(request, {
      adminId: Number(admin.admin_id),
      action: "ADMIN_ROLE_UPDATE",
      targetType: "ADMIN",
      targetId: adminId,
      payload: { created: true, role, username: body.username.trim() },
    });

    return NextResponse.json({ success: true, adminId });
  } catch (error) {
    console.error("Admin create error:", error);
    return NextResponse.json({ error: "관리자 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdminRole(request, ["SUPER_ADMIN"]);
    if ("error" in admin) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const body = (await request.json()) as {
      admin_id?: number;
      name?: string;
      email?: string;
      role?: string;
      force_password_change?: boolean;
    };

    const adminId = Number(body.admin_id);
    if (!Number.isInteger(adminId) || adminId <= 0) {
      return NextResponse.json({ error: "admin_id가 필요합니다." }, { status: 400 });
    }

    const role = body.role === undefined ? undefined : isValidAdminRole(body.role) ? body.role : null;
    if (body.role !== undefined && role === null) {
      return NextResponse.json({ error: "유효하지 않은 역할입니다." }, { status: 400 });
    }

    const updated = await updateAdmin(adminId, {
      name: body.name,
      email: body.email,
      role: role ?? undefined,
      force_password_change: body.force_password_change,
    });

    if (!updated) {
      return NextResponse.json({ error: "관리자 수정에 실패했습니다." }, { status: 400 });
    }

    if (role) {
      await createAdminAuditLogFromRequest(request, {
        adminId: Number(admin.admin_id),
        action: "ADMIN_ROLE_UPDATE",
        targetType: "ADMIN",
        targetId: adminId,
        payload: { role },
      });
    }
    if (body.force_password_change !== undefined) {
      await createAdminAuditLogFromRequest(request, {
        adminId: Number(admin.admin_id),
        action: "ADMIN_FORCE_PASSWORD_CHANGE_UPDATE",
        targetType: "ADMIN",
        targetId: adminId,
        payload: { force_password_change: body.force_password_change },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin update error:", error);
    return NextResponse.json({ error: "관리자 수정 중 오류가 발생했습니다." }, { status: 500 });
  }
}
