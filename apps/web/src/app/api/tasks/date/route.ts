import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { getTasksByDate } from "@/lib/task";
import { checkWorkspaceAccess } from "@/lib/workspace";

// GET /api/tasks/date?workspace_id={id}&date={YYYY-MM-DD}
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get("workspace_id");
    const date = searchParams.get("date");

    if (!workspaceId || !date) {
      return NextResponse.json(
        { error: "workspace_id and date are required" },
        { status: 400 }
      );
    }

    // 워크스페이스 접근 권한 확인
    const hasAccess = await checkWorkspaceAccess(
      Number(workspaceId),
      user.memberId
    );

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tasks = await getTasksByDate(Number(workspaceId), date);
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("Failed to fetch tasks by date:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks by date" },
      { status: 500 }
    );
  }
}