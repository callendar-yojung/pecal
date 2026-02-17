import { NextRequest } from "next/server";
import { requireOwnerAccess } from "@/lib/access";
import { createFileRecord } from "@/lib/file";
import { canUploadFile, type OwnerType, formatBytes } from "@/lib/storage";
import { v4 as uuidv4 } from "uuid";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  jsonError,
  jsonServerError,
  jsonSuccess,
} from "@/lib/api-response";

// 허용된 파일 타입
const ALLOWED_TYPES = [
  // 이미지
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // 문서
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/haansofthwp", // 한글(HWP) MIME 타입
  "application/x-hwp",       // 일부 브라우저에서 전송하는 타입
  // 텍스트
  "text/plain",
  "text/plain; charset=utf-8", // 한글 텍스트 포함
  "text/csv",
  "text/markdown",
  // 압축
  "application/zip",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
];
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

    const access = await requireOwnerAccess(request, ownerType, Number(ownerId));
    if (access instanceof Response) return access;
    const { user } = access;

    // 파일 타입 검증
    if (!ALLOWED_TYPES.includes(file.type)) {
      return jsonError(`File type not allowed: ${file.type}`, 400);
    }

    const fileSizeBytes = file.size;

    // 용량 체크
    const uploadCheck = await canUploadFile(ownerType, Number(ownerId), fileSizeBytes);
    if (!uploadCheck.allowed) {
      return jsonError(uploadCheck.reason || "Upload limit exceeded", 403, "LIMIT_EXCEEDED", {
        used_bytes: uploadCheck.used_bytes,
        limit_bytes: uploadCheck.limit_bytes,
        max_file_size_bytes: uploadCheck.max_file_size_bytes,
      });
    }

    // 파일 저장 경로 생성
    const fileExt = path.extname(file.name);
    const storedName = `${uuidv4()}${fileExt}`;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let publicPath: string;

    // S3가 설정되어 있으면 S3에 업로드, 아니면 로컬 파일 시스템 사용
    const { isS3Configured, generateS3Key, uploadToS3 } = await import("@/lib/s3");
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
        ownerId
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
    return jsonServerError(error, "Failed to upload file");
  }
}
