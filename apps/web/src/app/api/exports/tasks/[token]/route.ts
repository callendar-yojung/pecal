import { NextRequest, NextResponse } from "next/server";
import { getTaskByIdWithNames } from "@/lib/task";
import { getTaskTagIds, getTagsByOwner } from "@/lib/tag";
import { getWorkspaceById } from "@/lib/workspace";
import { requireExportAccessByToken } from "@/lib/access";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const access = await requireExportAccessByToken(request, token);
  if (access instanceof NextResponse) return access;
  const { exportRecord } = access;

  const task = await getTaskByIdWithNames(exportRecord.task_id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const tagIds = await getTaskTagIds(task.id);
  const workspace = await getWorkspaceById(task.workspace_id);
  const tags =
    workspace && (workspace.type === "team" || workspace.type === "personal")
      ? await getTagsByOwner(workspace.type, workspace.owner_id)
      : [];

  return NextResponse.json({
    export: {
      visibility: exportRecord.visibility,
      created_at: exportRecord.created_at,
    },
    task: { ...task, tag_ids: tagIds },
    tags,
    workspace: workspace
      ? { type: workspace.type, owner_id: workspace.owner_id }
      : null,
  });
}
