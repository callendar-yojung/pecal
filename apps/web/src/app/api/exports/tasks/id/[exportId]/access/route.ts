import { NextRequest, NextResponse } from "next/server";
import { findMemberById } from "@/lib/member";
import { addExportAccess, removeExportAccess } from "@/lib/task-export";
import { requireExportAccessById } from "@/lib/access";
import { checkWorkspaceAccess } from "@/lib/workspace";

export async function POST(
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
  const { workspaceId } = access;

  const body = await request.json();
  const memberId = Number(body?.member_id);
  if (!memberId || Number.isNaN(memberId)) {
    return NextResponse.json({ error: "member_id is required" }, { status: 400 });
  }

  const member = await findMemberById(memberId);
  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const memberHasAccess = await checkWorkspaceAccess(workspaceId, memberId);
  if (!memberHasAccess) {
    return NextResponse.json(
      { error: "Member is not part of this workspace" },
      { status: 400 }
    );
  }

  await addExportAccess(id, memberId);
  return NextResponse.json({ success: true });
}

export async function DELETE(
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

  const memberIdParam = request.nextUrl.searchParams.get("member_id");
  const memberId = Number(memberIdParam);
  if (!memberId || Number.isNaN(memberId)) {
    return NextResponse.json({ error: "member_id is required" }, { status: 400 });
  }

  const removed = await removeExportAccess(id, memberId);
  return NextResponse.json({ success: removed });
}
