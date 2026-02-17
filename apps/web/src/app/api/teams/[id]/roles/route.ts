import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import {
  checkTeamMembership,
  createTeamRole,
  deleteTeamRole,
  getTeamById,
  getTeamRoleByName,
  getTeamRoles,
} from "@/lib/team";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const teamId = Number(id);
  if (Number.isNaN(teamId)) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }

  const isMember = await checkTeamMembership(teamId, user.memberId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roles = await getTeamRoles(teamId);
  return NextResponse.json({ roles });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const teamId = Number(id);
  if (Number.isNaN(teamId)) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }

  const team = await getTeamById(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  if (team.created_by !== user.memberId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (name.length > 50) {
    return NextResponse.json({ error: "name is too long" }, { status: 400 });
  }

  const existing = await getTeamRoleByName(teamId, name);
  if (existing) {
    return NextResponse.json({ error: "Role already exists" }, { status: 400 });
  }

  const roleId = await createTeamRole(teamId, name, user.memberId);
  return NextResponse.json({ success: true, role_id: roleId });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const teamId = Number(id);
  if (Number.isNaN(teamId)) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }

  const team = await getTeamById(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  if (team.created_by !== user.memberId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roleId = Number(request.nextUrl.searchParams.get("role_id"));
  if (!roleId) {
    return NextResponse.json(
      { error: "role_id is required" },
      { status: 400 }
    );
  }

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT name FROM team_roles WHERE team_id = ? AND team_role_id = ? LIMIT 1`,
    [teamId, roleId]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }
  if (rows[0].name === "Owner") {
    return NextResponse.json(
      { error: "Owner role cannot be deleted" },
      { status: 400 }
    );
  }

  const [memberRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM team_members WHERE team_role_id = ?`,
    [roleId]
  );
  if (Number(memberRows[0]?.count || 0) > 0) {
    return NextResponse.json(
      { error: "Role is in use" },
      { status: 400 }
    );
  }

  const success = await deleteTeamRole(teamId, roleId);
  return NextResponse.json({ success });
}
