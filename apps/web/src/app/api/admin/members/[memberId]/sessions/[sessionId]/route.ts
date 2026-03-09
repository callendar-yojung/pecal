import { type NextRequest, NextResponse } from "next/server";
import { createAdminAuditLogFromRequest } from "@/lib/admin-audit-log";
import { requireAdminRole } from "@/lib/admin-auth";
import { revokeMemberSession } from "@/lib/auth-token-store";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ memberId: string; sessionId: string }> },
) {
  try {
    const admin = await requireAdminRole(request, ["SUPER_ADMIN", "OPS"]);
    if ("error" in admin) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const { memberId, sessionId } = await context.params;
    const numericMemberId = Number(memberId);
    if (!Number.isInteger(numericMemberId) || numericMemberId <= 0 || !sessionId) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const success = await revokeMemberSession({
      memberId: numericMemberId,
      sessionId,
    });

    if (!success) {
      return NextResponse.json(
        { error: "세션을 종료하지 못했습니다." },
        { status: 404 },
      );
    }

    await createAdminAuditLogFromRequest(request, {
      adminId: Number(admin.admin_id),
      action: "MEMBER_SESSION_FORCE_LOGOUT",
      targetType: "MEMBER",
      targetId: numericMemberId,
      payload: { sessionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin member session revoke error:", error);
    return NextResponse.json(
      { error: "세션 강제 로그아웃 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
