import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import {
  getStorageUsageByTeamId,
  initializeStorageUsageForTeam,
  updateStorageUsage,
  recalculateStorageUsageForTeam,
  checkStorageLimit,
  deleteStorageUsageForTeam,
} from "@/lib/storage";

// GET /api/storage?team_id=1 - 팀의 저장소 사용량 조회
// GET /api/storage?team_id=1&check_limit=100 - 용량 추가 가능 여부 확인
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamIdParam = searchParams.get("team_id");
    const checkLimitParam = searchParams.get("check_limit");

    if (!teamIdParam) {
      return NextResponse.json({ error: "team_id is required" }, { status: 400 });
    }

    const teamId = Number(teamIdParam);

    if (checkLimitParam) {
      const additionalMb = Number(checkLimitParam);
      const result = await checkStorageLimit(teamId, additionalMb);
      return NextResponse.json(result);
    }

    const storageUsage = await getStorageUsageByTeamId(teamId);
    return NextResponse.json(storageUsage);
  } catch (error) {
    console.error("Error fetching storage usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch storage usage" },
      { status: 500 }
    );
  }
}

// POST /api/storage - 저장소 사용량 초기화 또는 재계산
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { team_id, action } = body;

    if (!team_id) {
      return NextResponse.json({ error: "team_id is required" }, { status: 400 });
    }

    const teamId = Number(team_id);

    if (action === "recalculate") {
      const recalculatedSize = await recalculateStorageUsageForTeam(teamId);
      const storageUsage = await getStorageUsageByTeamId(teamId);
      return NextResponse.json({ ...storageUsage, recalculated_size: recalculatedSize });
    }

    await initializeStorageUsageForTeam(teamId);
    const storageUsage = await getStorageUsageByTeamId(teamId);
    return NextResponse.json(storageUsage);
  } catch (error) {
    console.error("Error initializing storage usage:", error);
    return NextResponse.json(
      { error: "Failed to initialize storage usage" },
      { status: 500 }
    );
  }
}

// PUT /api/storage - 저장소 사용량 수정
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { team_id, used_storage_mb } = body;

    if (!team_id || used_storage_mb === undefined) {
      return NextResponse.json(
        { error: "team_id and used_storage_mb are required" },
        { status: 400 }
      );
    }

    const success = await updateStorageUsage(Number(team_id), Number(used_storage_mb));
    if (!success) {
      return NextResponse.json({ error: "Storage usage not found" }, { status: 404 });
    }

    const storageUsage = await getStorageUsageByTeamId(Number(team_id));
    return NextResponse.json(storageUsage);
  } catch (error) {
    console.error("Error updating storage usage:", error);
    return NextResponse.json(
      { error: "Failed to update storage usage" },
      { status: 500 }
    );
  }
}

// DELETE /api/storage?team_id=1 - 저장소 사용량 삭제
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamIdParam = searchParams.get("team_id");

    if (!teamIdParam) {
      return NextResponse.json({ error: "team_id is required" }, { status: 400 });
    }

    const success = await deleteStorageUsageForTeam(Number(teamIdParam));
    if (!success) {
      return NextResponse.json({ error: "Storage usage not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Storage usage deleted successfully" });
  } catch (error) {
    console.error("Error deleting storage usage:", error);
    return NextResponse.json(
      { error: "Failed to delete storage usage" },
      { status: 500 }
    );
  }
}
