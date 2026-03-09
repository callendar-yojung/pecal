import { unlink } from "node:fs/promises";
import path from "node:path";
import type { RowDataPacket } from "mysql2";
import pool from "@/lib/db";
import { deleteFileRecord } from "@/lib/file";
import { deleteFromS3, extractS3KeyFromUrl, isS3Configured } from "@/lib/s3";
import { getOpsDashboardMetrics } from "@/lib/ops-event-log";
import { getActivePlanForOwner } from "@/lib/storage";

export const FILE_PREVIEW_SUPPORT = [
  { label: "이미지", extensions: ["jpg", "jpeg", "png", "gif", "webp", "svg"], mode: "native-preview" },
  { label: "PDF", extensions: ["pdf"], mode: "in-app-preview" },
  { label: "Office 문서", extensions: ["doc", "docx", "xls", "xlsx", "ppt", "pptx"], mode: "download-or-server-convert" },
  { label: "한글", extensions: ["hwp", "hwpx"], mode: "server-convert-recommended" },
  { label: "텍스트/압축", extensions: ["txt", "csv", "md", "zip", "rar", "7z"], mode: "download" },
] as const;

async function deleteFileAsset(filePath: string) {
  if (isS3Configured() && /^https?:\/\//.test(filePath)) {
    const key = extractS3KeyFromUrl(filePath);
    if (key) {
      await deleteFromS3(key);
      return;
    }
  }
  const localPath = path.join(process.cwd(), "public", filePath.replace(/^\//, ""));
  await unlink(localPath).catch(() => undefined);
}

export async function getFileOperationsOverview() {
  const ops = await getOpsDashboardMetrics();
  const [largeFileRows] = await pool.execute<RowDataPacket[]>(
    `SELECT file_id, original_name, file_size, mime_type, created_at
     FROM files
     WHERE file_size >= ?
     ORDER BY file_size DESC
     LIMIT 20`,
    [50 * 1024 * 1024],
  );
  const [orphanRows] = await pool.execute<RowDataPacket[]>(
    `SELECT f.file_id, f.original_name, f.file_path, f.file_size, f.created_at
     FROM files f
     LEFT JOIN task_attachments ta ON ta.file_id = f.file_id
     WHERE ta.file_id IS NULL
     ORDER BY f.created_at ASC
     LIMIT 50`,
  );
  const [orphanCountRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS count
     FROM files f
     LEFT JOIN task_attachments ta ON ta.file_id = f.file_id
     WHERE ta.file_id IS NULL`,
  );
  const [mimeRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(mime_type, 'unknown') AS mime_type, COUNT(*) AS count
     FROM files
     GROUP BY mime_type
     ORDER BY count DESC
     LIMIT 20`,
  );
  const [planRows] = await pool.execute<RowDataPacket[]>(
    `SELECT plan_id, name, plan_type, max_storage_mb, max_file_size_mb
     FROM plans
     ORDER BY plan_type ASC, price ASC`,
  );

  return {
    uploadFailures24h: ops.files.uploadFailed24h,
    previewPending24h: ops.files.previewPending24h,
    previewFailed24h: ops.files.previewFailed24h,
    orphanFileCount: Number(orphanCountRows[0]?.count ?? 0),
    orphanFiles: orphanRows.map((row) => ({
      fileId: Number(row.file_id),
      name: String(row.original_name ?? ""),
      path: String(row.file_path ?? ""),
      sizeBytes: Number(row.file_size ?? 0),
      createdAt: new Date(row.created_at).toISOString(),
    })),
    largeFiles: largeFileRows.map((row) => ({
      fileId: Number(row.file_id),
      name: String(row.original_name ?? ""),
      mimeType: row.mime_type ? String(row.mime_type) : null,
      sizeBytes: Number(row.file_size ?? 0),
      createdAt: new Date(row.created_at).toISOString(),
    })),
    mimeDistribution: mimeRows.map((row) => ({
      mimeType: String(row.mime_type ?? "unknown"),
      count: Number(row.count ?? 0),
    })),
    uploadPolicies: planRows.map((row) => ({
      planId: Number(row.plan_id),
      name: String(row.name),
      planType: String(row.plan_type),
      maxStorageMb: Number(row.max_storage_mb ?? 0),
      maxFileSizeMb: Number(row.max_file_size_mb ?? 0),
    })),
    previewSupport: FILE_PREVIEW_SUPPORT,
  };
}

export async function cleanupOrphanFiles(limit = 100, dryRun = true) {
  const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT f.file_id, f.file_path
     FROM files f
     LEFT JOIN task_attachments ta ON ta.file_id = f.file_id
     WHERE ta.file_id IS NULL
     ORDER BY f.created_at ASC
     LIMIT ${safeLimit}`,
  );

  if (dryRun) {
    return { candidateCount: rows.length, deletedCount: 0, deletedFileIds: [] as number[] };
  }

  const deletedFileIds: number[] = [];
  for (const row of rows) {
    const fileId = Number(row.file_id);
    const filePath = String(row.file_path ?? "");
    await deleteFileAsset(filePath);
    const deleted = await deleteFileRecord(fileId);
    if (deleted) deletedFileIds.push(fileId);
  }

  return { candidateCount: rows.length, deletedCount: deletedFileIds.length, deletedFileIds };
}

export async function recalculateStorageForAllOwners() {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT DISTINCT owner_type, owner_id FROM files`,
  );

  let updated = 0;
  for (const row of rows) {
    const ownerType = row.owner_type as "team" | "personal";
    const ownerId = Number(row.owner_id);
    if (!ownerId) continue;
    await getActivePlanForOwner(ownerType, ownerId);
    await pool.execute(
      `INSERT INTO storage_usage (owner_type, owner_id, used_bytes, file_count)
       SELECT f.owner_type, f.owner_id, COALESCE(SUM(f.file_size), 0), COUNT(*)
       FROM files f
       WHERE f.owner_type = ? AND f.owner_id = ?
       GROUP BY f.owner_type, f.owner_id
       ON DUPLICATE KEY UPDATE used_bytes = VALUES(used_bytes), file_count = VALUES(file_count)`,
      [ownerType, ownerId],
    );
    updated += 1;
  }

  return { updatedOwners: updated };
}
