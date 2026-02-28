import type { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "./db";

export type PushPlatform = "ios" | "android";

function normalizePlatform(value: unknown): PushPlatform | null {
  if (value === "ios" || value === "android") return value;
  return null;
}

export function isLikelyExpoPushToken(token: string): boolean {
  return /^ExponentPushToken\[.+\]$/.test(token) || /^ExpoPushToken\[.+\]$/.test(token);
}

export async function upsertMemberPushToken(params: {
  memberId: number;
  token: string;
  platform: PushPlatform;
  deviceId?: string | null;
  appBuild?: string | null;
}): Promise<void> {
  const platform = normalizePlatform(params.platform);
  if (!platform) {
    throw new Error("Invalid platform");
  }

  const token = params.token.trim();
  if (!token || token.length > 255) {
    throw new Error("Invalid token");
  }

  await pool.execute<ResultSetHeader>(
    `INSERT INTO member_push_tokens (
       member_id, token, platform, device_id, app_build, is_active, created_at, updated_at, last_seen_at
     ) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       member_id = VALUES(member_id),
       platform = VALUES(platform),
       device_id = VALUES(device_id),
       app_build = VALUES(app_build),
       is_active = 1,
       updated_at = NOW(),
       last_seen_at = NOW()`,
    [
      params.memberId,
      token,
      platform,
      params.deviceId ?? null,
      params.appBuild ?? null,
    ],
  );
}

export async function deactivatePushTokenForMember(memberId: number, token: string): Promise<void> {
  await pool.execute<ResultSetHeader>(
    `UPDATE member_push_tokens
     SET is_active = 0, updated_at = NOW()
     WHERE member_id = ? AND token = ?`,
    [memberId, token.trim()],
  );
}

export async function getActivePushTokensByMemberIds(
  memberIds: number[],
): Promise<Array<{ member_id: number; token: string; platform: PushPlatform }>> {
  if (memberIds.length === 0) return [];
  const placeholders = memberIds.map(() => "?").join(",");
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT member_id, token, platform
     FROM member_push_tokens
     WHERE is_active = 1
       AND member_id IN (${placeholders})`,
    memberIds,
  );

  return rows
    .map((row) => ({
      member_id: Number(row.member_id),
      token: String(row.token ?? ""),
      platform: normalizePlatform(row.platform) ?? "ios",
    }))
    .filter((row) => row.member_id > 0 && row.token.length > 0);
}

export async function deactivatePushTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  const uniqueTokens = [...new Set(tokens.map((token) => token.trim()).filter(Boolean))];
  if (uniqueTokens.length === 0) return;
  const placeholders = uniqueTokens.map(() => "?").join(",");
  await pool.execute<ResultSetHeader>(
    `UPDATE member_push_tokens
     SET is_active = 0, updated_at = NOW()
     WHERE token IN (${placeholders})`,
    uniqueTokens,
  );
}
