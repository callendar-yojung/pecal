import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getAuthUser } from "@/lib/auth-helper";
import { getPlanById } from "@/lib/plan";
import { registerBillingKey, approveBilling, generateMoid } from "@/lib/nicepay";
import { saveBillingKey, getActiveBillingKey } from "@/lib/billing-key";
import { createSubscription } from "@/lib/subscription";
import { createPaymentRecord } from "@/lib/payment-history";

/** GET - 현재 사용자의 활성 빌키(저장된 카드) 정보 반환 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const billingKey = await getActiveBillingKey(user.memberId);

  if (!billingKey) {
    return NextResponse.json({ billingKey: null });
  }

  return NextResponse.json({
    billingKey: {
      id: billingKey.billing_key_id,
      cardCode: billingKey.card_code,
      cardName: billingKey.card_name,
      cardNoMasked: billingKey.card_no_masked,
      createdAt: billingKey.created_at,
    },
  });
}

async function parseBody(
  request: NextRequest
): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") || "";

  if (
    contentType.includes("form-data") ||
    contentType.includes("x-www-form-urlencoded")
  ) {
    const formData = await request.formData();
    const result: Record<string, string> = {};
    formData.forEach((value, key) => {
      result[key] = value.toString();
    });
    return result;
  }

  if (contentType.includes("application/json")) {
    return await request.json();
  }

  const text = await request.text();
  const params = new URLSearchParams(text);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function detectLocale(request: NextRequest): string {
  const referer = request.headers.get("referer") || "";
  if (referer.includes("/en/")) return "en";
  return "ko";
}

function redirectToCheckout(
  request: NextRequest,
  status: string,
  message: string
) {
  const locale = detectLocale(request);
  const searchParams = request.nextUrl.searchParams;
  const planId = searchParams.get("plan_id") || "";
  const ownerId = searchParams.get("owner_id") || "";
  const ownerType = searchParams.get("owner_type") || "";

  const url = new URL(
    `/${locale}/dashboard/settings/billing/checkout`,
    request.nextUrl.origin
  );
  url.searchParams.set("plan_id", planId);
  url.searchParams.set("owner_id", ownerId);
  url.searchParams.set("owner_type", ownerType);
  url.searchParams.set("nicepay", status);
  url.searchParams.set("message", message);

  return NextResponse.redirect(url, { status: 303 });
}

/**
 * POST - NicePay V2 SDK 콜백: 빌키 발급 + 첫 결제 + 구독 생성
 *
 * SDK가 returnUrl로 POST 요청을 보내며, body에 authResultCode, tid, orderId 등이 포함됨.
 * 1) authResultCode === '0000' 확인
 * 2) /v1/billing/{tid} 호출 → 빌키(BID) 발급
 * 3) /v1/billing/re-pay 호출 → 첫 결제 승인
 * 4) DB 저장 + 구독 생성
 * 5) billing 페이지로 리다이렉트
 */
export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const planId = searchParams.get("plan_id");
  const ownerId = searchParams.get("owner_id");
  const ownerType = searchParams.get("owner_type") as
    | "team"
    | "personal"
    | null;

  try {
    console.log("[NicePay Billing] Callback received");
    console.log("[NicePay Billing] Query params:", { planId, ownerId, ownerType });

    const body = await parseBody(request);
    console.log("[NicePay Billing] Parsed body keys:", Object.keys(body));

    const authResultCode = body.authResultCode;
    const tid = body.tid;
    const authToken = body.authToken;
    const signature = body.signature;
    const amount = body.amount;
    const orderId = body.orderId;

    const clientKey = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY;
    const secretKey = process.env.NICEPAY_SECRET_KEY;

    if (!clientKey || !secretKey) {
      console.error("[NicePay Billing] Missing client key or secret key");
      return redirectToCheckout(
        request,
        "failed",
        "서버 결제 설정이 올바르지 않습니다."
      );
    }

    if (!planId || !ownerId || !ownerType) {
      return redirectToCheckout(
        request,
        "failed",
        "결제 파라미터가 올바르지 않습니다."
      );
    }

    // 1. 인증 결과 확인
    if (authResultCode !== "0000") {
      const authResultMsg = body.authResultMsg;
      console.log("[NicePay Billing] Auth failed:", authResultCode, authResultMsg);
      return redirectToCheckout(
        request,
        "failed",
        authResultMsg || "결제 인증에 실패했습니다."
      );
    }

    // 2. Signature 검증
    const expectedSignature = createHash("sha256")
      .update(authToken + clientKey + amount + secretKey)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.error("[NicePay Billing] Signature mismatch");
      return redirectToCheckout(
        request,
        "failed",
        "결제 서명 검증에 실패했습니다."
      );
    }

    // 3. 금액 일치 확인
    const plan = await getPlanById(Number(planId));
    if (!plan) {
      return redirectToCheckout(request, "failed", "플랜 정보를 찾을 수 없습니다.");
    }

    if (Number(amount) !== plan.price) {
      console.error("[NicePay Billing] Amount mismatch:", amount, "vs", plan.price);
      return redirectToCheckout(request, "failed", "결제 금액이 일치하지 않습니다.");
    }

    // 4. 빌키(BID) 발급: POST /v1/billing/{tid}
    console.log("[NicePay Billing] Registering billing key for tid:", tid);
    const billingResult = await registerBillingKey(
      tid,
      orderId,
      Number(amount),
      `Pecal ${plan.name}`
    );

    // 5. 첫 결제 승인: POST /v1/billing/re-pay
    const payOrderId = generateMoid(`PECAL_AP_${ownerId}`);
    console.log("[NicePay Billing] First payment approval:", plan.price);
    const payResult = await approveBilling(
      billingResult.bid,
      payOrderId,
      plan.price,
      `Pecal ${plan.name}`
    );

    // 6. DB에 빌키 저장
    const user = await getAuthUser(request);
    const memberId = user?.memberId ?? Number(ownerId);

    await saveBillingKey(
      memberId,
      billingResult.bid,
      billingResult.cardCode,
      billingResult.cardName,
      billingResult.cardNo
    );

    // 7. 구독 생성 (billingKeyMemberId 전달)
    const subscriptionId = await createSubscription(
      Number(ownerId),
      ownerType,
      Number(planId),
      memberId,
      memberId
    );

    // 8. 첫 결제 이력 기록
    await createPaymentRecord({
      subscriptionId,
      ownerId: Number(ownerId),
      ownerType,
      memberId,
      planId: Number(planId),
      amount: plan.price,
      orderId: payOrderId,
      tid: payResult.tid,
      bid: billingResult.bid,
      status: "SUCCESS",
      resultCode: payResult.resultCode,
      resultMsg: payResult.resultMsg,
      paymentType: "FIRST",
    });

    console.log("[NicePay Billing] Success for owner:", ownerId);

    // 9. billing 페이지로 리다이렉트
    const locale = detectLocale(request);
    const successUrl = new URL(
      `/${locale}/dashboard/settings/billing`,
      request.nextUrl.origin
    );
    successUrl.searchParams.set("nicepay", "success");

    return NextResponse.redirect(successUrl, { status: 303 });
  } catch (error: any) {
    console.error("[NicePay Billing] Error:", error.message);
    return redirectToCheckout(
      request,
      "failed",
      error.message || "결제 처리 중 서버 오류가 발생했습니다."
    );
  }
}
