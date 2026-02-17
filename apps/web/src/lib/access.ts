import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, type AuthUser } from "@/lib/auth-helper";
import { checkTeamMembership } from "@/lib/team";
import { checkWorkspaceAccess } from "@/lib/workspace";
import { getTaskById, type Task } from "@/lib/task";
import {
  jsonForbidden,
  jsonGone,
  jsonNotFound,
  jsonUnauthorized,
} from "@/lib/api-response";
import {
  getTaskExportByToken,
  getTaskExportWithTask,
  hasExportAccess,
  type TaskExportRecord,
} from "@/lib/task-export";
import type { MemoOwnerType } from "@/lib/memo";

type AuthResult = { user: AuthUser } | NextResponse;
type TaskAccessResult = { user: AuthUser; task: Task } | NextResponse;
type ExportTokenAccessResult =
  | { user: AuthUser | null; exportRecord: TaskExportRecord }
  | NextResponse;
type ExportIdAccessResult =
  | { user: AuthUser; exportRecord: TaskExportRecord; workspaceId: number }
  | NextResponse;

export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const user = await getAuthUser(request);
  if (!user) return jsonUnauthorized();
  return { user };
}

export async function requireWorkspaceAccess(
  request: NextRequest,
  workspaceId: number
): Promise<AuthResult> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const hasAccess = await checkWorkspaceAccess(workspaceId, auth.user.memberId);
  if (!hasAccess) return jsonForbidden();
  return auth;
}

export async function requireTeamMembership(
  request: NextRequest,
  teamId: number
): Promise<AuthResult> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const isMember = await checkTeamMembership(teamId, auth.user.memberId);
  if (!isMember) return jsonForbidden();
  return auth;
}

export async function requireOwnerAccess(
  request: NextRequest,
  ownerType: MemoOwnerType,
  ownerId: number
): Promise<AuthResult> {
  if (ownerType === "personal") {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (auth.user.memberId !== ownerId) {
      return jsonForbidden();
    }
    return auth;
  }

  return requireTeamMembership(request, ownerId);
}

export async function requireTaskAccess(
  request: NextRequest,
  taskId: number
): Promise<TaskAccessResult> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const task = await getTaskById(taskId);
  if (!task) return jsonNotFound("Task not found");

  const hasAccess = await checkWorkspaceAccess(
    task.workspace_id,
    auth.user.memberId
  );
  if (!hasAccess) return jsonForbidden();

  return { user: auth.user, task };
}

export async function requireExportAccessByToken(
  request: NextRequest,
  token: string
): Promise<ExportTokenAccessResult> {
  const exportRecord = await getTaskExportByToken(token);
  if (!exportRecord) return jsonNotFound("Export not found");

  if (exportRecord.revoked_at) return jsonGone("Export revoked");
  if (exportRecord.expires_at && new Date(exportRecord.expires_at) < new Date()) {
    return jsonGone("Export expired");
  }

  if (exportRecord.visibility === "restricted") {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const allowed = await hasExportAccess(exportRecord.export_id, auth.user.memberId);
    if (!allowed) {
      return jsonForbidden();
    }
    return { user: auth.user, exportRecord };
  }

  return { user: null, exportRecord };
}

export async function requireExportAccessById(
  request: NextRequest,
  exportId: number
): Promise<ExportIdAccessResult> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const exportInfo = await getTaskExportWithTask(exportId);
  if (!exportInfo) return jsonNotFound("Export not found");

  const hasAccess = await checkWorkspaceAccess(
    exportInfo.workspace_id,
    auth.user.memberId
  );
  if (!hasAccess) return jsonForbidden();

  return {
    user: auth.user,
    exportRecord: exportInfo.export,
    workspaceId: exportInfo.workspace_id,
  };
}
