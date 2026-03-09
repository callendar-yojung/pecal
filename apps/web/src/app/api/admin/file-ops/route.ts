import { type NextRequest, NextResponse } from "next/server";
import { createAdminAuditLogFromRequest } from "@/lib/admin-audit-log";
import { requireAdminRole } from "@/lib/admin-auth";
import {
  cleanupOrphanFiles,
  getFileOperationsOverview,
  recalculateStorageForAllOwners,
} from "@/lib/admin-file-ops";

export async function GET(request: NextRequest) {
  const admin = await requireAdminRole(request, ["SUPER_ADMIN", "OPS"]);
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const overview = await getFileOperationsOverview();
  return NextResponse.json({ success: true, ...overview });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminRole(request, ["SUPER_ADMIN", "OPS"]);
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as {
    action?: "cleanup_orphan_files" | "recalculate_storage";
    dry_run?: boolean;
    limit?: number;
  };

  if (body.action === "cleanup_orphan_files") {
    const result = await cleanupOrphanFiles(body.limit ?? 100, body.dry_run !== false);
    await createAdminAuditLogFromRequest(request, {
      adminId: admin.admin_id,
      action: "FILE_ORPHAN_CLEANUP",
      targetType: "FILE",
      payload: { operation: "cleanup_orphan_files", ...result, dryRun: body.dry_run !== false },
    });
    return NextResponse.json({ success: true, result });
  }

  if (body.action === "recalculate_storage") {
    const result = await recalculateStorageForAllOwners();
    await createAdminAuditLogFromRequest(request, {
      adminId: admin.admin_id,
      action: "STORAGE_RECALCULATE",
      targetType: "FILE",
      payload: { operation: "recalculate_storage", ...result },
    });
    return NextResponse.json({ success: true, result });
  }

  return NextResponse.json({ error: "지원하지 않는 액션입니다." }, { status: 400 });
}
