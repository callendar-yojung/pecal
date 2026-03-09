import type { RowDataPacket } from "mysql2";
import { type NextRequest, NextResponse } from "next/server";
import { createAdminAuditLogFromRequest } from "@/lib/admin-audit-log";
import { requireAdminRole } from "@/lib/admin-auth";
import pool from "@/lib/db";
import { getSubscriptionById, updateSubscriptionStatus } from "@/lib/subscription";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminRole(request, ["SUPER_ADMIN", "BILLING"]);
    if ("error" in admin) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT s.subscription_id, s.owner_id, s.owner_type,
              CASE WHEN s.owner_type = 'team' THEN t.name WHEN s.owner_type = 'personal' THEN m.nickname ELSE 'Unknown' END as owner_name,
              p.name as plan_name, p.price as plan_price, s.status, s.started_at, s.ended_at
       FROM subscriptions s
       LEFT JOIN teams t ON s.owner_type = 'team' AND s.owner_id = t.team_id
       LEFT JOIN members m ON s.owner_type = 'personal' AND s.owner_id = m.member_id
       JOIN plans p ON s.plan_id = p.plan_id
       ORDER BY s.started_at DESC`,
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Admin subscriptions error:", error);
    return NextResponse.json({ error: "구독 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdminRole(request, ["SUPER_ADMIN", "BILLING"]);
    if ("error" in admin) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const body = (await request.json()) as { subscription_id?: number; status?: "ACTIVE" | "CANCELED" | "EXPIRED" };
    const subscriptionId = Number(body.subscription_id);
    const status = body.status;
    if (!Number.isInteger(subscriptionId) || subscriptionId <= 0 || !status) {
      return NextResponse.json({ error: "subscription_id와 status가 필요합니다." }, { status: 400 });
    }

    const before = await getSubscriptionById(subscriptionId);
    if (!before) {
      return NextResponse.json({ error: "구독을 찾을 수 없습니다." }, { status: 404 });
    }

    const success = await updateSubscriptionStatus(subscriptionId, status);
    if (!success) {
      return NextResponse.json({ error: "구독 상태 변경에 실패했습니다." }, { status: 400 });
    }

    await createAdminAuditLogFromRequest(request, {
      adminId: Number(admin.admin_id),
      action: "SUBSCRIPTION_FORCE_CHANGE",
      targetType: "SUBSCRIPTION",
      targetId: subscriptionId,
      payload: { beforeStatus: before.status, afterStatus: status, ownerId: before.owner_id, ownerType: before.owner_type, planId: before.plan_id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin subscription patch error:", error);
    return NextResponse.json({ error: "구독 상태 변경 중 오류가 발생했습니다." }, { status: 500 });
  }
}
