import type { RowDataPacket } from "mysql2";
import { getMemberRefreshSessions } from "@/lib/auth-token-store";
import pool from "@/lib/db";
import { getMemberConsents, listMemberConsentHistory } from "@/lib/member-settings";
import { getNotificationsForMember } from "@/lib/notification";
import {
  formatBytes,
  getActivePlanForOwner,
  getStorageLimitInfo,
  type OwnerType,
} from "@/lib/storage";
import { getWorkspacesPersonalAndTeamByMemberId } from "@/lib/workspace";

type MemberSupportRow = RowDataPacket & {
  member_id: number;
  email: string | null;
  nickname: string | null;
  provider: string | null;
  created_at: Date | string;
  lasted_at: Date | string | null;
};

type PushTokenRow = RowDataPacket & {
  token: string;
  platform: string;
  device_id: string | null;
  app_build: string | null;
  is_active: number;
  created_at: Date | string;
  updated_at: Date | string;
  last_seen_at: Date | string | null;
};

type BroadcastHistoryRow = RowDataPacket & {
  broadcast_id: number;
  title: string;
  message: string;
  target_mode: "all" | "members";
  send_push: number;
  status: "scheduled" | "processing" | "sent" | "failed";
  scheduled_at: Date | string | null;
  sent_at: Date | string | null;
  created_at: Date | string;
  selected_member_ids_json: string | null;
  error_message: string | null;
};

function toIsoString(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function maskToken(token: string) {
  if (token.length <= 18) return token;
  return `${token.slice(0, 12)}...${token.slice(-6)}`;
}

export interface AdminMemberSupportSnapshot {
  member: {
    memberId: number;
    email: string;
    nickname: string;
    provider: string;
    createdAt: string | null;
    lastLoginAt: string | null;
    privacyConsent: boolean;
    marketingConsent: boolean;
    consentHistory: Array<{
      historyId: number;
      consentType: "privacy" | "marketing";
      previousValue: boolean;
      currentValue: boolean;
      changedByType: "member" | "admin" | "system";
      changedById: number | null;
      changedAt: string;
    }>;
  };
  sessions: Array<{
    sessionId: string;
    clientPlatform: string | null;
    clientName: string | null;
    appVersion: string | null;
    userAgent: string | null;
    createdAt: string;
    lastSeenAt: string;
  }>;
  notifications: Array<{
    notificationId: number;
    type: string;
    title: string | null;
    message: string | null;
    sourceType: string | null;
    sourceId: number | null;
    isRead: boolean;
    createdAt: string | null;
  }>;
  pushTokens: Array<{
    tokenPreview: string;
    platform: string;
    deviceId: string | null;
    appBuild: string | null;
    isActive: boolean;
    createdAt: string | null;
    updatedAt: string | null;
    lastSeenAt: string | null;
  }>;
  usage: Array<{
    workspaceId: number;
    workspaceName: string;
    workspaceType: string;
    ownerId: number;
    memberCount: number | null;
    planName: string;
    maxMembers: number;
    maxStorageMb: number;
    maxFileSizeMb: number;
    storageUsedBytes: number;
    storageLimitBytes: number;
    storageUsedFormatted: string;
    storageLimitFormatted: string;
    storagePercent: number;
    fileCount: number;
  }>;
  deliveryDiagnosis: {
    marketingConsent: boolean;
    activePushTokenCount: number;
    inactivePushTokenCount: number;
    recentAdminBroadcastCount: number;
    lastAdminBroadcastAt: string | null;
    blockers: string[];
    notes: string[];
  };
  broadcastHistory: Array<{
    broadcastId: number;
    title: string;
    message: string;
    targetMode: "all" | "members";
    sendPush: boolean;
    status: "scheduled" | "processing" | "sent" | "failed";
    scheduledAt: string | null;
    sentAt: string | null;
    createdAt: string | null;
    requestedForMember: boolean;
    inAppNotificationCreated: boolean;
    diagnosis: string;
    errorMessage: string | null;
  }>;
}

let ensureBroadcastsTablePromise: Promise<void> | null = null;

async function ensureAdminNotificationBroadcastsTable() {
  if (!ensureBroadcastsTablePromise) {
    ensureBroadcastsTablePromise = (async () => {
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
  await ensureBroadcastsTablePromise;
}

function parseNumberArray(raw: string | null) {
  if (!raw) return [] as number[];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(Number).filter((value) => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

export async function getAdminMemberSupportSnapshot(
  memberId: number,
): Promise<AdminMemberSupportSnapshot | null> {
  const [memberRows] = await pool.execute<MemberSupportRow[]>(
    `SELECT member_id, email, nickname, provider, created_at, lasted_at
     FROM members
     WHERE member_id = ?
     LIMIT 1`,
    [memberId],
  );

  const member = memberRows[0];
  if (!member) return null;

  const [
    consents,
    consentHistory,
    sessions,
    notifications,
    pushTokenRows,
    workspaces,
    _ensureBroadcasts,
  ] =
    await Promise.all([
      getMemberConsents(memberId),
      listMemberConsentHistory(memberId, 20),
      getMemberRefreshSessions(memberId),
      getNotificationsForMember(memberId, 12),
      pool.execute<PushTokenRow[]>(
        `SELECT token, platform, device_id, app_build, is_active, created_at, updated_at, last_seen_at
         FROM member_push_tokens
         WHERE member_id = ?
         ORDER BY COALESCE(last_seen_at, updated_at) DESC, updated_at DESC`,
        [memberId],
      ),
      getWorkspacesPersonalAndTeamByMemberId(memberId),
      ensureAdminNotificationBroadcastsTable(),
    ]);

  const [broadcastRows] = await pool.query<BroadcastHistoryRow[]>(
    `SELECT
       broadcast_id,
       title,
       message,
       target_mode,
       send_push,
       status,
       scheduled_at,
       sent_at,
       created_at,
       selected_member_ids_json,
       error_message
     FROM admin_notification_broadcasts
     ORDER BY created_at DESC
     LIMIT 12`,
  );

  const pushTokens = pushTokenRows[0].map((row) => ({
    tokenPreview: maskToken(String(row.token ?? "")),
    platform: String(row.platform ?? ""),
    deviceId: row.device_id ?? null,
    appBuild: row.app_build ?? null,
    isActive: Number(row.is_active) === 1,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    lastSeenAt: toIsoString(row.last_seen_at),
  }));

  const usage = await Promise.all(
    workspaces.map(async (workspace) => {
      const ownerType = workspace.type as OwnerType;
      const [storage, plan] = await Promise.all([
        getStorageLimitInfo(ownerType, workspace.owner_id),
        getActivePlanForOwner(ownerType, workspace.owner_id),
      ]);
      const storagePercent =
        storage.limit_bytes > 0
          ? Math.round((storage.used_bytes / storage.limit_bytes) * 100)
          : 0;

      return {
        workspaceId: workspace.workspace_id,
        workspaceName: workspace.name,
        workspaceType: workspace.type,
        ownerId: workspace.owner_id,
        memberCount: workspace.memberCount ?? null,
        planName: plan.name,
        maxMembers: plan.max_members,
        maxStorageMb: plan.max_storage_mb,
        maxFileSizeMb: plan.max_file_size_mb,
        storageUsedBytes: storage.used_bytes,
        storageLimitBytes: storage.limit_bytes,
        storageUsedFormatted: formatBytes(storage.used_bytes),
        storageLimitFormatted: formatBytes(storage.limit_bytes),
        storagePercent,
        fileCount: storage.file_count,
      };
    }),
  );

  const activePushTokenCount = pushTokens.filter((token) => token.isActive).length;
  const inactivePushTokenCount = pushTokens.length - activePushTokenCount;
  const adminNotifications = notifications.filter(
    (notification) =>
      notification.type === "ADMIN_BROADCAST" ||
      notification.source_type === "ADMIN_BROADCAST",
  );

  const blockers: string[] = [];
  const notes: string[] = [];

  if (!consents.marketing_consent) {
    blockers.push("마케팅 수신 비동의 상태라 관리자 마케팅 알림 푸시 대상에서 제외됩니다.");
  }
  if (activePushTokenCount === 0) {
    blockers.push("활성 푸시 토큰이 없어 푸시 알림을 보낼 수 없습니다.");
  }
  if (activePushTokenCount > 0) {
    notes.push(`활성 푸시 토큰 ${activePushTokenCount}개가 등록되어 있습니다.`);
  }
  if (inactivePushTokenCount > 0) {
    notes.push(`비활성 푸시 토큰 ${inactivePushTokenCount}개가 있어 일부 기기 재로그인이 필요할 수 있습니다.`);
  }
  if (adminNotifications.length > 0) {
    notes.push("최근 관리자 알림 내역이 있어 인앱 알림 생성 여부를 아래 목록에서 바로 확인할 수 있습니다.");
  } else {
    notes.push("최근 관리자 알림 내역이 없어 알림 발송 이력과 함께 확인하는 것이 좋습니다.");
  }

  const broadcastHistory = broadcastRows.map((broadcast) => {
    const selectedMemberIds = parseNumberArray(broadcast.selected_member_ids_json);
    const requestedForMember =
      broadcast.target_mode === "all" || selectedMemberIds.includes(memberId);
    const inAppNotificationCreated = notifications.some(
      (notification) =>
        notification.source_type === "ADMIN_BROADCAST" &&
        Number(notification.source_id ?? 0) === Number(broadcast.broadcast_id),
    );

    let diagnosis = "발송 대상 여부와 현재 상태를 확인하세요.";
    if (!requestedForMember) {
      diagnosis = "이 발송건의 선택 대상 회원이 아니었습니다.";
    } else if (inAppNotificationCreated) {
      diagnosis = "인앱 알림은 생성되었습니다.";
    } else if (broadcast.status === "scheduled") {
      diagnosis = "예약 상태라 아직 발송되지 않았습니다.";
    } else if (broadcast.status === "processing") {
      diagnosis = "현재 발송 처리 중입니다.";
    } else if (broadcast.status === "failed") {
      diagnosis = "발송이 실패했습니다. 오류 메시지를 확인하세요.";
    } else if (!consents.marketing_consent) {
      diagnosis = "마케팅 비동의 상태라 발송 대상에서 제외되었을 가능성이 큽니다.";
    } else if (activePushTokenCount === 0 && Number(broadcast.send_push) === 1) {
      diagnosis = "푸시 토큰이 없어 푸시 발송이 어려웠습니다. 인앱 알림 생성 여부를 함께 확인하세요.";
    } else {
      diagnosis = "발송 대상이었지만 개별 전달 이력은 없어서 현재 상태 기준으로만 판단 가능합니다.";
    }

    return {
      broadcastId: Number(broadcast.broadcast_id),
      title: broadcast.title,
      message: broadcast.message,
      targetMode: broadcast.target_mode,
      sendPush: Number(broadcast.send_push) === 1,
      status: broadcast.status,
      scheduledAt: toIsoString(broadcast.scheduled_at),
      sentAt: toIsoString(broadcast.sent_at),
      createdAt: toIsoString(broadcast.created_at),
      requestedForMember,
      inAppNotificationCreated,
      diagnosis,
      errorMessage: broadcast.error_message ?? null,
    };
  });

  return {
    member: {
      memberId: Number(member.member_id),
      email: String(member.email ?? ""),
      nickname: String(member.nickname ?? ""),
      provider: String(member.provider ?? ""),
      createdAt: toIsoString(member.created_at),
      lastLoginAt: toIsoString(member.lasted_at),
      privacyConsent: consents.privacy_consent,
      marketingConsent: consents.marketing_consent,
      consentHistory: consentHistory.map((item) => ({
        historyId: item.historyId,
        consentType: item.consentType,
        previousValue: item.previousValue,
        currentValue: item.currentValue,
        changedByType: item.changedByType,
        changedById: item.changedById,
        changedAt: item.changedAt,
      })),
    },
    sessions: sessions.map((session) => ({
      sessionId: session.sessionId,
      clientPlatform: session.clientPlatform ?? null,
      clientName: session.clientName ?? null,
      appVersion: session.appVersion ?? null,
      userAgent: session.userAgent ?? null,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
    })),
    notifications: notifications.map((notification) => ({
      notificationId: Number(notification.notification_id),
      type: notification.type,
      title: notification.title,
      message: notification.message,
      sourceType: notification.source_type,
      sourceId:
        notification.source_id === null ? null : Number(notification.source_id),
      isRead: Number(notification.is_read) === 1,
      createdAt: toIsoString(notification.created_at),
    })),
    pushTokens,
    usage,
    deliveryDiagnosis: {
      marketingConsent: consents.marketing_consent,
      activePushTokenCount,
      inactivePushTokenCount,
      recentAdminBroadcastCount: adminNotifications.length,
      lastAdminBroadcastAt:
        adminNotifications.length > 0
          ? toIsoString(adminNotifications[0]?.created_at ?? null)
          : null,
      blockers,
      notes,
    },
    broadcastHistory,
  };
}
