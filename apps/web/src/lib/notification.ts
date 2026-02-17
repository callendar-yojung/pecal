import pool from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export interface NotificationRecord {
  notification_id: number;
  member_id: number;
  type: string;
  title: string | null;
  message: string | null;
  payload_json: string | null;
  source_type: string | null;
  source_id: number | null;
  is_read: number;
  created_at: Date;
  read_at: Date | null;
}

export async function createNotification(params: {
  member_id: number;
  type: string;
  title?: string | null;
  message?: string | null;
  payload?: Record<string, unknown> | null;
  source_type?: string | null;
  source_id?: number | null;
}): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO notifications
     (member_id, type, title, message, payload_json, source_type, source_id, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
    [
      params.member_id,
      params.type,
      params.title ?? null,
      params.message ?? null,
      params.payload ? JSON.stringify(params.payload) : null,
      params.source_type ?? null,
      params.source_id ?? null,
    ]
  );
  return result.insertId;
}

export async function getNotificationsForMember(
  memberId: number,
  limit = 20
): Promise<(NotificationRecord & { invitation_status?: string | null; team_name?: string | null; inviter_name?: string | null })[]> {
  const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       n.*, 
       ti.status AS invitation_status,
       t.name AS team_name,
       m.nickname AS inviter_name
     FROM notifications n
     LEFT JOIN team_invitations ti
       ON n.source_type = 'TEAM_INVITE' AND n.source_id = ti.invitation_id
     LEFT JOIN teams t ON ti.team_id = t.team_id
     LEFT JOIN members m ON ti.invited_by = m.member_id
     WHERE n.member_id = ?
     ORDER BY n.created_at DESC
     LIMIT ${safeLimit}`,
    [memberId]
  );
  return rows as (NotificationRecord & { invitation_status?: string | null; team_name?: string | null; inviter_name?: string | null })[];
}

export async function getUnreadCount(memberId: number): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM notifications WHERE member_id = ? AND is_read = 0`,
    [memberId]
  );
  return Number(rows[0]?.count || 0);
}

export async function markNotificationRead(notificationId: number, memberId: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE notifications SET is_read = 1, read_at = NOW() WHERE notification_id = ? AND member_id = ?`,
    [notificationId, memberId]
  );
  return result.affectedRows > 0;
}

export async function markNotificationsReadBySource(
  memberId: number,
  sourceType: string,
  sourceId: number
): Promise<void> {
  await pool.execute(
    `UPDATE notifications SET is_read = 1, read_at = NOW()
     WHERE member_id = ? AND source_type = ? AND source_id = ?`,
    [memberId, sourceType, sourceId]
  );
}

export async function deleteNotification(
  notificationId: number,
  memberId: number
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `DELETE FROM notifications WHERE notification_id = ? AND member_id = ?`,
    [notificationId, memberId]
  );
  return result.affectedRows > 0;
}

export async function clearNotifications(memberId: number): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `DELETE FROM notifications WHERE member_id = ?`,
    [memberId]
  );
  return result.affectedRows;
}
