import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import {
  addTeamMember,
  checkTeamMembership,
  getTeamById,
  getTeamMembers,
  removeTeamMember,
  updateTeamMemberRole,
} from "@/lib/team";
import { findMemberByEmailOrNickname } from "@/lib/member";
import { getActivePlanForOwner } from "@/lib/storage";
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

  const members = await getTeamMembers(teamId);
  return NextResponse.json({ members });
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
  const { identifier, role_id: roleId } = body;
  if (!identifier || typeof identifier !== "string") {
    return NextResponse.json(
      { error: "identifier is required" },
      { status: 400 }
    );
  }

  const member = await findMemberByEmailOrNickname(identifier);
  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const alreadyMember = await checkTeamMembership(teamId, member.member_id);
  if (alreadyMember) {
    return NextResponse.json({ error: "Already a member" }, { status: 400 });
  }

  const planInfo = await getActivePlanForOwner("team", teamId);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM team_members WHERE team_id = ?`,
    [teamId]
  );
  const currentCount = Number(rows[0]?.count || 0);

  if (currentCount >= planInfo.max_members) {
    return NextResponse.json(
      { error: "Member limit reached" },
      { status: 400 }
    );
  }

  const roleIdValue =
    typeof roleId === "number" && Number.isFinite(roleId)
      ? roleId
      : null;
  try {
    const added = await addTeamMember(
      teamId,
      member.member_id,
      user.memberId,
      roleIdValue
    );
    return NextResponse.json({ success: added });
  } catch (error) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
}

export async function PATCH(
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
  const memberId = Number(body?.member_id);
  const roleId = Number(body?.role_id);
  if (!memberId || !roleId) {
    return NextResponse.json(
      { error: "member_id and role_id are required" },
      { status: 400 }
    );
  }

  if (memberId === team.created_by) {
    return NextResponse.json(
      { error: "Owner role cannot be changed" },
      { status: 400 }
    );
  }

  try {
    const updated = await updateTeamMemberRole(teamId, memberId, roleId);
    return NextResponse.json({ success: updated });
  } catch (error) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
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

  const searchParams = request.nextUrl.searchParams;
  const memberId = Number(searchParams.get("member_id"));
  if (!memberId) {
    return NextResponse.json(
      { error: "member_id is required" },
      { status: 400 }
    );
  }

  if (memberId === team.created_by) {
    return NextResponse.json(
      { error: "Owner cannot be removed" },
      { status: 400 }
    );
  }

  const removed = await removeTeamMember(teamId, memberId);
  return NextResponse.json({ success: removed });
}
