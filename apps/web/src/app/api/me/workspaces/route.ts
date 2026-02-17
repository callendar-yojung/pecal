import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { getWorkspacesPersonalAndTeamByMemberId } from "@/lib/workspace";

// GET /api/me/workspaces - 내 워크스페이스 목록 조회 (개인 + 소속 팀)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaces = await getWorkspacesPersonalAndTeamByMemberId(user.memberId);

    // personal workspace를 먼저, 그 다음 team workspaces
    const personals = workspaces.filter(w => w.type === "personal");
    const teams = workspaces.filter(w => w.type === "team");

    return NextResponse.json({
      workspaces: [...personals, ...teams]
    });
  } catch (error) {
    console.error("Failed to fetch workspaces:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspaces" },
      { status: 500 }
    );
  }
}
