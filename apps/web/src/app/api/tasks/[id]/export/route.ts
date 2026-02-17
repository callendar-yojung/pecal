import { NextRequest, NextResponse } from "next/server";
import { requireTaskAccess } from "@/lib/access";
import { createTaskExport, type TaskExportVisibility } from "@/lib/task-export";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const taskId = Number(id);
  if (Number.isNaN(taskId)) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
  }

  const access = await requireTaskAccess(request, taskId);
  if (access instanceof NextResponse) return access;
  const { user } = access;

  const body = await request.json();
  const visibility = body?.visibility as TaskExportVisibility;
  const expiresAt = typeof body?.expires_at === "string" ? body.expires_at : null;

  if (visibility !== "public" && visibility !== "restricted") {
    return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
  }

  const record = await createTaskExport({
    taskId,
    createdBy: user.memberId,
    visibility,
    expiresAt,
  });

  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  const locale = cookieLocale === "ko" || cookieLocale === "en" ? cookieLocale : "en";
  const path = `/${locale}/export/tasks/${record.token}`;
  const url = `${request.nextUrl.origin}${path}`;

  return NextResponse.json({ token: record.token, url, path });
}
