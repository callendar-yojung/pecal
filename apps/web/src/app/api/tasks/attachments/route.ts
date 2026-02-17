import { NextRequest, NextResponse } from "next/server";
import {
  getTaskAttachments,
  attachFileToTask,
  detachFileFromTask,
  deleteTaskAttachment,
  getTaskAttachmentById,
} from "@/lib/task-attachment";
import { getFileById, deleteFileRecord } from "@/lib/file";
import { formatBytes } from "@/lib/storage";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { requireTaskAccess } from "@/lib/access";

// GET /api/tasks/attachments?task_id={taskId}
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get("task_id");

    if (!taskId) {
      return NextResponse.json(
        { error: "task_id is required" },
        { status: 400 }
      );
    }

    const access = await requireTaskAccess(request, Number(taskId));
    if (access instanceof NextResponse) return access;

    const attachments = await getTaskAttachments(Number(taskId));

    // 파일 크기 포맷 추가
    const formattedAttachments = attachments.map((att) => ({
      ...att,
      file_size_formatted: formatBytes(att.file_size),
    }));

    return NextResponse.json({ attachments: formattedAttachments });
  } catch (error) {
    console.error("Failed to fetch task attachments:", error);
    return NextResponse.json(
      { error: "Failed to fetch attachments" },
      { status: 500 }
    );
  }
}

// POST /api/tasks/attachments
// Body: { task_id: number, file_id: number }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { task_id, file_id } = body;

    if (!task_id || !file_id) {
      return NextResponse.json(
        { error: "task_id and file_id are required" },
        { status: 400 }
      );
    }

    const access = await requireTaskAccess(request, Number(task_id));
    if (access instanceof NextResponse) return access;

    // 파일 존재 여부 확인
    const file = await getFileById(Number(file_id));
    if (!file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    const attachmentId = await attachFileToTask(
      Number(task_id),
      Number(file_id),
      access.user.memberId
    );

    return NextResponse.json({
      success: true,
      attachment_id: attachmentId,
    });
  } catch (error) {
    console.error("Failed to attach file:", error);
    return NextResponse.json(
      { error: "Failed to attach file" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/attachments?task_id={taskId}&file_id={fileId}&delete_file={boolean}
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get("task_id");
    const fileId = searchParams.get("file_id");
    const attachmentId = searchParams.get("attachment_id");
    const deleteFile = searchParams.get("delete_file") === "true";

    if (attachmentId) {
      const attachment = await getTaskAttachmentById(Number(attachmentId));
      if (!attachment) {
        return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
      }
      const access = await requireTaskAccess(request, attachment.task_id);
      if (access instanceof NextResponse) return access;

      // attachment_id로 삭제
      const success = await deleteTaskAttachment(Number(attachmentId));
      return NextResponse.json({ success });
    }

    if (!taskId || !fileId) {
      return NextResponse.json(
        { error: "task_id and file_id (or attachment_id) are required" },
        { status: 400 }
      );
    }

    const access = await requireTaskAccess(request, Number(taskId));
    if (access instanceof NextResponse) return access;

    // 첨부 연결 해제
    const detached = await detachFileFromTask(Number(taskId), Number(fileId));

    // 파일도 삭제하는 경우
    if (deleteFile && detached) {
      const file = await getFileById(Number(fileId));
      if (file) {
        // 물리적 파일 삭제
        try {
          const physicalPath = path.join(process.cwd(), "public", file.file_path);
          await unlink(physicalPath);
        } catch {
          // 파일이 이미 없거나 삭제 실패해도 계속 진행
        }
        // DB 레코드 삭제
        await deleteFileRecord(Number(fileId));
      }
    }

    return NextResponse.json({ success: detached });
  } catch (error) {
    console.error("Failed to detach file:", error);
    return NextResponse.json(
      { error: "Failed to detach file" },
      { status: 500 }
    );
  }
}
