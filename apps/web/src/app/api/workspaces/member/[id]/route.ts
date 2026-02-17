import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { getWorkspacesByMemberId } from "@/lib/workspace";

// GET /api/workspaces/member/[id] - 특정 회원의 워크스페이스 목록 조회
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const targetMemberId = Number(id);

    if (isNaN(targetMemberId)) {
      return NextResponse.json({ error: "Invalid member ID" }, { status: 400 });
    }

    // 본인 또는 같은 팀 멤버만 조회 가능
    if (user.memberId !== targetMemberId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workspaces = await getWorkspacesByMemberId(targetMemberId);
    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error("Failed to fetch member workspaces:", error);
    return NextResponse.json(
      { error: "Failed to fetch member workspaces" },
      { status: 500 }
    );
  }
}