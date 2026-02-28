import type { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "@/lib/db";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const WINDOW_MINUTES = 15;
const UNKNOWN_IP = "unknown";

interface AdminLoginAttemptRow extends RowDataPacket {
  attempt_id: number;
  username: string;
  ip_address: string;
  fail_count: number;
  last_failed_at: string | null;
  locked_until: string | null;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || UNKNOWN_IP;
  }
  return request.headers.get("x-real-ip") || UNKNOWN_IP;
}

export function normalizeAdminUsername(input: string): string {
  return input.trim().toLowerCase();
}

export async function checkAdminLoginAllowed(
  username: string,
  ipAddress: string,
) {
  const [rows] = await pool.execute<AdminLoginAttemptRow[]>(
    `SELECT attempt_id, username, ip_address, fail_count, last_failed_at, locked_until
     FROM admin_login_attempts
     WHERE username = ? AND ip_address = ?
     LIMIT 1`,
    [username, ipAddress],
  );

  if (rows.length === 0) {
    return { allowed: true as const, retryAfterSeconds: 0 };
  }

  const row = rows[0];
  const now = new Date();
  const lockedUntil = parseDate(row.locked_until);
  if (lockedUntil && lockedUntil > now) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000),
    );
    return { allowed: false as const, retryAfterSeconds };
  }

  return { allowed: true as const, retryAfterSeconds: 0 };
}

export async function recordAdminLoginFailure(
  username: string,
  ipAddress: string,
) {
  const [rows] = await pool.execute<AdminLoginAttemptRow[]>(
    `SELECT attempt_id, fail_count, last_failed_at
     FROM admin_login_attempts
     WHERE username = ? AND ip_address = ?
     LIMIT 1`,
    [username, ipAddress],
  );

  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000);
  const lockUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000);

  if (rows.length === 0) {
    await pool.execute<ResultSetHeader>(
      `INSERT INTO admin_login_attempts
        (username, ip_address, fail_count, first_failed_at, last_failed_at, locked_until, updated_at)
       VALUES (?, ?, 1, NOW(), NOW(), NULL, NOW())`,
      [username, ipAddress],
    );
    return;
  }

  const row = rows[0];
  const lastFailedAt = parseDate(row.last_failed_at);
  const isOutsideWindow = !lastFailedAt || lastFailedAt < windowStart;
  const nextFailCount = isOutsideWindow ? 1 : row.fail_count + 1;
  const nextLockedUntil =
    nextFailCount >= MAX_FAILED_ATTEMPTS
      ? lockUntil.toISOString().slice(0, 19).replace("T", " ")
      : null;

  await pool.execute<ResultSetHeader>(
    `UPDATE admin_login_attempts
     SET fail_count = ?,
         first_failed_at = CASE WHEN ? THEN NOW() ELSE first_failed_at END,
         last_failed_at = NOW(),
         locked_until = ?,
         updated_at = NOW()
     WHERE attempt_id = ?`,
    [nextFailCount, isOutsideWindow ? 1 : 0, nextLockedUntil, row.attempt_id],
  );
}

export async function clearAdminLoginFailures(
  username: string,
  ipAddress: string,
) {
  await pool.execute<ResultSetHeader>(
    `DELETE FROM admin_login_attempts WHERE username = ? AND ip_address = ?`,
    [username, ipAddress],
  );
}
