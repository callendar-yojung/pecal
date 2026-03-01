import type { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "@/lib/db";

type MemberSettingsRow = RowDataPacket & {
  member_id: number;
  privacy_consent: number;
  marketing_consent: number;
};

type MemberConsentPatch = {
  privacy_consent?: boolean;
  marketing_consent?: boolean;
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
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_member_settings_member
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

export async function upsertMemberConsents(
  memberId: number,
  patch: MemberConsentPatch,
) {
  await ensureMemberSettingsTable();

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

  return getMemberConsents(memberId);
}

