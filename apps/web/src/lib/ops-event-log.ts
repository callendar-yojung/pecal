import type { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "@/lib/db";

export type OpsEventType =
  | "TASK_REMINDER_CRON_SUCCESS"
  | "TASK_REMINDER_CRON_FAILURE"
  | "PUSH_BATCH"
  | "FILE_UPLOAD_FAILURE"
  | "FILE_PREVIEW_PENDING"
  | "FILE_PREVIEW_FAILURE"
  | "AUTH_REFRESH_FAILURE"
  | "SESSION_FORCE_LOGOUT";

export interface OpsEventLogItem {
  eventId: number;
  eventType: OpsEventType;
  status: "success" | "failure" | "info";
  payload: Record<string, unknown> | null;
  createdAt: string;
}

interface OpsEventRow extends RowDataPacket {
  event_id: number;
  event_type: OpsEventType;
  status: "success" | "failure" | "info";
  payload_json: string | null;
  created_at: string | Date;
}

let ensureTablePromise: Promise<void> | null = null;

async function ensureOpsEventsTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS ops_event_logs (
          event_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          event_type VARCHAR(64) NOT NULL,
          status VARCHAR(16) NOT NULL DEFAULT 'info',
          payload_json JSON NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY idx_ops_event_logs_type_created (event_type, created_at),
          KEY idx_ops_event_logs_status_created (status, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    })();
  }

  await ensureTablePromise;
}

function toIsoString(value: string | Date) {
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

export async function createOpsEvent(params: {
  eventType: OpsEventType;
  status?: "success" | "failure" | "info";
  payload?: Record<string, unknown> | null;
}) {
  await ensureOpsEventsTable();
  await pool.execute<ResultSetHeader>(
    `INSERT INTO ops_event_logs (event_type, status, payload_json) VALUES (?, ?, ?)`,
    [
      params.eventType,
      params.status ?? "info",
      params.payload ? JSON.stringify(params.payload) : null,
    ],
  );
}

export async function listRecentOpsEvents(limit = 50): Promise<OpsEventLogItem[]> {
  await ensureOpsEventsTable();
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  const [rows] = await pool.query<OpsEventRow[]>(
    `SELECT event_id, event_type, status, payload_json, created_at
     FROM ops_event_logs
     ORDER BY created_at DESC
     LIMIT ${safeLimit}`,
  );

  return rows.map((row) => ({
    eventId: Number(row.event_id),
    eventType: row.event_type,
    status: row.status,
    payload: parsePayload(row.payload_json),
    createdAt: toIsoString(row.created_at),
  }));
}

export async function getOpsDashboardMetrics() {
  await ensureOpsEventsTable();

  const [[cronSummary]] = await pool.query<RowDataPacket[]>(`
    SELECT
      MAX(CASE WHEN event_type = 'TASK_REMINDER_CRON_SUCCESS' THEN created_at END) AS last_success_at,
      SUM(CASE WHEN event_type = 'TASK_REMINDER_CRON_FAILURE' THEN 1 ELSE 0 END) AS failure_count
    FROM ops_event_logs
    WHERE event_type IN ('TASK_REMINDER_CRON_SUCCESS', 'TASK_REMINDER_CRON_FAILURE')
  `);

  const [[pushSummary]] = await pool.query<RowDataPacket[]>(`
    SELECT
      COALESCE(SUM(CASE WHEN event_type = 'PUSH_BATCH' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.sent')) AS UNSIGNED) ELSE 0 END), 0) AS sent_24h,
      COALESCE(SUM(CASE WHEN event_type = 'PUSH_BATCH' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.failed')) AS UNSIGNED) ELSE 0 END), 0) AS failed_24h
    FROM ops_event_logs
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      AND event_type = 'PUSH_BATCH'
  `);

  const [[fileSummary]] = await pool.query<RowDataPacket[]>(`
    SELECT
      COALESCE(SUM(CASE WHEN event_type = 'FILE_UPLOAD_FAILURE' THEN 1 ELSE 0 END), 0) AS upload_failed_24h,
      COALESCE(SUM(CASE WHEN event_type = 'FILE_PREVIEW_PENDING' THEN 1 ELSE 0 END), 0) AS preview_pending_24h,
      COALESCE(SUM(CASE WHEN event_type = 'FILE_PREVIEW_FAILURE' THEN 1 ELSE 0 END), 0) AS preview_failed_24h
    FROM ops_event_logs
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      AND event_type IN ('FILE_UPLOAD_FAILURE', 'FILE_PREVIEW_PENDING', 'FILE_PREVIEW_FAILURE')
  `);

  const [[authSummary]] = await pool.query<RowDataPacket[]>(`
    SELECT
      COALESCE(SUM(CASE WHEN event_type = 'AUTH_REFRESH_FAILURE' THEN 1 ELSE 0 END), 0) AS refresh_failed_24h,
      COALESCE(SUM(CASE WHEN event_type = 'SESSION_FORCE_LOGOUT' THEN 1 ELSE 0 END), 0) AS force_logout_24h
    FROM ops_event_logs
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      AND event_type IN ('AUTH_REFRESH_FAILURE', 'SESSION_FORCE_LOGOUT')
  `);

  return {
    cron: {
      lastSuccessAt:
        cronSummary?.last_success_at == null
          ? null
          : toIsoString(cronSummary.last_success_at as string | Date),
      failureCount: Number(cronSummary?.failure_count ?? 0),
    },
    push: {
      sent24h: Number(pushSummary?.sent_24h ?? 0),
      failed24h: Number(pushSummary?.failed_24h ?? 0),
    },
    files: {
      uploadFailed24h: Number(fileSummary?.upload_failed_24h ?? 0),
      previewPending24h: Number(fileSummary?.preview_pending_24h ?? 0),
      previewFailed24h: Number(fileSummary?.preview_failed_24h ?? 0),
    },
    auth: {
      refreshFailed24h: Number(authSummary?.refresh_failed_24h ?? 0),
      forceLogout24h: Number(authSummary?.force_logout_24h ?? 0),
    },
  };
}
