import { type NextRequest, NextResponse } from "next/server";
import { createAdminAuditLogFromRequest } from "@/lib/admin-audit-log";
import { requireAdminRole } from "@/lib/admin-auth";
import { getMobileOpsData, updateMobileReleasePolicy } from "@/lib/admin-mobile-ops";

export async function GET(request: NextRequest) {
  const admin = await requireAdminRole(request, ["SUPER_ADMIN", "OPS", "BILLING"]);
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const data = await getMobileOpsData();
  return NextResponse.json({ success: true, ...data });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminRole(request, ["SUPER_ADMIN", "OPS"]);
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as {
    platform?: "ios" | "android";
    min_supported_version?: string | null;
    recommended_version?: string | null;
    force_update_enabled?: boolean;
    update_message?: string | null;
  };

  if (body.platform !== "ios" && body.platform !== "android") {
    return NextResponse.json({ error: "platform이 필요합니다." }, { status: 400 });
  }

  await updateMobileReleasePolicy({
    platform: body.platform,
    minSupportedVersion: body.min_supported_version ?? null,
    recommendedVersion: body.recommended_version ?? null,
    forceUpdateEnabled: body.force_update_enabled === true,
    updateMessage: body.update_message ?? null,
    updatedByAdminId: admin.admin_id,
  });

  await createAdminAuditLogFromRequest(request, {
    adminId: admin.admin_id,
    action: "MOBILE_RELEASE_POLICY_UPDATE",
    targetType: "MOBILE_RELEASE_POLICY",
    payload: {
      operation: "mobile_release_policy_update",
      platform: body.platform,
      min_supported_version: body.min_supported_version ?? null,
      recommended_version: body.recommended_version ?? null,
      force_update_enabled: body.force_update_enabled === true,
      update_message: body.update_message ?? null,
    },
  });

  return NextResponse.json({ success: true });
}
