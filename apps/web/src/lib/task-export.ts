import crypto from "node:crypto";
import pool from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

export type TaskExportVisibility = "public" | "restricted";

export interface TaskExportRecord {
  export_id: number;
  task_id: number;
  token: string;
  visibility: TaskExportVisibility;
  created_by: number;
  created_at: string;
  revoked_at?: string | null;
  expires_at?: string | null;
}

export async function createTaskExport(params: {
  taskId: number;
  createdBy: number;
  visibility: TaskExportVisibility;
  expiresAt?: string | null;
}): Promise<TaskExportRecord> {
  const token = crypto.randomBytes(24).toString("hex");

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO task_exports (task_id, token, visibility, created_by, created_at, expires_at)
     VALUES (?, ?, ?, ?, NOW(), ?)`,
    [params.taskId, token, params.visibility, params.createdBy, params.expiresAt ?? null]
  );

  await pool.execute(
    `INSERT INTO task_export_access (export_id, member_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE export_id = export_id`,
    [result.insertId, params.createdBy]
  );

  return {
    export_id: result.insertId,
    task_id: params.taskId,
    token,
    visibility: params.visibility,
    created_by: params.createdBy,
    created_at: new Date().toISOString(),
    expires_at: params.expiresAt ?? null,
    revoked_at: null,
  };
}

export async function getTaskExportByToken(
  token: string
): Promise<TaskExportRecord | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT *
     FROM task_exports
     WHERE token = ?
     LIMIT 1`,
    [token]
  );

  return rows.length > 0 ? (rows[0] as TaskExportRecord) : null;
}

export interface TaskExportWithAccess extends TaskExportRecord {
  access_members: Array<{
    member_id: number;
    nickname: string | null;
    email: string | null;
    profile_image_url: string | null;
  }>;
}

export async function getTaskExportsForTask(
  taskId: number
): Promise<TaskExportWithAccess[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      e.*,
      m.member_id,
      m.nickname,
      m.email,
      m.profile_image_url
     FROM task_exports e
     LEFT JOIN task_export_access a ON e.export_id = a.export_id
     LEFT JOIN members m ON a.member_id = m.member_id
     WHERE e.task_id = ?
     ORDER BY e.created_at DESC`,
    [taskId]
  );

  const map = new Map<number, TaskExportWithAccess>();
  rows.forEach((row: any) => {
    if (!map.has(row.export_id)) {
      map.set(row.export_id, {
        export_id: row.export_id,
        task_id: row.task_id,
        token: row.token,
        visibility: row.visibility,
        created_by: row.created_by,
        created_at: row.created_at,
        revoked_at: row.revoked_at ?? null,
        expires_at: row.expires_at ?? null,
        access_members: [],
      });
    }
    if (row.member_id) {
      map.get(row.export_id)!.access_members.push({
        member_id: row.member_id,
        nickname: row.nickname ?? null,
        email: row.email ?? null,
        profile_image_url: row.profile_image_url ?? null,
      });
    }
  });

  return Array.from(map.values());
}

export async function getTaskExportWithTask(exportId: number): Promise<{
  export: TaskExportRecord;
  task_id: number;
  workspace_id: number;
} | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      e.*,
      t.workspace_id
     FROM task_exports e
     JOIN tasks t ON e.task_id = t.id
     WHERE e.export_id = ?
     LIMIT 1`,
    [exportId]
  );
  if (rows.length === 0) return null;
  const row: any = rows[0];
  return {
    export: row as TaskExportRecord,
    task_id: row.task_id,
    workspace_id: row.workspace_id,
  };
}

export async function addExportAccess(
  exportId: number,
  memberId: number
): Promise<void> {
  await pool.execute(
    `INSERT INTO task_export_access (export_id, member_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE export_id = export_id`,
    [exportId, memberId]
  );
}

export async function removeExportAccess(
  exportId: number,
  memberId: number
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `DELETE FROM task_export_access WHERE export_id = ? AND member_id = ?`,
    [exportId, memberId]
  );
  return result.affectedRows > 0;
}

export async function hasExportAccess(
  exportId: number,
  memberId: number
): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1 FROM task_export_access WHERE export_id = ? AND member_id = ? LIMIT 1`,
    [exportId, memberId]
  );
  return rows.length > 0;
}

export async function revokeExport(exportId: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE task_exports SET revoked_at = NOW() WHERE export_id = ?`,
    [exportId]
  );
  return result.affectedRows > 0;
}

export async function updateExportVisibility(
  exportId: number,
  visibility: TaskExportVisibility
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE task_exports SET visibility = ? WHERE export_id = ?`,
    [visibility, exportId]
  );
  return result.affectedRows > 0;
}

export async function updateExportExpiry(
  exportId: number,
  expiresAt: string | null
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE task_exports SET expires_at = ? WHERE export_id = ?`,
    [expiresAt, exportId]
  );
  return result.affectedRows > 0;
}
