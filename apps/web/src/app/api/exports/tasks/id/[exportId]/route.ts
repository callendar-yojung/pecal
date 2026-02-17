import { NextRequest, NextResponse } from "next/server";
import {
  revokeExport,
  updateExportExpiry,
  updateExportVisibility,
  type TaskExportVisibility,
} from "@/lib/task-export";
import { requireExportAccessById } from "@/lib/access";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ exportId: string }> }
) {
  const { exportId } = await params;
  const id = Number(exportId);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid export id" }, { status: 400 });
  }

  const access = await requireExportAccessById(request, id);
  if (access instanceof NextResponse) return access;

  const body = await request.json();
  const visibility = body?.visibility as TaskExportVisibility | undefined;
  const expiresAt =
    typeof body?.expires_at === "string" ? body.expires_at : null;
  const revoke = body?.revoke === true;

  if (visibility && visibility !== "public" && visibility !== "restricted") {
    return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
  }

  if (revoke) {
    await revokeExport(id);
    return NextResponse.json({ success: true, revoked: true });
  }

  if (visibility) {
    await updateExportVisibility(id, visibility);
  }

  if (body?.expires_at !== undefined) {
    await updateExportExpiry(id, expiresAt);
  }

  return NextResponse.json({ success: true });
}
