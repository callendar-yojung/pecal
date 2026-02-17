import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireOwnerAccess, requireTeamMembership } from "@/lib/access";
import {
  getFilesByTeamId,
  getFileById,
  createFile,
  updateFile,
  deleteFile,
  getTotalFileSizeByTeamId,
} from "@/lib/file";
import { checkStorageLimit } from "@/lib/storage";

// GET /api/files?team_id=1 - 팀의 모든 파일 조회
// GET /api/files?id=1 - 특정 파일 조회
// GET /api/files?team_id=1&total_size=true - 팀의 총 파일 크기 조회
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const teamIdParam = searchParams.get("team_id");
    const fileIdParam = searchParams.get("id");
    const totalSize = searchParams.get("total_size");

    if (totalSize && teamIdParam) {
      const access = await requireTeamMembership(request, Number(teamIdParam));
      if (access instanceof NextResponse) return access;
      // 팀의 총 파일 크기 조회
      const totalFileSize = await getTotalFileSizeByTeamId(Number(teamIdParam));
      return NextResponse.json({ totalFileSize });
    }

    if (fileIdParam) {
      // 특정 파일 조회
      const file = await getFileById(Number(fileIdParam));
      if (!file) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      const access = await requireOwnerAccess(request, file.owner_type, file.owner_id);
      if (access instanceof NextResponse) return access;
      return NextResponse.json(file);
    }

    if (!teamIdParam) {
      return NextResponse.json({ error: "team_id is required" }, { status: 400 });
    }

    const access = await requireTeamMembership(request, Number(teamIdParam));
    if (access instanceof NextResponse) return access;

    // 팀의 모든 파일 조회
    const files = await getFilesByTeamId(Number(teamIdParam));
    return NextResponse.json(files);
  } catch (error) {
    console.error("Error fetching files:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}

// POST /api/files - 새 파일 생성
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { team_id, file_name, file_size_mb } = body;

    if (!team_id || !file_name || file_size_mb === undefined) {
      return NextResponse.json(
        { error: "team_id, file_name, file_size_mb are required" },
        { status: 400 }
      );
    }

    // 스토리지 용량 초과 체크
    const storageCheck = await checkStorageLimit(Number(team_id), Number(file_size_mb));
    if (!storageCheck.allowed) {
      return NextResponse.json(
        {
          error: "Storage limit exceeded",
          current: storageCheck.current,
          limit: storageCheck.limit,
          required: Number(file_size_mb)
        },
        { status: 403 }
      );
    }

    // 파일 생성
    const fileId = await createFile(Number(team_id), file_name, Number(file_size_mb));
    return NextResponse.json({ id: fileId, message: "File created successfully" }, { status: 201 });
  } catch (error) {
    console.error("Error creating file:", error);
    return NextResponse.json(
      { error: "Failed to create file" },
      { status: 500 }
    );
  }
}

// PUT /api/files - 파일 정보 수정
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { id, file_name } = body;

    if (!id || !file_name) {
      return NextResponse.json(
        { error: "id and file_name are required" },
        { status: 400 }
      );
    }

    // 파일 정보 수정
    const file = await getFileById(Number(id));
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    const access = await requireOwnerAccess(request, file.owner_type, file.owner_id);
    if (access instanceof NextResponse) return access;

    const success = await updateFile(Number(id), file_name);
    if (!success) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "File updated successfully" });
  } catch (error) {
    console.error("Error updating file:", error);
    return NextResponse.json(
      { error: "Failed to update file" },
      { status: 500 }
    );
  }
}

// DELETE /api/files?id=1 - 파일 삭제
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const fileIdParam = searchParams.get("id");

    if (!fileIdParam) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const file = await getFileById(Number(fileIdParam));
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    const access = await requireOwnerAccess(request, file.owner_type, file.owner_id);
    if (access instanceof NextResponse) return access;

    // 파일 삭제
    const success = await deleteFile(Number(fileIdParam));
    if (!success) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
