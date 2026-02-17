import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import {
  getWorkspaceById,
  updateWorkspaceName,
  deleteWorkspace,
  checkWorkspaceAccess,
} from "@/lib/workspace";
import { getTeamById, getPermissionsByMember } from "@/lib/team";

// GET /api/workspaces/[id] - 워크스페이스 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const workspaceId = Number(id);
    if (isNaN(workspaceId)) {
      return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 });
    }

    // 워크스페이스 접근 권한 확인
    const hasAccess = await checkWorkspaceAccess(workspaceId, user.memberId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workspace = await getWorkspaceById(workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    return NextResponse.json({ workspace });
  } catch (error) {
    console.error("Failed to fetch workspace:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspace" },
      { status: 500 }
    );
  }
}

// PATCH /api/workspaces/[id] - 워크스페이스 이름 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const workspaceId = Number(id);
    if (isNaN(workspaceId)) {
      return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 });
    }

    // 워크스페이스 접근 권한 확인
    const hasAccess = await checkWorkspaceAccess(workspaceId, user.memberId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Invalid workspace name" },
        { status: 400 }
      );
    }

    const workspace = await getWorkspaceById(workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    if (workspace.type === "team") {
      const team = await getTeamById(workspace.owner_id);
      if (!team) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 });
      }
      if (team.created_by !== user.memberId) {
        const permissions = await getPermissionsByMember(team.id, user.memberId);
        if (!permissions.includes("WORKSPACE_EDIT")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    const success = await updateWorkspaceName(workspaceId, name.trim());

    if (!success) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Workspace updated successfully",
    });
  } catch (error) {
    console.error("Failed to update workspace:", error);
    return NextResponse.json(
      { error: "Failed to update workspace" },
      { status: 500 }
    );
  }
}

// DELETE /api/workspaces/[id] - 워크스페이스 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const workspaceId = Number(id);
    if (isNaN(workspaceId)) {
      return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 });
    }

    // 워크스페이스 접근 권한 확인
    const hasAccess = await checkWorkspaceAccess(workspaceId, user.memberId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workspace = await getWorkspaceById(workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    if (workspace.type === "team") {
      const team = await getTeamById(workspace.owner_id);
      if (!team) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 });
      }
      if (team.created_by !== user.memberId) {
        const permissions = await getPermissionsByMember(team.id, user.memberId);
        if (!permissions.includes("WORKSPACE_DELETE")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    const success = await deleteWorkspace(workspaceId);
    if (!success) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Workspace deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete workspace:", error);
    return NextResponse.json(
      { error: "Failed to delete workspace" },
      { status: 500 }
    );
  }
}
