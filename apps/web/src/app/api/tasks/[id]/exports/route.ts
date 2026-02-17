import { NextRequest, NextResponse } from "next/server";
import { requireTaskAccess } from "@/lib/access";
import { getTaskExportsForTask } from "@/lib/task-export";

export async function GET(
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

  const exportsList = await getTaskExportsForTask(taskId);
  return NextResponse.json({ exports: exportsList });
}
