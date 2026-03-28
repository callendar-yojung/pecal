import type { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "@/lib/db";

type MemberSettingsRow = RowDataPacket & {
  member_id: number;
  privacy_consent: number;
  marketing_consent: number;
  task_color_presets: string | null;
};

type MemberConsentPatch = {
  privacy_consent?: boolean;
  marketing_consent?: boolean;
};

export interface MemberConsentHistoryItem {
  historyId: number;
  memberId: number;
  consentType: "privacy" | "marketing";
  previousValue: boolean;
  currentValue: boolean;
  changedByType: "member" | "admin" | "system";
  changedById: number | null;
  changedAt: string;
}

type MemberConsentHistoryRow = RowDataPacket & {
  consent_history_id: number;
  member_id: number;
  consent_type: "privacy" | "marketing";
  previous_value: number;
  current_value: number;
  changed_by_type: "member" | "admin" | "system";
  changed_by_id: number | null;
  changed_at: string;
};

let ensureTablePromise: Promise<void> | null = null;

async function ensureMemberSettingsTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS member_settings (
          member_id BIGINT NOT NULL PRIMARY KEY,
          privacy_consent TINYINT(1) NOT NULL DEFAULT 0,
          marketing_consent TINYINT(1) NOT NULL DEFAULT 0,
          task_color_presets JSON NULL,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_member_settings_member
            FOREIGN KEY (member_id) REFERENCES members(member_id)
            ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      try {
        await pool.execute(`
          ALTER TABLE member_settings
          ADD COLUMN IF NOT EXISTS task_color_presets JSON NULL
        `);
      } catch {
        // Older MySQL variants may not support IF NOT EXISTS on ADD COLUMN.
      }
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS member_consent_history (
          consent_history_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          member_id BIGINT NOT NULL,
          consent_type ENUM('privacy', 'marketing') NOT NULL,
          previous_value TINYINT(1) NOT NULL,
          current_value TINYINT(1) NOT NULL,
          changed_by_type ENUM('member', 'admin', 'system') NOT NULL DEFAULT 'member',
          changed_by_id BIGINT NULL,
          changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY idx_member_consent_history_member_changed (member_id, changed_at),
          KEY idx_member_consent_history_type_changed (consent_type, changed_at),
          CONSTRAINT fk_member_consent_history_member
            FOREIGN KEY (member_id) REFERENCES members(member_id)
            ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    })();
  }
  await ensureTablePromise;
}

export async function getMemberConsents(memberId: number): Promise<{
  privacy_consent: boolean;
  marketing_consent: boolean;
}> {
  await ensureMemberSettingsTable();
  const [rows] = await pool.execute<MemberSettingsRow[]>(
    `SELECT member_id, privacy_consent, marketing_consent
     FROM member_settings
     WHERE member_id = ?
     LIMIT 1`,
    [memberId],
  );

  if (rows.length === 0) {
    return {
      privacy_consent: false,
      marketing_consent: false,
    };
  }

  const row = rows[0];
  return {
    privacy_consent: Number(row.privacy_consent) === 1,
    marketing_consent: Number(row.marketing_consent) === 1,
  };
}

export async function getMemberTaskColorPresets(memberId: number): Promise<string[]> {
  await ensureMemberSettingsTable();
  const [rows] = await pool.execute<MemberSettingsRow[]>(
    `SELECT task_color_presets
     FROM member_settings
     WHERE member_id = ?
     LIMIT 1`,
    [memberId],
  );

  if (rows.length === 0) return [];

  const raw = rows[0].task_color_presets;
  if (!raw) return [];

  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => String(item ?? "").trim().toUpperCase())
      .filter((item) => /^#[0-9A-F]{6}$/.test(item));
  } catch {
    return [];
  }
}

async function createConsentHistoryEntry(params: {
  memberId: number;
  consentType: "privacy" | "marketing";
  previousValue: boolean;
  currentValue: boolean;
  changedByType?: "member" | "admin" | "system";
  changedById?: number | null;
}) {
  await pool.execute<ResultSetHeader>(
    `INSERT INTO member_consent_history
      (member_id, consent_type, previous_value, current_value, changed_by_type, changed_by_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      params.memberId,
      params.consentType,
      params.previousValue ? 1 : 0,
      params.currentValue ? 1 : 0,
      params.changedByType ?? "member",
      params.changedById ?? null,
    ],
  );
}

export async function upsertMemberConsents(
  memberId: number,
  patch: MemberConsentPatch,
  options?: {
    changedByType?: "member" | "admin" | "system";
    changedById?: number | null;
  },
) {
  await ensureMemberSettingsTable();

  const previous = await getMemberConsents(memberId);

  const privacyValue =
    patch.privacy_consent === undefined
      ? null
      : patch.privacy_consent
        ? 1
        : 0;
  const marketingValue =
    patch.marketing_consent === undefined
      ? null
      : patch.marketing_consent
        ? 1
        : 0;

  await pool.execute<ResultSetHeader>(
    `INSERT INTO member_settings (member_id, privacy_consent, marketing_consent)
     VALUES (?, COALESCE(?, 0), COALESCE(?, 0))
     ON DUPLICATE KEY UPDATE
       privacy_consent = COALESCE(VALUES(privacy_consent), privacy_consent),
       marketing_consent = COALESCE(VALUES(marketing_consent), marketing_consent)`,
    [memberId, privacyValue, marketingValue],
  );

  const current = await getMemberConsents(memberId);

  if (
    patch.privacy_consent !== undefined &&
    previous.privacy_consent !== current.privacy_consent
  ) {
    await createConsentHistoryEntry({
      memberId,
      consentType: "privacy",
      previousValue: previous.privacy_consent,
      currentValue: current.privacy_consent,
      changedByType: options?.changedByType,
      changedById: options?.changedById,
    });
  }

  if (
    patch.marketing_consent !== undefined &&
    previous.marketing_consent !== current.marketing_consent
  ) {
    await createConsentHistoryEntry({
      memberId,
      consentType: "marketing",
      previousValue: previous.marketing_consent,
      currentValue: current.marketing_consent,
      changedByType: options?.changedByType,
      changedById: options?.changedById,
    });
  }

  return current;
}

export async function upsertMemberTaskColorPresets(
  memberId: number,
  presets: string[],
): Promise<string[]> {
  await ensureMemberSettingsTable();
  const safePresets = presets
    .map((item) => String(item ?? "").trim().toUpperCase())
    .filter((item) => /^#[0-9A-F]{6}$/.test(item))
    .slice(0, 24);

  await pool.execute<ResultSetHeader>(
    `INSERT INTO member_settings (member_id, task_color_presets)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
       task_color_presets = VALUES(task_color_presets)`,
    [memberId, JSON.stringify(safePresets)],
  );

  return safePresets;
}

export async function listMemberConsentHistory(
  memberId: number,
  limit = 50,
): Promise<MemberConsentHistoryItem[]> {
  await ensureMemberSettingsTable();
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  const [rows] = await pool.query<MemberConsentHistoryRow[]>(
    `SELECT consent_history_id, member_id, consent_type, previous_value, current_value,
            changed_by_type, changed_by_id, changed_at
     FROM member_consent_history
     WHERE member_id = ?
     ORDER BY changed_at DESC
     LIMIT ${safeLimit}`,
    [memberId],
  );

  return rows.map((row) => ({
    historyId: Number(row.consent_history_id),
    memberId: Number(row.member_id),
    consentType: row.consent_type,
    previousValue: Number(row.previous_value) === 1,
    currentValue: Number(row.current_value) === 1,
    changedByType: row.changed_by_type,
    changedById: row.changed_by_id === null ? null : Number(row.changed_by_id),
    changedAt: row.changed_at,
  }));
}
