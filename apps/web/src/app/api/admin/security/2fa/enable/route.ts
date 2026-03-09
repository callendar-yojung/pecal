import { type NextRequest, NextResponse } from "next/server";
import { createAdminAuditLogFromRequest } from "@/lib/admin-audit-log";
import { requireAdminToken } from "@/lib/admin-auth";
import { enableAdminTotp } from "@/lib/admin-security";

export async function POST(request: NextRequest) {
  const admin = await requireAdminToken(request, { allowPasswordChangeOnly: true });
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as { code?: string };
  const code = body.code?.trim() ?? "";
  if (!code) {
    return NextResponse.json({ error: "인증 코드를 입력해주세요." }, { status: 400 });
  }

  const result = await enableAdminTotp(Number(admin.admin_id), code);
  if (!result.success) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  await createAdminAuditLogFromRequest(request, {
    adminId: Number(admin.admin_id),
    action: "ADMIN_2FA_ENABLE",
    targetType: "ADMIN",
    targetId: Number(admin.admin_id),
    payload: { phase: "enabled" },
  });

  return NextResponse.json({ success: true });
}
