import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { getTeamsByMemberId, createTeam } from "@/lib/team";

// GET /api/me/teams - 내 팀 목록 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teams = await getTeamsByMemberId(user.memberId);
    return NextResponse.json({ teams });
  } catch (error) {
    console.error("Failed to fetch teams:", error);
    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 }
    );
  }
}

// POST /api/me/teams - 새 팀 생성
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Invalid team name" },
        { status: 400 }
      );
    }

    const teamId = await createTeam(
      name.trim(),
      description && typeof description === "string" ? description.trim() : null,
      user.memberId
    );

    return NextResponse.json(
      {
        success: true,
        teamId,
        message: "Team created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create team:", error);
    return NextResponse.json(
      { error: "Failed to create team" },
      { status: 500 }
    );
  }
}