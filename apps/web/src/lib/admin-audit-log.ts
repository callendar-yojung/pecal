import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getClientIp } from "@/lib/admin-login-rate-limit";

export type AdminAuditAction =
  | "ADMIN_LOGIN"
  | "ADMIN_PASSWORD_CHANGE"
  | "ADMIN_2FA_ENABLE"
  | "ADMIN_2FA_DISABLE"
  | "PLAN_CREATE"
  | "PLAN_UPDATE"
  | "PLAN_DELETE"
  | "ADMIN_NOTIFICATION_SEND"
  | "ADMIN_NOTIFICATION_SCHEDULE"
  | "SUBSCRIPTION_FORCE_CHANGE"
  | "SUBSCRIPTION_STATUS_RESYNC"
  | "SUBSCRIPTION_RETRY_CHARGE"
  | "MEMBER_SESSION_FORCE_LOGOUT"
  | "ADMIN_ROLE_UPDATE"
  | "ADMIN_FORCE_PASSWORD_CHANGE_UPDATE"
  | "FILE_ORPHAN_CLEANUP"
  | "STORAGE_RECALCULATE"
  | "MOBILE_RELEASE_POLICY_UPDATE";

export type AdminAuditTargetType =
  | "AUTH"
  | "PLAN"
  | "SUBSCRIPTION"
  | "NOTIFICATION_BROADCAST"
  | "MEMBER"
  | "ADMIN"
  | "FILE"
  | "MOBILE_RELEASE_POLICY";

export interface AdminAuditLogItem {
  auditId: number;
  adminId: number;
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId: number | null;
  payload: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

interface AdminAuditLogRow extends RowDataPacket {
  audit_id: number;
  admin_id: number;
  action: AdminAuditAction;
  target_type: AdminAuditTargetType;
  target_id: number | null;
  payload_json: string | null;
  ip_address: string | null;
  created_at: Date | string;
}

let ensureTablePromise: Promise<void> | null = null;

async function ensureAdminAuditLogsTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS admin_audit_logs (
          audit_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          admin_id BIGINT NOT NULL,
          action VARCHAR(64) NOT NULL,
          target_type VARCHAR(64) NOT NULL,
          target_id BIGINT NULL,
          payload_json JSON NULL,
          ip_address VARCHAR(64) NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY idx_admin_audit_logs_admin_created (admin_id, created_at),
          KEY idx_admin_audit_logs_action_created (action, created_at),
          KEY idx_admin_audit_logs_target (target_type, target_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    })();
  }

  await ensureTablePromise;
}

function toIsoString(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function parsePayload(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function createAdminAuditLog(params: {
  adminId: number;
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId?: number | null;
  payload?: Record<string, unknown> | null;
  ip?: string | null;
}) {
  await ensureAdminAuditLogsTable();
  await pool.execute<ResultSetHeader>(
    `INSERT INTO admin_audit_logs
      (admin_id, action, target_type, target_id, payload_json, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      params.adminId,
      params.action,
      params.targetType,
      params.targetId ?? null,
      params.payload ? JSON.stringify(params.payload) : null,
      params.ip ?? null,
    ],
  );
}

export async function createAdminAuditLogFromRequest(
  request: NextRequest,
  params: {
    adminId: number;
    action: AdminAuditAction;
    targetType: AdminAuditTargetType;
    targetId?: number | null;
    payload?: Record<string, unknown> | null;
  },
) {
  return createAdminAuditLog({
    ...params,
    ip: getClientIp(request),
  });
}

export async function listAdminAuditLogs(limit = 100): Promise<AdminAuditLogItem[]> {
  await ensureAdminAuditLogsTable();
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  const [rows] = await pool.query<AdminAuditLogRow[]>(
    `SELECT audit_id, admin_id, action, target_type, target_id, payload_json, ip_address, created_at
     FROM admin_audit_logs
     ORDER BY created_at DESC
     LIMIT ${safeLimit}`,
  );

  return rows.map((row) => ({
    auditId: Number(row.audit_id),
    adminId: Number(row.admin_id),
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id === null ? null : Number(row.target_id),
    payload: parsePayload(row.payload_json),
    ip: row.ip_address ?? null,
    createdAt: toIsoString(row.created_at),
  }));
}
