import { type NextRequest, NextResponse } from "next/server";
import { createAdminAuditLogFromRequest } from "@/lib/admin-audit-log";
import { requireAdminRole } from "@/lib/admin-auth";
import {
  listBillingOpsSubscriptions,
  listRefundAndCancellationHistory,
  previewPlanImpact,
  resyncSubscriptionStatus,
  retrySubscriptionCharge,
} from "@/lib/admin-billing-ops";

export async function GET(request: NextRequest) {
  const admin = await requireAdminRole(request, ["SUPER_ADMIN", "BILLING"]);
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const [subscriptions, history] = await Promise.all([
    listBillingOpsSubscriptions(),
    listRefundAndCancellationHistory(100),
  ]);

  return NextResponse.json({ success: true, subscriptions, history });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminRole(request, ["SUPER_ADMIN", "BILLING"]);
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as {
    action?: "resync" | "retry" | "preview_plan_change";
    subscription_id?: number;
    owner_type?: "team" | "personal";
    owner_id?: number;
    target_plan_id?: number;
  };

  if (body.action === "preview_plan_change") {
    if (!body.owner_type || !body.owner_id || !body.target_plan_id) {
      return NextResponse.json({ error: "owner_type, owner_id, target_plan_id가 필요합니다." }, { status: 400 });
    }
    const preview = await previewPlanImpact({
      ownerType: body.owner_type,
      ownerId: Number(body.owner_id),
      targetPlanId: Number(body.target_plan_id),
    });
    return NextResponse.json({ success: true, preview });
  }

  const subscriptionId = Number(body.subscription_id);
  if (!subscriptionId) {
    return NextResponse.json({ error: "subscription_id가 필요합니다." }, { status: 400 });
  }

  if (body.action === "resync") {
    const result = await resyncSubscriptionStatus(subscriptionId);
    await createAdminAuditLogFromRequest(request, {
      adminId: admin.admin_id,
      action: "SUBSCRIPTION_STATUS_RESYNC",
      targetType: "SUBSCRIPTION",
      targetId: subscriptionId,
      payload: { operation: "resync", ...result },
    });
    return NextResponse.json({ success: true, result });
  }

  if (body.action === "retry") {
    const result = await retrySubscriptionCharge(subscriptionId);
    await createAdminAuditLogFromRequest(request, {
      adminId: admin.admin_id,
      action: "SUBSCRIPTION_RETRY_CHARGE",
      targetType: "SUBSCRIPTION",
      targetId: subscriptionId,
      payload: { operation: "retry", tid: result.tid, orderId: result.orderId },
    });
    return NextResponse.json({ success: true, result });
  }

  return NextResponse.json({ error: "지원하지 않는 액션입니다." }, { status: 400 });
}
