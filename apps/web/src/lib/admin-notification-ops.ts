import type { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "@/lib/db";
import { invalidateMemberCaches } from "@/lib/member-cache";
import { createNotificationsBulk } from "@/lib/notification";
import { sendExpoPushNotifications } from "@/lib/push-notification";
import { getActivePushTokensByMemberIds } from "@/lib/push-token";

export type AdminNotificationTarget = "all" | "members";
export type AdminNotificationStatus = "scheduled" | "sent" | "failed";

export type EligibleMember = {
  member_id: number;
  email: string | null;
  nickname: string | null;
  provider: string | null;
};

export type NotificationAudiencePreview = {
  requestedCount: number;
  eligibleCount: number;
  excludedMarketingCount: number;
  eligibleMembers: EligibleMember[];
};

export type AdminNotificationHistoryRecord = {
  broadcast_id: number;
  admin_id: number;
  admin_username: string | null;
  title: string;
  message: string;
  target_mode: AdminNotificationTarget;
  requested_count: number;
  eligible_count: number;
  excluded_marketing_count: number;
  app_notification_count: number;
  push_sent_count: number;
  invalid_token_count: number;
  send_push: number;
  status: AdminNotificationStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  error_message: string | null;
  recipient_preview_json: string | null;
};

let ensureTablePromise: Promise<void> | null = null;

async function ensureAdminNotificationTables() {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS admin_notification_broadcasts (
          broadcast_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          admin_id BIGINT NOT NULL,
          admin_username VARCHAR(120) NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          target_mode ENUM('all', 'members') NOT NULL,
          requested_count INT NOT NULL DEFAULT 0,
          eligible_count INT NOT NULL DEFAULT 0,
          excluded_marketing_count INT NOT NULL DEFAULT 0,
          app_notification_count INT NOT NULL DEFAULT 0,
          push_sent_count INT NOT NULL DEFAULT 0,
          invalid_token_count INT NOT NULL DEFAULT 0,
          send_push TINYINT(1) NOT NULL DEFAULT 1,
          status ENUM('scheduled', 'sent', 'failed') NOT NULL DEFAULT 'scheduled',
          selected_member_ids_json JSON NULL,
          recipient_preview_json JSON NULL,
          scheduled_at DATETIME NULL,
          sent_at DATETIME NULL,
          error_message TEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_admin_notification_status_scheduled (status, scheduled_at),
          INDEX idx_admin_notification_created_at (created_at),
          INDEX idx_admin_notification_admin_id (admin_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    })();
  }

  await ensureTablePromise;
}

function sanitizeMemberIds(memberIds: number[]) {
  return [...new Set(memberIds.map(Number).filter((value) => Number.isInteger(value) && value > 0))];
}

function mapEligibleMembers(rows: RowDataPacket[]): EligibleMember[] {
  return rows.map((row) => ({
    member_id: Number(row.member_id),
    email: row.email ? String(row.email) : null,
    nickname: row.nickname ? String(row.nickname) : null,
    provider: row.provider ? String(row.provider) : null,
  }));
}

export async function buildNotificationAudiencePreview(params: {
  target: AdminNotificationTarget;
  memberIds?: number[];
}): Promise<NotificationAudiencePreview> {
  const target = params.target === "members" ? "members" : "all";
  const memberIds = sanitizeMemberIds(params.memberIds ?? []);

  if (target === "members") {
    const requestedCount = memberIds.length;
    if (requestedCount === 0) {
      return {
        requestedCount: 0,
        eligibleCount: 0,
        excludedMarketingCount: 0,
        eligibleMembers: [],
      };
    }

    const placeholders = memberIds.map(() => "?").join(",");
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT m.member_id, m.email, m.nickname, m.provider
       FROM members m
       INNER JOIN member_settings ms ON ms.member_id = m.member_id
       WHERE ms.marketing_consent = 1
         AND m.member_id IN (${placeholders})
       ORDER BY m.member_id ASC`,
      memberIds,
    );

    const eligibleMembers = mapEligibleMembers(rows);
    return {
      requestedCount,
      eligibleCount: eligibleMembers.length,
      excludedMarketingCount: Math.max(requestedCount - eligibleMembers.length, 0),
      eligibleMembers,
    };
  }

  const [[totals]] = await pool.query<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*) FROM members) AS requestedCount,
       (
         SELECT COUNT(*)
         FROM members m
         INNER JOIN member_settings ms ON ms.member_id = m.member_id
         WHERE ms.marketing_consent = 1
       ) AS eligibleCount`,
  );

  const [eligibleRows] = await pool.query<RowDataPacket[]>(
    `SELECT m.member_id, m.email, m.nickname, m.provider
     FROM members m
     INNER JOIN member_settings ms ON ms.member_id = m.member_id
     WHERE ms.marketing_consent = 1
     ORDER BY m.member_id ASC`,
  );

  const requestedCount = Number(totals?.requestedCount ?? 0);
  const eligibleCount = Number(totals?.eligibleCount ?? 0);
  return {
    requestedCount,
    eligibleCount,
    excludedMarketingCount: Math.max(requestedCount - eligibleCount, 0),
    eligibleMembers: mapEligibleMembers(eligibleRows),
  };
}

export async function createAdminBroadcast(params: {
  adminId: number;
  adminUsername: string;
  title: string;
  message: string;
  target: AdminNotificationTarget;
  sendPush: boolean;
  scheduledAt?: string | null;
  selectedMemberIds?: number[];
}) {
  await ensureAdminNotificationTables();

  const preview = await buildNotificationAudiencePreview({
    target: params.target,
    memberIds: params.selectedMemberIds,
  });

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO admin_notification_broadcasts (
       admin_id, admin_username, title, message, target_mode,
       requested_count, eligible_count, excluded_marketing_count,
       send_push, status, selected_member_ids_json, recipient_preview_json, scheduled_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.adminId,
      params.adminUsername,
      params.title.trim(),
      params.message.trim(),
      params.target,
      preview.requestedCount,
      preview.eligibleCount,
      preview.excludedMarketingCount,
      params.sendPush ? 1 : 0,
      params.scheduledAt ? "scheduled" : "sent",
      params.target === "members"
        ? JSON.stringify(sanitizeMemberIds(params.selectedMemberIds ?? []))
        : null,
      JSON.stringify(preview.eligibleMembers.slice(0, 20)),
      params.scheduledAt ?? null,
    ],
  );

  return {
    broadcastId: Number(result.insertId),
    preview,
  };
}

export async function dispatchAdminBroadcast(broadcastId: number) {
  await ensureAdminNotificationTables();

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT *
     FROM admin_notification_broadcasts
     WHERE broadcast_id = ?
     LIMIT 1`,
    [broadcastId],
  );

  const row = rows[0];
  if (!row) {
    throw new Error("Broadcast not found");
  }

  const target = String(row.target_mode) === "members" ? "members" : "all";
  const selectedMemberIds = row.selected_member_ids_json
    ? (JSON.parse(String(row.selected_member_ids_json)) as number[])
    : [];

  const preview = await buildNotificationAudiencePreview({
    target,
    memberIds: selectedMemberIds,
  });

  try {
    const created = await createNotificationsBulk(
      preview.eligibleMembers.map((member) => ({
        member_id: member.member_id,
        type: "ADMIN_BROADCAST",
        title: String(row.title),
        message: String(row.message),
        payload: {
          category: "ADMIN_BROADCAST",
          target,
          broadcastId,
          sentBy: {
            admin_id: Number(row.admin_id),
            username: row.admin_username ? String(row.admin_username) : "",
          },
        },
        source_type: "ADMIN_BROADCAST",
        source_id: Number(row.admin_id),
      })),
    );

    await Promise.all(
      preview.eligibleMembers.map((member) =>
        invalidateMemberCaches(member.member_id, {
          notificationsUnread: true,
          notificationsList: true,
        }),
      ),
    );

    let pushSent = 0;
    let invalidTokenCount = 0;
    if (Number(row.send_push) === 1 && preview.eligibleMembers.length > 0) {
      const pushTokens = await getActivePushTokensByMemberIds(
        preview.eligibleMembers.map((member) => member.member_id),
      );
      if (pushTokens.length > 0) {
        const pushResult = await sendExpoPushNotifications(
          pushTokens.map((token) => ({
            to: token.token,
            title: String(row.title),
            body: String(row.message),
            sound: "default",
            priority: "high",
            data: {
              type: "ADMIN_BROADCAST",
              broadcastId,
              target,
            },
          })),
        );
        pushSent = pushResult.sent;
        invalidTokenCount = pushResult.invalidTokens.length;
      }
    }

    await pool.execute(
      `UPDATE admin_notification_broadcasts
       SET status = 'sent',
           requested_count = ?,
           eligible_count = ?,
           excluded_marketing_count = ?,
           app_notification_count = ?,
           push_sent_count = ?,
           invalid_token_count = ?,
           recipient_preview_json = ?,
           sent_at = NOW(),
           error_message = NULL
       WHERE broadcast_id = ?`,
      [
        preview.requestedCount,
        preview.eligibleCount,
        preview.excludedMarketingCount,
        created,
        pushSent,
        invalidTokenCount,
        JSON.stringify(preview.eligibleMembers.slice(0, 20)),
        broadcastId,
      ],
    );

    return {
      created,
      pushSent,
      invalidTokenCount,
      requestedCount: preview.requestedCount,
      eligibleCount: preview.eligibleCount,
      excludedMarketingCount: preview.excludedMarketingCount,
    };
  } catch (error) {
    await pool.execute(
      `UPDATE admin_notification_broadcasts
       SET status = 'failed', error_message = ?
       WHERE broadcast_id = ?`,
      [error instanceof Error ? error.message : String(error), broadcastId],
    );
    throw error;
  }
}

export async function listAdminBroadcasts(limit = 20) {
  await ensureAdminNotificationTables();
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       broadcast_id, admin_id, admin_username, title, message, target_mode,
       requested_count, eligible_count, excluded_marketing_count,
       app_notification_count, push_sent_count, invalid_token_count,
       send_push, status, scheduled_at, sent_at, created_at, error_message,
       recipient_preview_json
     FROM admin_notification_broadcasts
     ORDER BY created_at DESC
     LIMIT ${safeLimit}`,
  );

  return rows as AdminNotificationHistoryRecord[];
}

export async function processDueAdminBroadcasts(now = new Date()) {
  await ensureAdminNotificationTables();

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT broadcast_id
     FROM admin_notification_broadcasts
     WHERE status = 'scheduled'
       AND scheduled_at IS NOT NULL
       AND scheduled_at <= ?
     ORDER BY scheduled_at ASC
     LIMIT 50`,
    [now],
  );

  const ids = rows.map((row) => Number(row.broadcast_id)).filter((id) => id > 0);
  const results: Array<{ broadcastId: number; success: boolean; error?: string }> = [];

  for (const broadcastId of ids) {
    try {
      await dispatchAdminBroadcast(broadcastId);
      results.push({ broadcastId, success: true });
    } catch (error) {
      results.push({
        broadcastId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
