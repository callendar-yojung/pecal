import type { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "@/lib/db";
import { getActiveBillingKey } from "@/lib/billing-key";
import { approveBilling, generateMoid } from "@/lib/nicepay";
import { getPlanById } from "@/lib/plan";
import { createPaymentRecord, getPaymentsBySubscription } from "@/lib/payment-history";
import { getStorageLimitInfo } from "@/lib/storage";
import { advancePaymentDate, getSubscriptionById, updateSubscriptionStatus } from "@/lib/subscription";

export interface BillingOpsSubscriptionItem {
  subscriptionId: number;
  ownerId: number;
  ownerType: "team" | "personal";
  ownerName: string;
  planId: number;
  planName: string | null;
  planPrice: number;
  status: string;
  startedAt: string;
  endedAt: string | null;
  nextPaymentDate: string | null;
  retryCount: number;
  billingKeyMemberId: number | null;
  latestPaymentStatus: string | null;
  latestPaymentAt: string | null;
  latestPaymentMessage: string | null;
}

export interface BillingPlanImpact {
  ownerType: "team" | "personal";
  ownerId: number;
  currentPlanName: string;
  targetPlanName: string;
  storageUsedBytes: number;
  targetStorageLimitBytes: number;
  memberCount: number;
  targetMaxMembers: number;
  willExceedStorage: boolean;
  willExceedMembers: boolean;
}

async function getMemberCount(ownerType: "team" | "personal", ownerId: number) {
  if (ownerType === "personal") return 1;
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM team_members WHERE team_id = ?`,
    [ownerId],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function listBillingOpsSubscriptions(): Promise<BillingOpsSubscriptionItem[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.subscription_id, s.owner_id, s.owner_type,
            CASE
              WHEN s.owner_type = 'team' THEN t.name
              WHEN s.owner_type = 'personal' THEN m.nickname
              ELSE 'Unknown'
            END AS owner_name,
            s.plan_id,
            p.name AS plan_name,
            p.price AS plan_price,
            s.status,
            s.started_at,
            s.ended_at,
            s.next_payment_date,
            s.retry_count,
            s.billing_key_member_id,
            ph.status AS latest_payment_status,
            ph.created_at AS latest_payment_at,
            ph.result_msg AS latest_payment_message
     FROM subscriptions s
     LEFT JOIN teams t ON s.owner_type = 'team' AND s.owner_id = t.team_id
     LEFT JOIN members m ON s.owner_type = 'personal' AND s.owner_id = m.member_id
     LEFT JOIN plans p ON s.plan_id = p.plan_id
     LEFT JOIN payment_history ph ON ph.payment_id = (
       SELECT ph2.payment_id
       FROM payment_history ph2
       WHERE ph2.subscription_id = s.subscription_id
       ORDER BY ph2.created_at DESC
       LIMIT 1
     )
     ORDER BY s.started_at DESC`,
  );

  return rows.map((row) => ({
    subscriptionId: Number(row.subscription_id),
    ownerId: Number(row.owner_id),
    ownerType: row.owner_type,
    ownerName: String(row.owner_name ?? "Unknown"),
    planId: Number(row.plan_id),
    planName: row.plan_name ? String(row.plan_name) : null,
    planPrice: Number(row.plan_price ?? 0),
    status: String(row.status ?? "EXPIRED"),
    startedAt: new Date(row.started_at).toISOString(),
    endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : null,
    nextPaymentDate: row.next_payment_date ? new Date(row.next_payment_date).toISOString() : null,
    retryCount: Number(row.retry_count ?? 0),
    billingKeyMemberId: row.billing_key_member_id == null ? null : Number(row.billing_key_member_id),
    latestPaymentStatus: row.latest_payment_status ? String(row.latest_payment_status) : null,
    latestPaymentAt: row.latest_payment_at ? new Date(row.latest_payment_at).toISOString() : null,
    latestPaymentMessage: row.latest_payment_message ? String(row.latest_payment_message) : null,
  }));
}

export async function listRefundAndCancellationHistory(limit = 100) {
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT kind, reference_id, owner_name, plan_name, status, message, happened_at
     FROM (
       SELECT
         'refund' AS kind,
         ph.payment_id AS reference_id,
         CASE
           WHEN ph.owner_type = 'team' THEN t.name
           WHEN ph.owner_type = 'personal' THEN m.nickname
           ELSE 'Unknown'
         END AS owner_name,
         p.name AS plan_name,
         ph.status AS status,
         ph.result_msg AS message,
         ph.created_at AS happened_at
       FROM payment_history ph
       LEFT JOIN teams t ON ph.owner_type = 'team' AND ph.owner_id = t.team_id
       LEFT JOIN members m ON ph.owner_type = 'personal' AND ph.owner_id = m.member_id
       LEFT JOIN plans p ON ph.plan_id = p.plan_id
       WHERE ph.status = 'REFUNDED'

       UNION ALL

       SELECT
         'cancellation' AS kind,
         s.subscription_id AS reference_id,
         CASE
           WHEN s.owner_type = 'team' THEN t.name
           WHEN s.owner_type = 'personal' THEN m.nickname
           ELSE 'Unknown'
         END AS owner_name,
         p.name AS plan_name,
         s.status AS status,
         COALESCE(s.ended_reason, '관리자/시스템 해지') AS message,
         COALESCE(s.ended_at, s.started_at) AS happened_at
       FROM subscriptions s
       LEFT JOIN teams t ON s.owner_type = 'team' AND s.owner_id = t.team_id
       LEFT JOIN members m ON s.owner_type = 'personal' AND s.owner_id = m.member_id
       LEFT JOIN plans p ON s.plan_id = p.plan_id
       WHERE s.status IN ('CANCELED', 'EXPIRED')
     ) history
     ORDER BY happened_at DESC
     LIMIT ${safeLimit}`,
  );

  return rows.map((row) => ({
    kind: String(row.kind),
    referenceId: Number(row.reference_id),
    ownerName: String(row.owner_name ?? "Unknown"),
    planName: row.plan_name ? String(row.plan_name) : null,
    status: String(row.status ?? "UNKNOWN"),
    message: row.message ? String(row.message) : null,
    happenedAt: new Date(row.happened_at).toISOString(),
  }));
}

export async function previewPlanImpact(params: {
  ownerType: "team" | "personal";
  ownerId: number;
  targetPlanId: number;
}): Promise<BillingPlanImpact> {
  const [currentPlanRows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.name
     FROM subscriptions s
     JOIN plans p ON s.plan_id = p.plan_id
     WHERE s.owner_type = ? AND s.owner_id = ? AND s.status = 'ACTIVE'
     ORDER BY s.started_at DESC
     LIMIT 1`,
    [params.ownerType, params.ownerId],
  );
  const targetPlan = await getPlanById(params.targetPlanId);
  if (!targetPlan) {
    throw new Error("Target plan not found");
  }

  const storage = await getStorageLimitInfo(params.ownerType, params.ownerId);
  const memberCount = await getMemberCount(params.ownerType, params.ownerId);

  return {
    ownerType: params.ownerType,
    ownerId: params.ownerId,
    currentPlanName: String(currentPlanRows[0]?.name ?? storage.plan_name ?? "Basic"),
    targetPlanName: targetPlan.name,
    storageUsedBytes: storage.used_bytes,
    targetStorageLimitBytes: targetPlan.max_storage_mb * 1024 * 1024,
    memberCount,
    targetMaxMembers: targetPlan.max_members,
    willExceedStorage: storage.used_bytes > targetPlan.max_storage_mb * 1024 * 1024,
    willExceedMembers: memberCount > targetPlan.max_members,
  };
}

export async function resyncSubscriptionStatus(subscriptionId: number) {
  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new Error("Subscription not found");
  }

  let nextStatus = subscription.status;
  let message = "변경 없음";

  if (subscription.status === "ACTIVE" && subscription.plan_price && subscription.plan_price > 0) {
    if (!subscription.billing_key_member_id) {
      nextStatus = "EXPIRED";
      message = "활성 billing key 멤버가 없어 만료 처리했습니다.";
    } else {
      const billingKey = await getActiveBillingKey(subscription.billing_key_member_id);
      if (!billingKey) {
        nextStatus = "EXPIRED";
        message = "활성 billing key가 없어 만료 처리했습니다.";
      }
    }
  }

  if (nextStatus !== subscription.status) {
    await updateSubscriptionStatus(subscriptionId, nextStatus);
  }

  return { beforeStatus: subscription.status, afterStatus: nextStatus, message };
}

export async function retrySubscriptionCharge(subscriptionId: number) {
  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new Error("Subscription not found");
  }
  if (subscription.status !== "ACTIVE") {
    throw new Error("Only active subscriptions can be retried");
  }
  if (!subscription.plan_price || subscription.plan_price <= 0) {
    throw new Error("Free plan subscriptions do not require billing retries");
  }
  if (!subscription.billing_key_member_id) {
    throw new Error("No billing key member configured for this subscription");
  }

  const billingKey = await getActiveBillingKey(subscription.billing_key_member_id);
  if (!billingKey) {
    throw new Error("No active billing key found");
  }

  const orderId = generateMoid(`PECAL_ADMIN_RETRY_${subscription.owner_id}`);
  const payResult = await approveBilling(
    billingKey.bid,
    orderId,
    Number(subscription.plan_price),
    `Pecal ${subscription.plan_name || "Plan"}`,
  );

  await createPaymentRecord({
    subscriptionId: subscription.id,
    ownerId: subscription.owner_id,
    ownerType: subscription.owner_type,
    memberId: subscription.billing_key_member_id,
    planId: subscription.plan_id,
    amount: Number(subscription.plan_price),
    orderId,
    tid: payResult.tid,
    bid: billingKey.bid,
    status: "SUCCESS",
    resultCode: payResult.resultCode,
    resultMsg: payResult.resultMsg,
    paymentType: "RETRY",
  });

  await advancePaymentDate(subscription.id);

  const payments = await getPaymentsBySubscription(subscription.id);
  return {
    subscriptionId: subscription.id,
    tid: payResult.tid,
    orderId,
    latestPayments: payments.slice(0, 5),
  };
}
