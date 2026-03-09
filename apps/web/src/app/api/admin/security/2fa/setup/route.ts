import { type NextRequest, NextResponse } from "next/server";
import { createAdminAuditLogFromRequest } from "@/lib/admin-audit-log";
import { requireAdminToken } from "@/lib/admin-auth";
import { prepareAdminTotpSetup } from "@/lib/admin-security";

export async function POST(request: NextRequest) {
  const admin = await requireAdminToken(request, { allowPasswordChangeOnly: true });
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const setup = await prepareAdminTotpSetup(Number(admin.admin_id), String(admin.username));

  await createAdminAuditLogFromRequest(request, {
    adminId: Number(admin.admin_id),
    action: "ADMIN_2FA_ENABLE",
    targetType: "ADMIN",
    targetId: Number(admin.admin_id),
    payload: { phase: "setup_requested" },
  });

  return NextResponse.json({ success: true, ...setup });
}
