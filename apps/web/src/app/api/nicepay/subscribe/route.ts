import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { getPlanById } from "@/lib/plan";
import {
  approveBillingByBid,
  generateMoid,
  registerBillingKeyByCard,
} from "@/lib/nicepay";
import { getActiveBillingKey, saveBillingKey } from "@/lib/billing-key";
import {
  createSubscription,
  getActiveSubscriptionByOwner,
  schedulePlanChange,
} from "@/lib/subscription";
import { createPaymentRecord } from "@/lib/payment-history";

function maskCardNo(cardNo: string): string {
  if (cardNo.length <= 4) return cardNo;
  return `${"*".repeat(cardNo.length - 4)}${cardNo.slice(-4)}`;
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      planId,
      ownerId,
      ownerType,
      cardNo,
      expYear,
      expMonth,
      idNo,
      cardPw,
    } = body;

    if (!planId || !ownerId || !ownerType) {
      return NextResponse.json(
        { error: "결제 파라미터가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const rawCardNo = String(cardNo || "").replace(/\D/g, "");
    const rawExpYear = String(expYear || "").replace(/\D/g, "");
    const rawExpMonth = String(expMonth || "").replace(/\D/g, "");
    const rawIdNo = String(idNo || "").replace(/\D/g, "");
    const rawCardPw = String(cardPw || "").replace(/\D/g, "");

    const plan = await getPlanById(Number(planId));
    if (!plan) {
      return NextResponse.json(
        { error: "플랜 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const activeSub = await getActiveSubscriptionByOwner(
      Number(ownerId),
      ownerType
    );
    const activePrice = activeSub?.plan_price ?? null;

    if (activeSub && activePrice !== null && plan.price <= activePrice) {
      const scheduled = await schedulePlanChange(
        Number(ownerId),
        ownerType,
        Number(planId)
      );
      return NextResponse.json({ scheduled });
    }

    const existingBillingKey = await getActiveBillingKey(user.memberId);
    const hasCardInput =
      rawCardNo.length > 0 ||
      rawExpYear.length > 0 ||
      rawExpMonth.length > 0 ||
      rawIdNo.length > 0 ||
      rawCardPw.length > 0;

    // 저장된 카드로 업그레이드 결제
    if (existingBillingKey && !hasCardInput) {
      const payOrderId = generateMoid(`PECAL_AP_${ownerId}`);
      const payResult = await approveBillingByBid({
        bid: existingBillingKey.bid,
        orderId: payOrderId,
        amount: plan.price,
        goodsName: `Pecal ${plan.name}`,
      });

      const subscriptionId = await createSubscription(
        Number(ownerId),
        ownerType,
        Number(planId),
        user.memberId,
        user.memberId
      );

      await createPaymentRecord({
        subscriptionId,
        ownerId: Number(ownerId),
        ownerType,
        memberId: user.memberId,
        planId: Number(planId),
        amount: plan.price,
        orderId: payOrderId,
        tid: payResult.tid,
        bid: existingBillingKey.bid,
        status: "SUCCESS",
        resultCode: payResult.resultCode,
        resultMsg: payResult.resultMsg,
        paymentType: "FIRST",
      });

      return NextResponse.json({ success: true, usedSavedCard: true });
    }

    if (
      rawCardNo.length < 14 ||
      rawExpYear.length !== 2 ||
      rawExpMonth.length !== 2 ||
      rawIdNo.length < 6 ||
      rawCardPw.length !== 2
    ) {
      return NextResponse.json(
        { error: "카드 정보 입력값이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const registerOrderId = generateMoid(`PECAL_RG_${ownerId}`);
    const fakeBuyer = {
      buyerName: "TESTUSER",
      buyerEmail: "testuser@example.com",
      buyerTel: "01000000000",
    };
    const registerResult = await registerBillingKeyByCard({
      orderId: registerOrderId,
      cardNo: rawCardNo,
      expYear: rawExpYear,
      expMonth: rawExpMonth,
      idNo: rawIdNo,
      cardPw: rawCardPw,
      ...fakeBuyer,
    });

    const payOrderId = generateMoid(`PECAL_AP_${ownerId}`);
    const payResult = await approveBillingByBid({
      bid: registerResult.bid,
      orderId: payOrderId,
      amount: plan.price,
      goodsName: `Pecal ${plan.name}`,
      ...fakeBuyer,
    });

    await saveBillingKey(
      user.memberId,
      registerResult.bid,
      registerResult.cardCode,
      registerResult.cardName,
      maskCardNo(rawCardNo)
    );

    const subscriptionId = await createSubscription(
      Number(ownerId),
      ownerType,
      Number(planId),
      user.memberId,
      user.memberId
    );

    await createPaymentRecord({
      subscriptionId,
      ownerId: Number(ownerId),
      ownerType,
      memberId: user.memberId,
      planId: Number(planId),
      amount: plan.price,
      orderId: payOrderId,
      tid: payResult.tid,
      bid: registerResult.bid,
      status: "SUCCESS",
      resultCode: payResult.resultCode,
      resultMsg: payResult.resultMsg,
      paymentType: "FIRST",
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[NicePay Subscribe] Error:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "결제 처리 중 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
