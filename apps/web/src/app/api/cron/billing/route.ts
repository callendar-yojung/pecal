import { NextRequest, NextResponse } from "next/server";
import {
  getDueSubscriptions,
  applyPendingPlanChange,
  advancePaymentDate,
  incrementRetryCount,
  updateSubscriptionStatus,
} from "@/lib/subscription";
import { getPlanById } from "@/lib/plan";
import { getActiveBillingKey } from "@/lib/billing-key";
import { approveBilling, generateMoid } from "@/lib/nicepay";
import { createPaymentRecord } from "@/lib/payment-history";

const MAX_RETRY_COUNT = 3;

/**
 * POST /api/cron/billing
 * 정기결제 스케쥴러 — 외부 크론에서 호출
 *
 * 인증: Authorization: Bearer {CRON_SECRET}
 */
export async function POST(request: NextRequest) {
  // 인증 확인
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[Cron Billing] CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Array<{
    subscriptionId: number;
    ownerId: number;
    status: string;
    message: string;
  }> = [];

  try {
    const dueSubscriptions = await getDueSubscriptions();
    console.log(
      `[Cron Billing] Found ${dueSubscriptions.length} due subscriptions`
    );

    for (const sub of dueSubscriptions) {
      try {
        if (sub.pending_plan_id) {
          const applied = await applyPendingPlanChange(sub.id);
          if (applied) {
            const updatedPlan = await getPlanById(sub.pending_plan_id);
            if (updatedPlan) {
              sub.plan_id = updatedPlan.id;
              sub.plan_name = updatedPlan.name;
              sub.plan_price = updatedPlan.price;
            }
          }
        }

        // 무료 플랜(가격 0)이면 날짜만 연장
        if (!sub.plan_price || sub.plan_price === 0) {
          await advancePaymentDate(sub.id);
          results.push({
            subscriptionId: sub.id,
            ownerId: sub.owner_id,
            status: "SKIPPED",
            message: "Free plan — date advanced",
          });
          continue;
        }

        // 빌링키 조회
        const billingKeyMemberId = sub.billing_key_member_id;
        if (!billingKeyMemberId) {
          console.warn(
            `[Cron Billing] No billing_key_member_id for subscription ${sub.id}`
          );
          await updateSubscriptionStatus(sub.id, "EXPIRED");
          results.push({
            subscriptionId: sub.id,
            ownerId: sub.owner_id,
            status: "EXPIRED",
            message: "No billing key member — subscription expired",
          });
          continue;
        }

        const billingKey = await getActiveBillingKey(billingKeyMemberId);
        if (!billingKey) {
          console.warn(
            `[Cron Billing] No active billing key for member ${billingKeyMemberId}`
          );
          await updateSubscriptionStatus(sub.id, "EXPIRED");
          results.push({
            subscriptionId: sub.id,
            ownerId: sub.owner_id,
            status: "EXPIRED",
            message: "No active billing key — subscription expired",
          });
          continue;
        }

        // 결제 실행
        const orderId = generateMoid(`PECAL_RC_${sub.owner_id}`);
        const planName = sub.plan_name || "Pecal Plan";
        const paymentType =
          sub.retry_count > 0 ? ("RETRY" as const) : ("RECURRING" as const);

        try {
          const payResult = await approveBilling(
            billingKey.bid,
            orderId,
            sub.plan_price,
            `Pecal ${planName}`
          );

          // 성공: 이력 기록 + 날짜 연장
          await createPaymentRecord({
            subscriptionId: sub.id,
            ownerId: sub.owner_id,
            ownerType: sub.owner_type,
            memberId: billingKeyMemberId,
            planId: sub.plan_id,
            amount: sub.plan_price,
            orderId,
            tid: payResult.tid,
            bid: billingKey.bid,
            status: "SUCCESS",
            resultCode: payResult.resultCode,
            resultMsg: payResult.resultMsg,
            paymentType,
          });

          await advancePaymentDate(sub.id);

          results.push({
            subscriptionId: sub.id,
            ownerId: sub.owner_id,
            status: "SUCCESS",
            message: `Payment approved: ${payResult.tid}`,
          });
        } catch (payError: any) {
          // 결제 실패
          console.error(
            `[Cron Billing] Payment failed for subscription ${sub.id}:`,
            payError.message
          );

          await createPaymentRecord({
            subscriptionId: sub.id,
            ownerId: sub.owner_id,
            ownerType: sub.owner_type,
            memberId: billingKeyMemberId,
            planId: sub.plan_id,
            amount: sub.plan_price,
            orderId,
            tid: null,
            bid: billingKey.bid,
            status: "FAILED",
            resultCode: null,
            resultMsg: payError.message,
            paymentType,
          });

          const newRetryCount = await incrementRetryCount(sub.id);

          if (newRetryCount > MAX_RETRY_COUNT) {
            await updateSubscriptionStatus(sub.id, "EXPIRED");
            results.push({
              subscriptionId: sub.id,
              ownerId: sub.owner_id,
              status: "EXPIRED",
              message: `Max retries exceeded (${MAX_RETRY_COUNT}) — subscription expired`,
            });
          } else {
            results.push({
              subscriptionId: sub.id,
              ownerId: sub.owner_id,
              status: "RETRY",
              message: `Payment failed, retry ${newRetryCount}/${MAX_RETRY_COUNT}`,
            });
          }
        }
      } catch (subError: any) {
        console.error(
          `[Cron Billing] Error processing subscription ${sub.id}:`,
          subError.message
        );
        results.push({
          subscriptionId: sub.id,
          ownerId: sub.owner_id,
          status: "ERROR",
          message: subError.message,
        });
      }
    }

    console.log(
      `[Cron Billing] Completed. Processed ${results.length} subscriptions`
    );

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error: any) {
    console.error("[Cron Billing] Fatal error:", error.message);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
