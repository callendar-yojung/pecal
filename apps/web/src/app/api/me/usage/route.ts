import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { getWorkspaceById, checkWorkspaceAccess } from "@/lib/workspace";
import { getStorageLimitInfo, formatBytes, type OwnerType } from "@/lib/storage";
import { getTaskStatsByWorkspace, getTotalTaskCount } from "@/lib/task";
import { getActivePlanForOwner } from "@/lib/storage";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";

// GET /api/me/usage?workspace_id={id}
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get("workspace_id");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspace_id is required" },
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

    // 워크스페이스 정보 조회
    const workspace = await getWorkspaceById(Number(workspaceId));
    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    const ownerType: OwnerType = workspace.type;
    const ownerId = workspace.owner_id;

    // 스토리지 사용량 조회
    const storageInfo = await getStorageLimitInfo(ownerType, ownerId);

    // 플랜 정보 조회
    const planInfo = await getActivePlanForOwner(ownerType, ownerId);

    // 태스크 통계 조회
    const taskStats = await getTaskStatsByWorkspace(Number(workspaceId));
    const totalTasks = await getTotalTaskCount(Number(workspaceId));

    // 팀 멤버 수 조회 (팀 워크스페이스인 경우)
    let memberCount = 1;
    let maxMembers = planInfo.max_members;

    if (workspace.type === "team") {
      const [memberRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM team_members WHERE team_id = ?`,
        [ownerId]
      );
      memberCount = Number(memberRows[0]?.count || 1);
    }

    // 파일 수 조회
    const [fileRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM files WHERE owner_type = ? AND owner_id = ?`,
      [ownerType, ownerId]
    );
    const fileCount = Number(fileRows[0]?.count || 0);

    // 사용률 계산
    const storagePercentage = storageInfo.limit_bytes > 0
      ? Math.round((storageInfo.used_bytes / storageInfo.limit_bytes) * 100)
      : 0;

    const memberPercentage = maxMembers > 0
      ? Math.round((memberCount / maxMembers) * 100)
      : 0;

    return NextResponse.json({
      workspace: {
        id: workspace.workspace_id,
        name: workspace.name,
        type: workspace.type,
      },
      plan: {
        name: planInfo.name,
        max_storage_mb: planInfo.max_storage_mb,
        max_file_size_mb: planInfo.max_file_size_mb,
        max_members: planInfo.max_members,
      },
      storage: {
        used_bytes: storageInfo.used_bytes,
        limit_bytes: storageInfo.limit_bytes,
        used_formatted: formatBytes(storageInfo.used_bytes),
        limit_formatted: formatBytes(storageInfo.limit_bytes),
        percentage: storagePercentage,
        file_count: fileCount,
      },
      members: {
        current: memberCount,
        max: maxMembers,
        percentage: memberPercentage,
      },
      tasks: {
        total: totalTasks,
        thisMonth: {
          created: taskStats.tasksCreated,
          completed: taskStats.tasksCompleted,
          todo: taskStats.tasksTodo,
          inProgress: taskStats.tasksInProgress,
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch usage data:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage data" },
      { status: 500 }
    );
  }
}
