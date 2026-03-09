import type { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "@/lib/db";

export type MobileClientEventType = "WIDGET_SYNC_FAILURE" | "WIDGET_SYNC_SUCCESS" | "APP_HEARTBEAT";

interface PolicyRow extends RowDataPacket {
  platform: string;
  min_supported_version: string | null;
  recommended_version: string | null;
  force_update_enabled: number;
  update_message: string | null;
  updated_by_admin_id: number | null;
  updated_at: string | Date;
}

let ensurePromise: Promise<void> | null = null;

async function ensureSchema() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS mobile_client_event_logs (
          event_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          member_id BIGINT NULL,
          platform VARCHAR(16) NOT NULL,
          event_type VARCHAR(64) NOT NULL,
          app_version VARCHAR(32) NULL,
          payload_json JSON NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY idx_mobile_client_event_logs_type_created (event_type, created_at),
          KEY idx_mobile_client_event_logs_platform_version (platform, app_version)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS mobile_release_policies (
          platform VARCHAR(16) NOT NULL PRIMARY KEY,
          min_supported_version VARCHAR(32) NULL,
          recommended_version VARCHAR(32) NULL,
          force_update_enabled TINYINT(1) NOT NULL DEFAULT 0,
          update_message VARCHAR(255) NULL,
          updated_by_admin_id BIGINT NULL,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await pool.execute(
        `INSERT IGNORE INTO mobile_release_policies (platform, min_supported_version, recommended_version, force_update_enabled)
         VALUES ('ios', NULL, NULL, 0), ('android', NULL, NULL, 0)`,
      );
    })();
  }
  await ensurePromise;
}

function parseJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function compareVersions(a: string | null | undefined, b: string | null | undefined) {
  const aParts = String(a ?? "0").split(".").map((part) => Number(part.replace(/\D/g, "") || 0));
  const bParts = String(b ?? "0").split(".").map((part) => Number(part.replace(/\D/g, "") || 0));
  const length = Math.max(aParts.length, bParts.length);
  for (let index = 0; index < length; index += 1) {
    const left = aParts[index] ?? 0;
    const right = bParts[index] ?? 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }
  return 0;
}

export async function createMobileClientEvent(params: {
  memberId?: number | null;
  platform: "ios" | "android";
  eventType: MobileClientEventType;
  appVersion?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  await ensureSchema();
  await pool.execute<ResultSetHeader>(
    `INSERT INTO mobile_client_event_logs (member_id, platform, event_type, app_version, payload_json)
     VALUES (?, ?, ?, ?, ?)`,
    [
      params.memberId ?? null,
      params.platform,
      params.eventType,
      params.appVersion ?? null,
      params.payload ? JSON.stringify(params.payload) : null,
    ],
  );
}

export async function getMobileOpsData() {
  await ensureSchema();
  const [policyRows] = await pool.execute<PolicyRow[]>(
    `SELECT platform, min_supported_version, recommended_version, force_update_enabled, update_message, updated_by_admin_id, updated_at
     FROM mobile_release_policies
     ORDER BY platform ASC`,
  );
  const [widgetFailureRows] = await pool.execute<RowDataPacket[]>(
    `SELECT event_id, member_id, platform, app_version, payload_json, created_at
     FROM mobile_client_event_logs
     WHERE event_type = 'WIDGET_SYNC_FAILURE'
     ORDER BY created_at DESC
     LIMIT 30`,
  );
  const [[widgetFailureSummary]] = await pool.query<RowDataPacket[]>(`
    SELECT COUNT(*) AS failures_24h
    FROM mobile_client_event_logs
    WHERE event_type = 'WIDGET_SYNC_FAILURE'
      AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
  `);
  const [versionRows] = await pool.execute<RowDataPacket[]>(
    `SELECT platform, COALESCE(app_build, 'unknown') AS app_version, COUNT(DISTINCT member_id) AS user_count
     FROM member_push_tokens
     WHERE is_active = 1
     GROUP BY platform, app_build
     ORDER BY user_count DESC, app_build DESC`,
  );

  const policies = policyRows.map((row) => ({
    platform: String(row.platform),
    minSupportedVersion: row.min_supported_version ? String(row.min_supported_version) : null,
    recommendedVersion: row.recommended_version ? String(row.recommended_version) : null,
    forceUpdateEnabled: Number(row.force_update_enabled) === 1,
    updateMessage: row.update_message ? String(row.update_message) : null,
    updatedByAdminId: row.updated_by_admin_id == null ? null : Number(row.updated_by_admin_id),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));

  const versionDistribution = versionRows.map((row) => {
    const platform = String(row.platform) as "ios" | "android";
    const appVersion = String(row.app_version ?? "unknown");
    const policy = policies.find((item) => item.platform === platform);
    const belowMin = !!policy?.minSupportedVersion && compareVersions(appVersion, policy.minSupportedVersion) < 0;
    const belowRecommended = !!policy?.recommendedVersion && compareVersions(appVersion, policy.recommendedVersion) < 0;
    return {
      platform,
      appVersion,
      userCount: Number(row.user_count ?? 0),
      belowMin,
      belowRecommended,
    };
  });

  const oldVersionWarnings = policies.map((policy) => ({
    platform: policy.platform,
    belowMinCount: versionDistribution
      .filter((item) => item.platform === policy.platform && item.belowMin)
      .reduce((sum, item) => sum + item.userCount, 0),
    belowRecommendedCount: versionDistribution
      .filter((item) => item.platform === policy.platform && item.belowRecommended)
      .reduce((sum, item) => sum + item.userCount, 0),
  }));

  return {
    policies,
    widgetFailures24h: Number(widgetFailureSummary?.failures_24h ?? 0),
    widgetFailures: widgetFailureRows.map((row) => ({
      eventId: Number(row.event_id),
      memberId: row.member_id == null ? null : Number(row.member_id),
      platform: String(row.platform),
      appVersion: row.app_version ? String(row.app_version) : null,
      payload: parseJson(row.payload_json),
      createdAt: new Date(row.created_at).toISOString(),
    })),
    versionDistribution,
    oldVersionWarnings,
  };
}

export async function updateMobileReleasePolicy(params: {
  platform: "ios" | "android";
  minSupportedVersion?: string | null;
  recommendedVersion?: string | null;
  forceUpdateEnabled?: boolean;
  updateMessage?: string | null;
  updatedByAdminId: number;
}) {
  await ensureSchema();
  await pool.execute<ResultSetHeader>(
    `UPDATE mobile_release_policies
     SET min_supported_version = ?,
         recommended_version = ?,
         force_update_enabled = ?,
         update_message = ?,
         updated_by_admin_id = ?
     WHERE platform = ?`,
    [
      params.minSupportedVersion ?? null,
      params.recommendedVersion ?? null,
      params.forceUpdateEnabled ? 1 : 0,
      params.updateMessage ?? null,
      params.updatedByAdminId,
      params.platform,
    ],
  );
}
