import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { getTeamById } from "@/lib/team";
import { getRolePermissionsByRoleId, setRolePermissions } from "@/lib/team";
import { isValidPermissionCode } from "@/lib/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, roleId } = await params;
  const teamId = Number(id);
  const roleIdValue = Number(roleId);
  if (Number.isNaN(teamId) || Number.isNaN(roleIdValue)) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }

  const team = await getTeamById(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  if (team.created_by !== user.memberId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const permissions = await getRolePermissionsByRoleId(teamId, roleIdValue);
  return NextResponse.json({ permissions });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, roleId } = await params;
  const teamId = Number(id);
  const roleIdValue = Number(roleId);
  if (Number.isNaN(teamId) || Number.isNaN(roleIdValue)) {
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
  const codes: string[] | null = Array.isArray(body?.codes)
    ? body.codes.filter((code: unknown): code is string => typeof code === "string")
    : null;
  if (!codes) {
    return NextResponse.json({ error: "codes is required" }, { status: 400 });
  }

  const normalized = Array.from(new Set(codes.map((code: string) => code.trim()))).filter(
    (code) => code.length > 0
  );
  if (normalized.some((code) => !isValidPermissionCode(code))) {
    return NextResponse.json(
      { error: "Invalid permission code" },
      { status: 400 }
    );
  }

  try {
    const success = await setRolePermissions(teamId, roleIdValue, normalized);
    return NextResponse.json({ success });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update permissions" }, { status: 400 });
  }
}
