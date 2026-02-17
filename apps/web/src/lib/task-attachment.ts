import pool from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { type FileRecord } from "./file";

export interface TaskAttachment {
  attachment_id: number;
  task_id: number;
  file_id: number;
  created_at: Date;
  created_by: number;
}

export interface TaskAttachmentWithFile extends TaskAttachment {
  original_name: string;
  stored_name: string;
  file_path: string;
  file_size: number;
  mime_type: string | null;
}

export interface TaskAttachmentRecord extends TaskAttachment {}

export async function getTaskAttachmentById(
  attachmentId: number
): Promise<TaskAttachmentRecord | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT attachment_id, task_id, file_id, created_at, created_by
     FROM task_attachments
     WHERE attachment_id = ?
     LIMIT 1`,
    [attachmentId]
  );
  return rows.length > 0 ? (rows[0] as TaskAttachmentRecord) : null;
}

/**
 * 태스크에 파일 첨부
 */
export async function attachFileToTask(
  taskId: number,
  fileId: number,
  createdBy: number
): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO task_attachments (task_id, file_id, created_by, created_at)
     VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE attachment_id = attachment_id`,
    [taskId, fileId, createdBy]
  );
  return result.insertId;
}

/**
 * 태스크의 첨부파일 목록 조회
 */
export async function getTaskAttachments(taskId: number): Promise<TaskAttachmentWithFile[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT
      ta.attachment_id,
      ta.task_id,
      ta.file_id,
      ta.created_at,
      ta.created_by,
      f.original_name,
      f.stored_name,
      f.file_path,
      f.file_size,
      f.mime_type
     FROM task_attachments ta
     JOIN files f ON ta.file_id = f.file_id
     WHERE ta.task_id = ?
     ORDER BY ta.created_at DESC`,
    [taskId]
  );
  return rows as TaskAttachmentWithFile[];
}

/**
 * 첨부파일 삭제 (태스크와의 연결만 해제, 실제 파일은 유지)
 */
export async function detachFileFromTask(
  taskId: number,
  fileId: number
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `DELETE FROM task_attachments WHERE task_id = ? AND file_id = ?`,
    [taskId, fileId]
  );
  return result.affectedRows > 0;
}

/**
 * 첨부파일 ID로 삭제
 */
export async function deleteTaskAttachment(attachmentId: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `DELETE FROM task_attachments WHERE attachment_id = ?`,
    [attachmentId]
  );
  return result.affectedRows > 0;
}

/**
 * 태스크의 모든 첨부파일 삭제 (태스크와의 연결만 해제)
 */
export async function detachAllFilesFromTask(taskId: number): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `DELETE FROM task_attachments WHERE task_id = ?`,
    [taskId]
  );
  return result.affectedRows;
}

/**
 * 파일이 어떤 태스크에 첨부되어 있는지 조회
 */
export async function getTasksWithFile(fileId: number): Promise<number[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT DISTINCT task_id FROM task_attachments WHERE file_id = ?`,
    [fileId]
  );
  return rows.map((row) => row.task_id);
}

/**
 * 첨부파일 개수 조회
 */
export async function getTaskAttachmentCount(taskId: number): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM task_attachments WHERE task_id = ?`,
    [taskId]
  );
  return Number(rows[0]?.count || 0);
}

/**
 * 첨부파일 존재 여부 확인
 */
export async function isFileAttachedToTask(
  taskId: number,
  fileId: number
): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 FROM task_attachments WHERE task_id = ? AND file_id = ? LIMIT 1`,
    [taskId, fileId]
  );
  return rows.length > 0;
}
