import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { requireOwnerAccess } from "@/lib/access";
import { jsonError, jsonServerError, jsonSuccess } from "@/lib/api-response";
import { createFileRecord } from "@/lib/file";
import { createOpsEvent } from "@/lib/ops-event-log";
import { canUploadFile, formatBytes, type OwnerType } from "@/lib/storage";

// 위험한 실행/스크립트 성격 파일은 차단하고, 그 외는 허용한다.
const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".msi",
  ".dll",
  ".com",
  ".scr",
  ".bat",
  ".cmd",
  ".ps1",
  ".vbs",
  ".js",
  ".mjs",
  ".cjs",
  ".jar",
  ".apk",
  ".app",
  ".dmg",
  ".iso",
  ".php",
  ".phtml",
  ".sh",
  ".zsh",
  ".bash",
  ".ksh",
  ".csh",
  ".html",
  ".htm",
  ".xhtml",
  ".svg",
  ".svgz",
]);

const BLOCKED_MIME_TYPES = new Set([
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/vnd.microsoft.portable-executable",
  "application/x-dosexec",
  "application/x-sh",
  "application/x-bat",
  "application/x-csh",
  "application/x-httpd-php",
  "application/javascript",
  "text/javascript",
  "text/html",
  "image/svg+xml",
]);

function isBlockedUpload(file: File): boolean {
  const ext = path.extname(file.name || "").toLowerCase();
  const mime = (file.type || "").toLowerCase();
  return BLOCKED_EXTENSIONS.has(ext) || BLOCKED_MIME_TYPES.has(mime);
}
// POST /api/files/upload
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const ownerType = formData.get("owner_type") as OwnerType;
    const ownerId = formData.get("owner_id") as string;
    const taskId = formData.get("task_id") as string | null; // 선택적: 태스크에 바로 첨부

    if (!file) {
      return jsonError("No file provided", 400);
    }

    if (!ownerType || !ownerId) {
      return jsonError("owner_type and owner_id are required", 400);
    }

    if (!["team", "personal"].includes(ownerType)) {
      return jsonError("Invalid owner_type. Must be 'team' or 'personal'", 400);
    }

    const access = await requireOwnerAccess(
      request,
      ownerType,
      Number(ownerId),
    );
    if (access instanceof Response) return access;
    const { user } = access;

    // 파일 타입 검증(위험 파일 차단)
    if (isBlockedUpload(file)) {
      return jsonError(
        `Blocked file type: ${file.type || "unknown"} (${path.extname(file.name || "").toLowerCase() || "no-ext"})`,
        400,
      );
    }

    const fileSizeBytes = file.size;

    // 용량 체크
    const uploadCheck = await canUploadFile(
      ownerType,
      Number(ownerId),
      fileSizeBytes,
    );
    if (!uploadCheck.allowed) {
      await createOpsEvent({
        eventType: "FILE_UPLOAD_FAILURE",
        status: "failure",
        payload: {
          reason: "LIMIT_EXCEEDED",
          ownerType,
          ownerId: Number(ownerId),
          fileName: file.name,
          fileSizeBytes,
          limitBytes: uploadCheck.limit_bytes ?? null,
          maxFileSizeBytes: uploadCheck.max_file_size_bytes ?? null,
        },
      });
      return jsonError(
        uploadCheck.reason || "Upload limit exceeded",
        403,
        "LIMIT_EXCEEDED",
        {
          used_bytes: uploadCheck.used_bytes,
          limit_bytes: uploadCheck.limit_bytes,
          max_file_size_bytes: uploadCheck.max_file_size_bytes,
        },
      );
    }

    // 파일 저장 경로 생성
    const fileExt = path.extname(file.name);
    const storedName = `${uuidv4()}${fileExt}`;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let publicPath: string;

    // S3가 설정되어 있으면 S3에 업로드, 아니면 로컬 파일 시스템 사용
    const { isS3Configured, generateS3Key, uploadToS3 } = await import(
      "@/lib/s3"
    );
    if (isS3Configured()) {
      // S3에 업로드
      const s3Key = generateS3Key(ownerType, Number(ownerId), storedName);
      publicPath = await uploadToS3(s3Key, buffer, file.type);
    } else {
      // 로컬 파일 시스템에 저장 (개발 환경용)
      const uploadDir = path.join(
        process.cwd(),
        "public",
        "uploads",
        ownerType === "team" ? "teams" : "personal",
        ownerId,
      );
      const filePath = path.join(uploadDir, storedName);
      publicPath = `/uploads/${ownerType === "team" ? "teams" : "personal"}/${ownerId}/${storedName}`;

      // 디렉토리 생성
      await mkdir(uploadDir, { recursive: true });

      // 파일 저장
      await writeFile(filePath, buffer);
    }

    // DB에 파일 레코드 생성
    const fileId = await createFileRecord({
      owner_type: ownerType,
      owner_id: Number(ownerId),
      original_name: file.name,
      stored_name: storedName,
      file_path: publicPath,
      file_size: fileSizeBytes,
      mime_type: file.type,
      uploaded_by: user.memberId,
    });

    // 태스크에 첨부 (task_id가 제공된 경우)
    if (taskId) {
      const { attachFileToTask } = await import("@/lib/task-attachment");
      await attachFileToTask(Number(taskId), fileId, user.memberId);
    }

    return jsonSuccess({
      file: {
        file_id: fileId,
        original_name: file.name,
        stored_name: storedName,
        file_path: publicPath,
        file_size: fileSizeBytes,
        file_size_formatted: formatBytes(fileSizeBytes),
        mime_type: file.type,
      },
    });
  } catch (error) {
    await createOpsEvent({
      eventType: "FILE_UPLOAD_FAILURE",
      status: "failure",
      payload: {
        reason: "UPLOAD_EXCEPTION",
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return jsonServerError(error, "Failed to upload file");
  }
}
