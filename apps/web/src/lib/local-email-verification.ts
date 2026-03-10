import { createHash, randomInt } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import pool from "./db";
import { sendLocalRegisterVerificationEmail } from "./mailer";
import { isEmailTaken } from "./member";

const PURPOSE_LOCAL_REGISTER = "local_register";
const CODE_TTL_MINUTES = 3;

let ensureEmailVerificationSchemaPromise: Promise<void> | null = null;

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function toExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + CODE_TTL_MINUTES);
  return expiresAt;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export async function ensureEmailVerificationSchema() {
  if (!ensureEmailVerificationSchemaPromise) {
    ensureEmailVerificationSchemaPromise = pool.execute(`
      CREATE TABLE IF NOT EXISTS email_verification_codes (
        verification_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        purpose VARCHAR(32) NOT NULL,
        email VARCHAR(200) NOT NULL,
        code_hash CHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        verified_at DATETIME NULL,
        consumed_at DATETIME NULL,
        attempts INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_email_verification_lookup (purpose, email, expires_at),
        KEY idx_email_verification_status (purpose, email, verified_at, consumed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).then(() => undefined);
  }

  await ensureEmailVerificationSchemaPromise;
}

async function deleteExistingCodes(email: string) {
  await pool.execute(
    `DELETE FROM email_verification_codes
     WHERE purpose = ? AND email = ?`,
    [PURPOSE_LOCAL_REGISTER, email],
  );
}

export async function sendRegisterVerificationCode(rawEmail: string) {
  await ensureEmailVerificationSchema();
  const email = normalizeEmail(rawEmail);

  if (!isValidEmail(email)) {
    throw new Error("이메일 형식이 올바르지 않습니다.");
  }

  if (await isEmailTaken(email)) {
    throw new Error("이미 사용 중인 이메일입니다.");
  }

  const code = String(randomInt(100000, 1000000));
  const expiresAt = toExpiryDate();

  await deleteExistingCodes(email);
  await pool.execute(
    `INSERT INTO email_verification_codes (
      purpose,
      email,
      code_hash,
      expires_at
    ) VALUES (?, ?, ?, ?)`,
    [PURPOSE_LOCAL_REGISTER, email, hashCode(code), expiresAt],
  );

  try {
    await sendLocalRegisterVerificationEmail({ email, code });
  } catch (error) {
    await deleteExistingCodes(email);
    throw error;
  }
}

export async function verifyRegisterVerificationCode(params: {
  email: string;
  code: string;
}) {
  await ensureEmailVerificationSchema();
  const email = normalizeEmail(params.email);
  const code = params.code.trim();

  if (!isValidEmail(email)) {
    throw new Error("이메일 형식이 올바르지 않습니다.");
  }

  if (!/^\d{6}$/.test(code)) {
    throw new Error("인증 코드는 6자리 숫자여야 합니다.");
  }

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT verification_id, code_hash, expires_at
     FROM email_verification_codes
     WHERE purpose = ?
       AND email = ?
       AND consumed_at IS NULL
     ORDER BY verification_id DESC
     LIMIT 1`,
    [PURPOSE_LOCAL_REGISTER, email],
  );

  const current = rows[0];
  if (!current) {
    throw new Error("먼저 인증 코드를 요청해 주세요.");
  }

  await pool.execute(
    `UPDATE email_verification_codes
     SET attempts = attempts + 1
     WHERE verification_id = ?`,
    [current.verification_id],
  );

  if (new Date(current.expires_at).getTime() < Date.now()) {
    throw new Error("인증 코드가 만료되었습니다. 다시 요청해 주세요.");
  }

  if (current.code_hash !== hashCode(code)) {
    throw new Error("인증 코드가 올바르지 않습니다.");
  }

  await pool.execute(
    `UPDATE email_verification_codes
     SET verified_at = NOW()
     WHERE verification_id = ?`,
    [current.verification_id],
  );
}

export async function consumeVerifiedRegisterEmail(rawEmail: string) {
  await ensureEmailVerificationSchema();
  const email = normalizeEmail(rawEmail);

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT verification_id, expires_at
     FROM email_verification_codes
     WHERE purpose = ?
       AND email = ?
       AND verified_at IS NOT NULL
       AND consumed_at IS NULL
     ORDER BY verification_id DESC
     LIMIT 1`,
    [PURPOSE_LOCAL_REGISTER, email],
  );

  const current = rows[0];
  if (!current) {
    return false;
  }

  if (new Date(current.expires_at).getTime() < Date.now()) {
    return false;
  }

  await pool.execute(
    `UPDATE email_verification_codes
     SET consumed_at = NOW()
     WHERE verification_id = ?`,
    [current.verification_id],
  );

  return true;
}
