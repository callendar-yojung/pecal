import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "@/lib/db";
import { getRedisClient } from "@/lib/redis-cache";
import { isS3Configured } from "@/lib/s3";

export type AdminHealthStatus = "ok" | "warn" | "error";
export type AdminHealthComponent =
  | "db"
  | "redis"
  | "push"
  | "billingWebhook"
  | "storage";

export interface AdminHealthItem {
  component: AdminHealthComponent;
  status: AdminHealthStatus;
  message: string;
  checkedAt: string;
  details?: Record<string, unknown> | null;
}

interface HealthRow extends RowDataPacket {
  component: AdminHealthComponent;
  status: AdminHealthStatus;
  message: string;
  details_json: string | null;
  checked_at: string | Date;
}

let ensureTablePromise: Promise<void> | null = null;

async function ensureAdminServiceHealthTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS admin_service_health (
          component VARCHAR(32) NOT NULL PRIMARY KEY,
          status VARCHAR(16) NOT NULL,
          message VARCHAR(255) NOT NULL,
          details_json JSON NULL,
          checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_admin_service_health_status_checked (status, checked_at)
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

async function upsertHealthItem(item: AdminHealthItem) {
  await ensureAdminServiceHealthTable();
  await pool.execute<ResultSetHeader>(
    `INSERT INTO admin_service_health (component, status, message, details_json, checked_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       message = VALUES(message),
       details_json = VALUES(details_json),
       checked_at = NOW()`,
    [
      item.component,
      item.status,
      item.message,
      item.details ? JSON.stringify(item.details) : null,
    ],
  );
}

async function checkDb(): Promise<AdminHealthItem> {
  const checkedAt = new Date().toISOString();
  try {
    await pool.query("SELECT 1 AS ok");
    return { component: "db", status: "ok", message: "DB 연결 정상", checkedAt };
  } catch (error) {
    return {
      component: "db",
      status: "error",
      message: "DB 연결 실패",
      checkedAt,
      details: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

async function checkRedis(): Promise<AdminHealthItem> {
  const checkedAt = new Date().toISOString();
  const redis = getRedisClient();
  if (!redis) {
    return {
      component: "redis",
      status: "warn",
      message: "Redis 미설정",
      checkedAt,
      details: { configured: false },
    };
  }

  try {
    const pong = await redis.ping();
    return {
      component: "redis",
      status: pong === "PONG" ? "ok" : "warn",
      message: pong === "PONG" ? "Redis 연결 정상" : `Redis 응답: ${pong}`,
      checkedAt,
      details: { configured: true, response: pong },
    };
  } catch (error) {
    return {
      component: "redis",
      status: "error",
      message: "Redis 연결 실패",
      checkedAt,
      details: { configured: true, error: error instanceof Error ? error.message : String(error) },
    };
  }
}

async function checkStorage(): Promise<AdminHealthItem> {
  const checkedAt = new Date().toISOString();
  if (!isS3Configured()) {
    return {
      component: "storage",
      status: "warn",
      message: "S3 미설정 (로컬 스토리지 모드)",
      checkedAt,
      details: { configured: false, mode: "local" },
    };
  }

  const bucket = process.env.AWS_S3_BUCKET || "";
  const region = process.env.AWS_REGION || "ap-northeast-2";
  try {
    const client = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return {
      component: "storage",
      status: "ok",
      message: "S3 연결 정상",
      checkedAt,
      details: { configured: true, bucket, region },
    };
  } catch (error) {
    return {
      component: "storage",
      status: "error",
      message: "S3 연결 실패",
      checkedAt,
      details: {
        configured: true,
        bucket,
        region,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

async function checkPush(): Promise<AdminHealthItem> {
  const checkedAt = new Date().toISOString();
  const token = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (!token) {
    return {
      component: "push",
      status: "warn",
      message: "Expo Push 토큰 미설정",
      checkedAt,
      details: { configured: false },
    };
  }

  return {
    component: "push",
    status: "ok",
    message: "Expo Push 설정 정상",
    checkedAt,
    details: { configured: true },
  };
}

async function checkBillingWebhook(): Promise<AdminHealthItem> {
  const checkedAt = new Date().toISOString();
  const paypalWebhookId =
    process.env.PAYPAL_WEBHOOK_ID ||
    process.env.SENDBOX_PAYPAL_WEBHOOK_ID ||
    process.env.LIVE_PAYPAL_WEBHOOK_ID ||
    "";
  const paypalClientId =
    process.env.SENDBOX_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || "";
  const paypalClientSecret =
    process.env.SENDBOX_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET || "";
  const nicepayClientKey = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY || "";
  const nicepaySecretKey = process.env.NICEPAY_SECRET_KEY || "";

  const paypalConfigured = Boolean(paypalWebhookId && paypalClientId && paypalClientSecret);
  const nicepayConfigured = Boolean(nicepayClientKey && nicepaySecretKey);

  if (paypalConfigured && nicepayConfigured) {
    return {
      component: "billingWebhook",
      status: "ok",
      message: "PayPal/NicePay 설정 정상",
      checkedAt,
      details: { paypalConfigured: true, nicepayConfigured: true },
    };
  }

  if (paypalConfigured || nicepayConfigured) {
    return {
      component: "billingWebhook",
      status: "warn",
      message: "결제 공급자 일부만 설정됨",
      checkedAt,
      details: { paypalConfigured, nicepayConfigured },
    };
  }

  return {
    component: "billingWebhook",
    status: "error",
    message: "결제 공급자 설정 누락",
    checkedAt,
    details: { paypalConfigured: false, nicepayConfigured: false },
  };
}

export async function getAdminHealthSnapshot() {
  const items = await Promise.all([
    checkDb(),
    checkRedis(),
    checkPush(),
    checkBillingWebhook(),
    checkStorage(),
  ]);

  await Promise.all(items.map((item) => upsertHealthItem(item)));

  const overallStatus: AdminHealthStatus = items.some((item) => item.status === "error")
    ? "error"
    : items.some((item) => item.status === "warn")
      ? "warn"
      : "ok";

  return {
    overallStatus,
    checkedAt: new Date().toISOString(),
    items,
  };
}

export async function listAdminHealthSnapshot() {
  await ensureAdminServiceHealthTable();
  const [rows] = await pool.query<HealthRow[]>(
    `SELECT component, status, message, details_json, checked_at
     FROM admin_service_health
     ORDER BY component ASC`,
  );

  return rows.map((row) => ({
    component: row.component,
    status: row.status,
    message: row.message,
    checkedAt: toIsoString(row.checked_at),
    details: parsePayload(row.details_json),
  }));
}
