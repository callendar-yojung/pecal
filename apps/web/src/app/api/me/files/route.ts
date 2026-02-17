import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { getWorkspaceById, checkWorkspaceAccess } from "@/lib/workspace";
import { getFilesByOwner, deleteFileRecord, getFileById } from "@/lib/file";
import type { OwnerType } from "@/lib/storage";
import { unlink } from "node:fs/promises";
import path from "node:path";

// 파일 스토리지에서 삭제 (S3 또는 로컬)
async function deleteFileFromStorage(filePath: string): Promise<void> {
  const { isS3Configured, extractS3KeyFromUrl, deleteFromS3 } = await import("@/lib/s3");
  if (isS3Configured()) {
    // S3에서 삭제
    const s3Key = extractS3KeyFromUrl(filePath);
    if (s3Key) {
      await deleteFromS3(s3Key);
    }
  } else {
    // 로컬 파일 시스템에서 삭제
    const localPath = path.join(process.cwd(), "public", filePath);
    await unlink(localPath);
  }
}

// GET /api/me/files?workspace_id={id}&page={page}&limit={limit}&type={type}
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get("workspace_id");
    const filterType = searchParams.get("type"); // "image", "document", "other"
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 24));

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

    // 전체 파일 목록 조회 (통계용)
    const allFiles = await getFilesByOwner(ownerType, ownerId);

    // 통계 계산 (필터 전)
    const allImages = allFiles.filter((f) => f.mime_type?.startsWith("image/"));
    const allDocuments = allFiles.filter(
      (f) =>
        f.mime_type?.includes("pdf") ||
        f.mime_type?.includes("document") ||
        f.mime_type?.includes("text") ||
        f.mime_type?.includes("spreadsheet") ||
        f.mime_type?.includes("presentation")
    );
    const allOthers = allFiles.filter(
      (f) =>
        !f.mime_type?.startsWith("image/") &&
        !f.mime_type?.includes("pdf") &&
        !f.mime_type?.includes("document") &&
        !f.mime_type?.includes("text") &&
        !f.mime_type?.includes("spreadsheet") &&
        !f.mime_type?.includes("presentation")
    );

    // 타입별 필터링
    let filteredFiles = allFiles;
    if (filterType) {
      filteredFiles = allFiles.filter((file) => {
        const mimeType = file.mime_type || "";
        switch (filterType) {
          case "image":
            return mimeType.startsWith("image/");
          case "document":
            return (
              mimeType.includes("pdf") ||
              mimeType.includes("document") ||
              mimeType.includes("text") ||
              mimeType.includes("spreadsheet") ||
              mimeType.includes("presentation")
            );
          case "other":
            return (
              !mimeType.startsWith("image/") &&
              !mimeType.includes("pdf") &&
              !mimeType.includes("document")
            );
          default:
            return true;
        }
      });
    }

    // 페이징
    const total = filteredFiles.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedFiles = filteredFiles.slice(offset, offset + limit);

    return NextResponse.json({
      files: paginatedFiles,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      stats: {
        total: allFiles.length,
        images: allImages.length,
        documents: allDocuments.length,
        others: allOthers.length,
      },
    });
  } catch (error) {
    console.error("Failed to fetch files:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}

// POST /api/me/files - Bulk delete
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, file_ids, workspace_id } = body;

    if (action !== "bulk_delete") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (!file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
      return NextResponse.json(
        { error: "file_ids array is required" },
        { status: 400 }
      );
    }

    if (!workspace_id) {
      return NextResponse.json(
        { error: "workspace_id is required" },
        { status: 400 }
      );
    }

    // 워크스페이스 접근 권한 확인
    const hasAccess = await checkWorkspaceAccess(
      Number(workspace_id),
      user.memberId
    );

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 워크스페이스 정보 조회
    const workspace = await getWorkspaceById(Number(workspace_id));
    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    const deleted: number[] = [];
    const failed: number[] = [];

    for (const fileId of file_ids) {
      try {
        // 파일 정보 조회
        const file = await getFileById(Number(fileId));
        if (!file) {
          failed.push(fileId);
          continue;
        }

        // 파일이 해당 워크스페이스에 속하는지 확인
        if (
          file.owner_type !== workspace.type ||
          file.owner_id !== workspace.owner_id
        ) {
          failed.push(fileId);
          continue;
        }

        // 스토리지에서 파일 삭제 시도 (S3 또는 로컬)
        try {
          await deleteFileFromStorage(file.file_path);
        } catch (storageError) {
          console.error("Failed to delete file from storage:", storageError);
          // 스토리지 삭제 실패해도 DB 레코드는 삭제 진행
        }

        // DB에서 파일 레코드 삭제
        const success = await deleteFileRecord(Number(fileId));
        if (success) {
          deleted.push(fileId);
        } else {
          failed.push(fileId);
        }
      } catch (error) {
        console.error(`Failed to delete file ${fileId}:`, error);
        failed.push(fileId);
      }
    }

    return NextResponse.json({
      success: true,
      deleted,
      failed,
      message: `${deleted.length} files deleted, ${failed.length} failed`,
    });
  } catch (error) {
    console.error("Failed to bulk delete files:", error);
    return NextResponse.json(
      { error: "Failed to delete files" },
      { status: 500 }
    );
  }
}

// DELETE /api/me/files?file_id={id}&workspace_id={id}
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get("file_id");
    const workspaceId = searchParams.get("workspace_id");

    if (!fileId || !workspaceId) {
      return NextResponse.json(
        { error: "file_id and workspace_id are required" },
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

    // 파일 정보 조회
    const file = await getFileById(Number(fileId));
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // 워크스페이스 소유자 확인
    const workspace = await getWorkspaceById(Number(workspaceId));
    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // 파일이 해당 워크스페이스에 속하는지 확인
    if (
      file.owner_type !== workspace.type ||
      file.owner_id !== workspace.owner_id
    ) {
      return NextResponse.json(
        { error: "File does not belong to this workspace" },
        { status: 403 }
      );
    }

    // 스토리지에서 파일 삭제 시도 (S3 또는 로컬)
    try {
      await deleteFileFromStorage(file.file_path);
    } catch (storageError) {
      console.error("Failed to delete file from storage:", storageError);
      // 스토리지 삭제 실패해도 DB 레코드는 삭제 진행
    }

    // DB에서 파일 레코드 삭제
    const success = await deleteFileRecord(Number(fileId));
    if (!success) {
      return NextResponse.json(
        { error: "Failed to delete file" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "File deleted" });
  } catch (error) {
    console.error("Failed to delete file:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
