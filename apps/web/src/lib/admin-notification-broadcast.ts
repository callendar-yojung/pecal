import type { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "@/lib/db";
import { invalidateMemberCaches } from "@/lib/member-cache";
import { createNotificationsBulk } from "@/lib/notification";
import { sendExpoPushNotifications } from "@/lib/push-notification";
import { getActivePushTokensByMemberIds } from "@/lib/push-token";

export type AdminNotificationTarget = "all" | "members";
export type AdminNotificationStatus = "scheduled" | "processing" | "sent" | "failed";

export interface AdminNotificationPreviewRecipient {
  memberId: number;
  nickname: string;
  email: string;
  provider: string;
}

export interface AdminNotificationAudiencePreview {
  requestedMemberCount: number;
  eligibleMemberCount: number;
  excludedMarketingCount: number;
  eligibleMemberIds: number[];
  previewRecipients: AdminNotificationPreviewRecipient[];
}

export interface AdminNotificationHistoryItem {
  broadcastId: number;
  adminId: number;
  adminUsername: string;
  title: string;
  message: string;
  targetMode: AdminNotificationTarget;
  sendPush: boolean;
  status: AdminNotificationStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  requestedMemberCount: number;
  eligibleMemberCount: number;
  excludedMarketingCount: number;
  appNotificationCount: number;
  pushSentCount: number;
  invalidTokenCount: number;
  selectedMemberIds: number[];
  previewRecipients: AdminNotificationPreviewRecipient[];
  errorMessage: string | null;
}

interface MemberAudienceRow extends RowDataPacket {
  member_id: number;
  nickname: string | null;
  email: string | null;
  provider: string | null;
  marketing_consent: number | null;
}

interface BroadcastRow extends RowDataPacket {
  broadcast_id: number;
  admin_id: number;
  admin_username: string | null;
  title: string;
  message: string;
  target_mode: AdminNotificationTarget;
  send_push: number;
  status: AdminNotificationStatus;
  scheduled_at: Date | string | null;
  sent_at: Date | string | null;
  created_at: Date | string;
  requested_member_count: number;
  eligible_member_count: number;
  excluded_marketing_count: number;
  app_notification_count: number;
  push_sent_count: number;
  invalid_token_count: number;
  selected_member_ids_json: string | null;
  recipient_preview_json: string | null;
  error_message: string | null;
}

let ensureTablePromise: Promise<void> | null = null;

async function ensureAdminNotificationBroadcastsTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS admin_notification_broadcasts (
          broadcast_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          admin_id BIGINT NOT NULL,
          admin_username VARCHAR(100) NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          target_mode ENUM('all', 'members') NOT NULL,
          selected_member_ids_json JSON NULL,
          requested_member_count INT NOT NULL DEFAULT 0,
          eligible_member_count INT NOT NULL DEFAULT 0,
          excluded_marketing_count INT NOT NULL DEFAULT 0,
          app_notification_count INT NOT NULL DEFAULT 0,
          push_sent_count INT NOT NULL DEFAULT 0,
          invalid_token_count INT NOT NULL DEFAULT 0,
          send_push TINYINT(1) NOT NULL DEFAULT 1,
          status ENUM('scheduled', 'processing', 'sent', 'failed') NOT NULL DEFAULT 'scheduled',
          scheduled_at DATETIME NULL,
          sent_at DATETIME NULL,
          recipient_preview_json JSON NULL,
          error_message TEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY idx_admin_notification_broadcasts_status_scheduled (status, scheduled_at),
          KEY idx_admin_notification_broadcasts_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    })();
  }

  await ensureTablePromise;
}

function uniquePositiveIntegers(values: number[]): number[] {
  return [...new Set(values.filter((value) => Number.isInteger(value) && value > 0))];
}

function toIsoString(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseJsonArray(value: string | null): number[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(Number).filter((entry) => Number.isInteger(entry) && entry > 0);
  } catch {
    return [];
  }
}

function parsePreviewRecipients(value: string | null): AdminNotificationPreviewRecipient[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        const row = entry as Record<string, unknown>;
        return {
          memberId: Number(row.memberId),
          nickname: String(row.nickname ?? ""),
          email: String(row.email ?? ""),
          provider: String(row.provider ?? ""),
        };
      })
      .filter((row) => row.memberId > 0);
  } catch {
    return [];
  }
}

async function fetchAudienceRows(
  target: AdminNotificationTarget,
  memberIds: number[],
): Promise<MemberAudienceRow[]> {
  if (target === "members") {
    const filtered = uniquePositiveIntegers(memberIds);
    if (filtered.length === 0) return [];
    const placeholders = filtered.map(() => "?").join(",");
    const [rows] = await pool.query<MemberAudienceRow[]>(
      `SELECT
         m.member_id,
         m.nickname,
         m.email,
         m.provider,
         COALESCE(ms.marketing_consent, 0) AS marketing_consent
       FROM members m
       LEFT JOIN member_settings ms ON ms.member_id = m.member_id
       WHERE m.member_id IN (${placeholders})
       ORDER BY m.nickname ASC, m.member_id ASC`,
      filtered,
    );
    return rows;
  }

  const [rows] = await pool.query<MemberAudienceRow[]>(
    `SELECT
       m.member_id,
       m.nickname,
       m.email,
       m.provider,
       COALESCE(ms.marketing_consent, 0) AS marketing_consent
     FROM members m
     LEFT JOIN member_settings ms ON ms.member_id = m.member_id
     ORDER BY m.created_at DESC, m.member_id DESC`,
  );
  return rows;
}

export async function buildAdminNotificationAudiencePreview(params: {
  target: AdminNotificationTarget;
  memberIds: number[];
}): Promise<AdminNotificationAudiencePreview> {
  const rows = await fetchAudienceRows(params.target, params.memberIds);
  const requestedMemberCount =
    params.target === "members"
      ? uniquePositiveIntegers(params.memberIds).length
      : rows.length;

  const eligibleRows = rows.filter((row) => Number(row.marketing_consent) === 1);
  const eligibleMemberIds = eligibleRows.map((row) => Number(row.member_id));
  const previewRecipients = eligibleRows.slice(0, 8).map((row) => ({
    memberId: Number(row.member_id),
    nickname: String(row.nickname ?? ""),
    email: String(row.email ?? ""),
    provider: String(row.provider ?? ""),
  }));

  return {
    requestedMemberCount,
    eligibleMemberCount: eligibleRows.length,
    excludedMarketingCount: Math.max(0, requestedMemberCount - eligibleRows.length),
    eligibleMemberIds,
    previewRecipients,
  };
}

async function insertBroadcast(params: {
  adminId: number;
  adminUsername: string;
  title: string;
  message: string;
  target: AdminNotificationTarget;
  memberIds: number[];
  requestedMemberCount: number;
  eligibleMemberCount: number;
  excludedMarketingCount: number;
  previewRecipients: AdminNotificationPreviewRecipient[];
  sendPush: boolean;
  status: AdminNotificationStatus;
  scheduledAt?: Date | null;
}) {
  await ensureAdminNotificationBroadcastsTable();

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO admin_notification_broadcasts (
       admin_id,
       admin_username,
       title,
       message,
       target_mode,
       selected_member_ids_json,
       requested_member_count,
       eligible_member_count,
       excluded_marketing_count,
       send_push,
       status,
       scheduled_at,
       recipient_preview_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.adminId,
      params.adminUsername,
      params.title,
      params.message,
      params.target,
      JSON.stringify(uniquePositiveIntegers(params.memberIds)),
      params.requestedMemberCount,
      params.eligibleMemberCount,
      params.excludedMarketingCount,
      params.sendPush ? 1 : 0,
      params.status,
      params.scheduledAt ?? null,
      JSON.stringify(params.previewRecipients),
    ],
  );

  return Number(result.insertId);
}

async function updateBroadcastAfterSend(params: {
  broadcastId: number;
  status: AdminNotificationStatus;
  appNotificationCount: number;
  pushSentCount: number;
  invalidTokenCount: number;
  errorMessage?: string | null;
}) {
  await ensureAdminNotificationBroadcastsTable();
  await pool.execute(
    `UPDATE admin_notification_broadcasts
     SET status = ?,
         app_notification_count = ?,
         push_sent_count = ?,
         invalid_token_count = ?,
         sent_at = CASE WHEN ? IN ('sent', 'failed') THEN NOW() ELSE sent_at END,
         error_message = ?
     WHERE broadcast_id = ?`,
    [
      params.status,
      params.appNotificationCount,
      params.pushSentCount,
      params.invalidTokenCount,
      params.status,
      params.errorMessage ?? null,
      params.broadcastId,
    ],
  );
}

async function executeAdminNotificationBroadcast(params: {
  broadcastId: number;
  adminId: number;
  adminUsername: string;
  title: string;
  message: string;
  target: AdminNotificationTarget;
  sendPush: boolean;
  audience: AdminNotificationAudiencePreview;
}) {
  const payload = {
    category: "ADMIN_BROADCAST",
    target: params.target,
    broadcast_id: params.broadcastId,
    sentBy: {
      admin_id: params.adminId,
      username: params.adminUsername,
    },
  };

  const appNotificationCount = await createNotificationsBulk(
    params.audience.eligibleMemberIds.map((memberId) => ({
      member_id: memberId,
      type: "ADMIN_BROADCAST",
      title: params.title,
      message: params.message,
      payload,
      source_type: "ADMIN_BROADCAST",
      source_id: params.broadcastId,
    })),
  );

  await Promise.all(
    params.audience.eligibleMemberIds.map((memberId) =>
      invalidateMemberCaches(memberId, {
        notificationsUnread: true,
        notificationsList: true,
      }),
    ),
  );

  let pushSentCount = 0;
  let invalidTokenCount = 0;
  if (params.sendPush) {
    const pushTokens = await getActivePushTokensByMemberIds(params.audience.eligibleMemberIds);
    if (pushTokens.length > 0) {
      const pushResult = await sendExpoPushNotifications(
        pushTokens.map((token) => ({
          to: token.token,
          title: params.title,
          body: params.message,
          sound: "default",
          priority: "high",
          data: {
            type: "ADMIN_BROADCAST",
            target: params.target,
            broadcastId: params.broadcastId,
          },
        })),
      );
      pushSentCount = pushResult.sent;
      invalidTokenCount = pushResult.invalidTokens.length;
    }
  }

  return {
    appNotificationCount,
    pushSentCount,
    invalidTokenCount,
  };
}

export async function sendAdminNotificationBroadcast(params: {
  adminId: number;
  adminUsername: string;
  title: string;
  message: string;
  target: AdminNotificationTarget;
  memberIds: number[];
  sendPush: boolean;
}) {
  const audience = await buildAdminNotificationAudiencePreview({
    target: params.target,
    memberIds: params.memberIds,
  });

  if (audience.eligibleMemberCount === 0) {
    throw new Error("알림을 받을 회원이 없습니다.");
  }

  const broadcastId = await insertBroadcast({
    adminId: params.adminId,
    adminUsername: params.adminUsername,
    title: params.title,
    message: params.message,
    target: params.target,
    memberIds: params.memberIds,
    requestedMemberCount: audience.requestedMemberCount,
    eligibleMemberCount: audience.eligibleMemberCount,
    excludedMarketingCount: audience.excludedMarketingCount,
    previewRecipients: audience.previewRecipients,
    sendPush: params.sendPush,
    status: "processing",
  });

  try {
    const { appNotificationCount, pushSentCount, invalidTokenCount } =
      await executeAdminNotificationBroadcast({
        broadcastId,
        adminId: params.adminId,
        adminUsername: params.adminUsername,
        title: params.title,
        message: params.message,
        target: params.target,
        sendPush: params.sendPush,
        audience,
      });

    await updateBroadcastAfterSend({
      broadcastId,
      status: "sent",
      appNotificationCount,
      pushSentCount,
      invalidTokenCount,
    });

    return {
      success: true,
      broadcastId,
      requestedMemberCount: audience.requestedMemberCount,
      eligibleMemberCount: audience.eligibleMemberCount,
      excludedMarketingCount: audience.excludedMarketingCount,
      appNotificationCount,
      pushSentCount,
      invalidTokenCount,
    };
  } catch (error) {
    await updateBroadcastAfterSend({
      broadcastId,
      status: "failed",
      appNotificationCount: 0,
      pushSentCount: 0,
      invalidTokenCount: 0,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function scheduleAdminNotificationBroadcast(params: {
  adminId: number;
  adminUsername: string;
  title: string;
  message: string;
  target: AdminNotificationTarget;
  memberIds: number[];
  sendPush: boolean;
  scheduledAt: Date;
}) {
  const audience = await buildAdminNotificationAudiencePreview({
    target: params.target,
    memberIds: params.memberIds,
  });

  if (audience.eligibleMemberCount === 0) {
    throw new Error("알림을 받을 회원이 없습니다.");
  }

  const broadcastId = await insertBroadcast({
    adminId: params.adminId,
    adminUsername: params.adminUsername,
    title: params.title,
    message: params.message,
    target: params.target,
    memberIds: params.memberIds,
    requestedMemberCount: audience.requestedMemberCount,
    eligibleMemberCount: audience.eligibleMemberCount,
    excludedMarketingCount: audience.excludedMarketingCount,
    previewRecipients: audience.previewRecipients,
    sendPush: params.sendPush,
    status: "scheduled",
    scheduledAt: params.scheduledAt,
  });

  return {
    success: true,
    scheduled: true,
    broadcastId,
    requestedMemberCount: audience.requestedMemberCount,
    eligibleMemberCount: audience.eligibleMemberCount,
    excludedMarketingCount: audience.excludedMarketingCount,
    scheduledAt: params.scheduledAt.toISOString(),
  };
}

export async function listAdminNotificationBroadcasts(limit = 30): Promise<AdminNotificationHistoryItem[]> {
  await ensureAdminNotificationBroadcastsTable();
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const [rows] = await pool.query<BroadcastRow[]>(
    `SELECT *
     FROM admin_notification_broadcasts
     ORDER BY created_at DESC
     LIMIT ${safeLimit}`,
  );

  return rows.map((row) => ({
    broadcastId: Number(row.broadcast_id),
    adminId: Number(row.admin_id),
    adminUsername: String(row.admin_username ?? ""),
    title: row.title,
    message: row.message,
    targetMode: row.target_mode,
    sendPush: Number(row.send_push) === 1,
    status: row.status,
    scheduledAt: toIsoString(row.scheduled_at),
    sentAt: toIsoString(row.sent_at),
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    requestedMemberCount: Number(row.requested_member_count || 0),
    eligibleMemberCount: Number(row.eligible_member_count || 0),
    excludedMarketingCount: Number(row.excluded_marketing_count || 0),
    appNotificationCount: Number(row.app_notification_count || 0),
    pushSentCount: Number(row.push_sent_count || 0),
    invalidTokenCount: Number(row.invalid_token_count || 0),
    selectedMemberIds: parseJsonArray(row.selected_member_ids_json),
    previewRecipients: parsePreviewRecipients(row.recipient_preview_json),
    errorMessage: row.error_message ?? null,
  }));
}

export async function processScheduledAdminNotificationBroadcasts() {
  await ensureAdminNotificationBroadcastsTable();
  const [rows] = await pool.query<BroadcastRow[]>(
    `SELECT *
     FROM admin_notification_broadcasts
     WHERE status = 'scheduled'
       AND scheduled_at IS NOT NULL
       AND scheduled_at <= NOW()
     ORDER BY scheduled_at ASC
     LIMIT 20`,
  );

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    processed += 1;
    await pool.execute(
      `UPDATE admin_notification_broadcasts
       SET status = 'processing'
       WHERE broadcast_id = ? AND status = 'scheduled'`,
      [row.broadcast_id],
    );

    try {
      const audience = await buildAdminNotificationAudiencePreview({
        target: row.target_mode,
        memberIds: parseJsonArray(row.selected_member_ids_json),
      });

      if (audience.eligibleMemberCount === 0) {
        throw new Error("알림을 받을 회원이 없습니다.");
      }

      const result = await executeAdminNotificationBroadcast({
        broadcastId: Number(row.broadcast_id),
        adminId: Number(row.admin_id),
        adminUsername: String(row.admin_username ?? ""),
        title: row.title,
        message: row.message,
        target: row.target_mode,
        sendPush: Number(row.send_push) === 1,
        audience,
      });

      await pool.execute(
        `UPDATE admin_notification_broadcasts
         SET app_notification_count = ?,
             push_sent_count = ?,
             invalid_token_count = ?,
             status = 'sent',
             sent_at = NOW(),
             error_message = NULL
         WHERE broadcast_id = ?`,
        [
          result.appNotificationCount,
          result.pushSentCount,
          result.invalidTokenCount,
          row.broadcast_id,
        ],
      );

      sent += 1;
    } catch (error) {
      await pool.execute(
        `UPDATE admin_notification_broadcasts
         SET status = 'failed',
             sent_at = NOW(),
             error_message = ?
         WHERE broadcast_id = ?`,
        [error instanceof Error ? error.message : String(error), row.broadcast_id],
      );
      failed += 1;
    }
  }

  return { processed, sent, failed };
}
