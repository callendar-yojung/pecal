import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import {
  createPersonalWorkspace,
  createTeamWorkspace,
  getWorkspaceById,
} from "@/lib/workspace";
import { getTeamById, getPermissionsByMember } from "@/lib/team";

// POST /api/workspaces - 새 워크스페이스 생성
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, owner_id } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Workspace name is required" },
        { status: 400 }
      );
    }

    if (!type || !["personal", "team"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid workspace type. Must be 'personal' or 'team'" },
        { status: 400 }
      );
    }

    if (!owner_id || typeof owner_id !== "number") {
      return NextResponse.json(
        { error: "Owner ID is required" },
        { status: 400 }
      );
    }

    let workspaceId: number;

    if (type === "personal") {
      // Personal workspace: owner_id should be the current user's member_id
      if (owner_id !== user.memberId) {
        return NextResponse.json(
          { error: "Cannot create personal workspace for another user" },
          { status: 403 }
        );
      }

      workspaceId = await createPersonalWorkspace(owner_id, name.trim());
    } else {
      // Team workspace: owner_id is the team_id
      const team = await getTeamById(owner_id);
      if (!team) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 });
      }
      if (team.created_by !== user.memberId) {
        const permissions = await getPermissionsByMember(team.id, user.memberId);
        if (!permissions.includes("WORKSPACE_CREATE")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
      workspaceId = await createTeamWorkspace(
        owner_id,
        name.trim(),
        user.memberId
      );
    }

    // Fetch the created workspace to return
    const workspace = await getWorkspaceById(workspaceId);

    return NextResponse.json(
      { workspace, message: "Workspace created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create workspace:", error);
    return NextResponse.json(
      { error: "Failed to create workspace" },
      { status: 500 }
    );
  }
}
