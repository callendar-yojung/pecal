import { type NextRequest, NextResponse } from "next/server";
import { createAdminAuditLogFromRequest } from "@/lib/admin-audit-log";
import { requireAdminRole } from "@/lib/admin-auth";
import {
  listAdminNotificationBroadcasts,
  scheduleAdminNotificationBroadcast,
  sendAdminNotificationBroadcast,
  type AdminNotificationTarget,
} from "@/lib/admin-notification-broadcast";

function parseScheduledAt(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminRole(request, ["SUPER_ADMIN", "OPS"]);
    if ("error" in admin) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "30");
    const history = await listAdminNotificationBroadcasts(limit);
    return NextResponse.json({ success: true, history });
  } catch (error) {
    console.error("Admin notifications history error:", error);
    return NextResponse.json({ error: "알림 이력을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminRole(request, ["SUPER_ADMIN", "OPS"]);
    if ("error" in admin) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const body = (await request.json()) as {
      title?: string;
      message?: string;
      target?: AdminNotificationTarget;
      memberIds?: number[];
      sendPush?: boolean;
      scheduledAt?: string | null;
    };

    const title = body.title?.trim() ?? "";
    const message = body.message?.trim() ?? "";
    const target = body.target === "members" ? "members" : "all";
    const memberIds = Array.isArray(body.memberIds) ? body.memberIds.map(Number) : [];
    const sendPush = body.sendPush !== false;

    if (!title || !message) {
      return NextResponse.json({ error: "제목과 내용을 입력해주세요." }, { status: 400 });
    }

    const scheduledAt = parseScheduledAt(body.scheduledAt);
    if (body.scheduledAt && !scheduledAt) {
      return NextResponse.json({ error: "예약 발송 시간이 올바르지 않습니다." }, { status: 400 });
    }

    if (scheduledAt && scheduledAt.getTime() > Date.now()) {
      const result = await scheduleAdminNotificationBroadcast({
        adminId: Number(admin.admin_id),
        adminUsername: String(admin.username ?? ""),
        title,
        message,
        target,
        memberIds,
        sendPush,
        scheduledAt,
      });

      await createAdminAuditLogFromRequest(request, {
        adminId: Number(admin.admin_id),
        action: "ADMIN_NOTIFICATION_SCHEDULE",
        targetType: "NOTIFICATION_BROADCAST",
        targetId: Number(result.broadcastId),
        payload: {
          title,
          target,
          sendPush,
          requestedMemberCount: result.requestedMemberCount,
          eligibleMemberCount: result.eligibleMemberCount,
          excludedMarketingCount: result.excludedMarketingCount,
          scheduledAt: result.scheduledAt,
        },
      });

      return NextResponse.json({ ...result });
    }

    const result = await sendAdminNotificationBroadcast({
      adminId: Number(admin.admin_id),
      adminUsername: String(admin.username ?? ""),
      title,
      message,
      target,
      memberIds,
      sendPush,
    });

    await createAdminAuditLogFromRequest(request, {
      adminId: Number(admin.admin_id),
      action: "ADMIN_NOTIFICATION_SEND",
      targetType: "NOTIFICATION_BROADCAST",
      targetId: Number(result.broadcastId),
      payload: {
        title,
        target,
        sendPush,
        requestedMemberCount: result.requestedMemberCount,
        eligibleMemberCount: result.eligibleMemberCount,
        excludedMarketingCount: result.excludedMarketingCount,
        appNotificationCount: result.appNotificationCount,
        pushSentCount: result.pushSentCount,
        invalidTokenCount: result.invalidTokenCount,
      },
    });

    return NextResponse.json({ ...result, marketingOnly: true });
  } catch (error) {
    console.error("Admin notifications error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "관리자 알림 발송 중 오류가 발생했습니다." }, { status: 500 });
  }
}
