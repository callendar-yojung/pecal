import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import QRCode from "qrcode";
import speakeasy from "speakeasy";
import pool from "@/lib/db";

export const ADMIN_ROLES = ["SUPER_ADMIN", "OPS", "BILLING"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export interface AdminSecurityState {
  adminId: number;
  role: AdminRole;
  twoFactorEnabled: boolean;
  passwordChangedAt: string | null;
  forcePasswordChange: boolean;
  requiresPasswordChange: boolean;
}

interface AdminSecurityRow extends RowDataPacket {
  admin_id: number;
  role: string;
  two_factor_enabled: number;
  two_factor_secret: string | null;
  two_factor_temp_secret: string | null;
  password_changed_at: string | null;
  force_password_change: number;
}

let ensureAdminSecurityPromise: Promise<void> | null = null;

function isMissingColumnError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes("Unknown column") ||
      error.message.includes("doesn't exist") ||
      error.message.includes("Duplicate column name"))
  );
}

async function execIgnoreDuplicate(sql: string) {
  try {
    await pool.execute(sql);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Duplicate column name")) {
      return;
    }
    if (error instanceof Error && error.message.includes("Duplicate key name")) {
      return;
    }
    throw error;
  }
}

export async function ensureAdminSecuritySchema() {
  if (!ensureAdminSecurityPromise) {
    ensureAdminSecurityPromise = (async () => {
      await execIgnoreDuplicate(
        "ALTER TABLE admins MODIFY COLUMN role VARCHAR(32) NOT NULL DEFAULT 'OPS'",
      );
      await execIgnoreDuplicate(
        "ALTER TABLE admins ADD COLUMN two_factor_enabled TINYINT(1) NOT NULL DEFAULT 0",
      );
      await execIgnoreDuplicate(
        "ALTER TABLE admins ADD COLUMN two_factor_secret VARCHAR(255) NULL",
      );
      await execIgnoreDuplicate(
        "ALTER TABLE admins ADD COLUMN two_factor_temp_secret VARCHAR(255) NULL",
      );
      await execIgnoreDuplicate(
        "ALTER TABLE admins ADD COLUMN password_changed_at DATETIME NULL",
      );
      await execIgnoreDuplicate(
        "ALTER TABLE admins ADD COLUMN force_password_change TINYINT(1) NOT NULL DEFAULT 0",
      );
      await execIgnoreDuplicate(
        "UPDATE admins SET role = 'OPS' WHERE role IS NULL OR role = '' OR role = 'ADMIN'",
      );
      await execIgnoreDuplicate(
        "UPDATE admins SET password_changed_at = COALESCE(password_changed_at, created_at, NOW())",
      );
    })();
  }

  await ensureAdminSecurityPromise;
}

export function normalizeAdminRole(role: unknown): AdminRole {
  if (role === "SUPER_ADMIN" || role === "OPS" || role === "BILLING") {
    return role;
  }
  return role === "ADMIN" ? "OPS" : "OPS";
}

export function getAdminPasswordMaxAgeDays() {
  const raw = Number(process.env.ADMIN_PASSWORD_MAX_AGE_DAYS ?? "90");
  if (!Number.isFinite(raw) || raw <= 0) {
    return 90;
  }
  return Math.trunc(raw);
}

export function isPasswordChangeRequired(params: {
  passwordChangedAt: string | null;
  forcePasswordChange: boolean;
}) {
  if (params.forcePasswordChange) return true;
  if (!params.passwordChangedAt) return true;

  const changedAt = new Date(params.passwordChangedAt);
  if (Number.isNaN(changedAt.getTime())) return true;
  const ageMs = Date.now() - changedAt.getTime();
  return ageMs > getAdminPasswordMaxAgeDays() * 24 * 60 * 60 * 1000;
}

export async function getAdminSecurityState(adminId: number): Promise<AdminSecurityState | null> {
  await ensureAdminSecuritySchema();
  const [rows] = await pool.execute<AdminSecurityRow[]>(
    `SELECT admin_id, role, two_factor_enabled, password_changed_at, force_password_change
     FROM admins
     WHERE admin_id = ?
     LIMIT 1`,
    [adminId],
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    adminId: Number(row.admin_id),
    role: normalizeAdminRole(row.role),
    twoFactorEnabled: Number(row.two_factor_enabled) === 1,
    passwordChangedAt: row.password_changed_at,
    forcePasswordChange: Number(row.force_password_change) === 1,
    requiresPasswordChange: isPasswordChangeRequired({
      passwordChangedAt: row.password_changed_at,
      forcePasswordChange: Number(row.force_password_change) === 1,
    }),
  };
}

export async function prepareAdminTotpSetup(adminId: number, username: string) {
  await ensureAdminSecuritySchema();
  const secret = speakeasy.generateSecret({
    name: `Pecal Admin (${username})`,
    issuer: "Pecal",
    length: 32,
  });

  await pool.execute<ResultSetHeader>(
    `UPDATE admins
     SET two_factor_temp_secret = ?
     WHERE admin_id = ?`,
    [secret.base32, adminId],
  );

  const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url ?? "");

  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url ?? "",
    qrDataUrl,
  };
}

export async function enableAdminTotp(adminId: number, code: string) {
  await ensureAdminSecuritySchema();
  const [rows] = await pool.execute<AdminSecurityRow[]>(
    `SELECT admin_id, two_factor_temp_secret
     FROM admins
     WHERE admin_id = ?
     LIMIT 1`,
    [adminId],
  );
  if (rows.length === 0) return { success: false, reason: "관리자를 찾을 수 없습니다." };

  const tempSecret = rows[0].two_factor_temp_secret;
  if (!tempSecret) {
    return { success: false, reason: "2FA 설정 준비가 필요합니다." };
  }

  const verified = speakeasy.totp.verify({
    secret: tempSecret,
    encoding: "base32",
    token: code,
    window: 1,
  });

  if (!verified) {
    return { success: false, reason: "인증 코드가 올바르지 않습니다." };
  }

  await pool.execute<ResultSetHeader>(
    `UPDATE admins
     SET two_factor_enabled = 1,
         two_factor_secret = ?,
         two_factor_temp_secret = NULL
     WHERE admin_id = ?`,
    [tempSecret, adminId],
  );

  return { success: true };
}

export async function disableAdminTotp(adminId: number, password: string, code: string) {
  await ensureAdminSecuritySchema();
  const [rows] = await pool.execute<(AdminSecurityRow & { password: string })[]>(
    `SELECT admin_id, password, two_factor_secret
     FROM admins
     WHERE admin_id = ?
     LIMIT 1`,
    [adminId],
  );
  if (rows.length === 0) return { success: false, reason: "관리자를 찾을 수 없습니다." };

  const row = rows[0];
  const passwordOk = await bcrypt.compare(password, row.password);
  if (!passwordOk) {
    return { success: false, reason: "비밀번호가 올바르지 않습니다." };
  }
  if (!row.two_factor_secret) {
    return { success: false, reason: "활성화된 2FA가 없습니다." };
  }

  const verified = speakeasy.totp.verify({
    secret: row.two_factor_secret,
    encoding: "base32",
    token: code,
    window: 1,
  });
  if (!verified) {
    return { success: false, reason: "인증 코드가 올바르지 않습니다." };
  }

  await pool.execute<ResultSetHeader>(
    `UPDATE admins
     SET two_factor_enabled = 0,
         two_factor_secret = NULL,
         two_factor_temp_secret = NULL
     WHERE admin_id = ?`,
    [adminId],
  );

  return { success: true };
}

export async function verifyAdminTotpCode(adminId: number, code: string) {
  await ensureAdminSecuritySchema();
  const [rows] = await pool.execute<AdminSecurityRow[]>(
    `SELECT admin_id, two_factor_enabled, two_factor_secret
     FROM admins
     WHERE admin_id = ?
     LIMIT 1`,
    [adminId],
  );
  if (rows.length === 0) return false;
  const row = rows[0];
  if (Number(row.two_factor_enabled) !== 1 || !row.two_factor_secret) return false;

  return speakeasy.totp.verify({
    secret: row.two_factor_secret,
    encoding: "base32",
    token: code,
    window: 1,
  });
}

export async function updateAdminPasswordSecurityState(adminId: number, forcePasswordChange = false) {
  await ensureAdminSecuritySchema();
  await pool.execute<ResultSetHeader>(
    `UPDATE admins
     SET password_changed_at = NOW(),
         force_password_change = ?
     WHERE admin_id = ?`,
    [forcePasswordChange ? 1 : 0, adminId],
  );
}

export async function setAdminForcePasswordChange(adminId: number, forcePasswordChange: boolean) {
  await ensureAdminSecuritySchema();
  await pool.execute<ResultSetHeader>(
    `UPDATE admins
     SET force_password_change = ?
     WHERE admin_id = ?`,
    [forcePasswordChange ? 1 : 0, adminId],
  );
}

export async function updateAdminRole(adminId: number, role: AdminRole) {
  await ensureAdminSecuritySchema();
  await pool.execute<ResultSetHeader>(
    `UPDATE admins
     SET role = ?
     WHERE admin_id = ?`,
    [role, adminId],
  );
}
