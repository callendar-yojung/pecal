import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { checkTeamMembership } from "@/lib/team";

// GET /api/workspaces/team/[id] - 특정 팀의 워크스페이스 목록 조회
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
    const teamId = Number(id);
    if (isNaN(teamId)) {
      return NextResponse.json({ error: "Invalid team ID" }, { status: 400 });
    }

    const isMember = await checkTeamMembership(teamId, user.memberId);
    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT
           w.workspace_id,
           w.type,
           w.owner_id,
           w.name,
           w.created_at,
           w.created_by,
           (SELECT COUNT(*) FROM team_members WHERE team_id = w.owner_id) AS memberCount
         FROM workspaces w
         WHERE w.type = 'team' AND w.owner_id = ?
         ORDER BY w.created_at ASC`,
        [teamId]
    );

    return NextResponse.json({ workspaces: rows });
  } catch (error) {
    console.error("Failed to fetch team workspaces:", error);
    return NextResponse.json(
        { error: "Failed to fetch team workspaces" },
        { status: 500 }
    );
  }
}
