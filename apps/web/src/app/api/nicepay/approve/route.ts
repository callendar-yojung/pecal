import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createSubscription } from "@/lib/subscription";
import { getPlanById } from "@/lib/plan";
import { getAuthUser } from "@/lib/auth-helper";

async function parseBody(
  request: NextRequest
): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") || "";
  console.log("[NicePay] Content-Type:", contentType);

  // application/x-www-form-urlencoded 또는 multipart/form-data
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

  // JSON
  if (contentType.includes("application/json")) {
    return await request.json();
  }

  // fallback: text body를 URLSearchParams로 파싱 시도
  const text = await request.text();
  console.log("[NicePay] Raw body:", text);
  const params = new URLSearchParams(text);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const planId = searchParams.get("plan_id");
  const ownerId = searchParams.get("owner_id");
  const ownerType = searchParams.get("owner_type") as
    | "team"
    | "personal"
    | null;

  try {
    console.log("[NicePay] Approve callback received");
    console.log("[NicePay] Query params:", { planId, ownerId, ownerType });

    const body = await parseBody(request);
    console.log("[NicePay] Parsed body keys:", Object.keys(body));

    const authResultCode = body.authResultCode;
    const tid = body.tid;
    const authToken = body.authToken;
    const signature = body.signature;
    const amount = body.amount;
    const orderId = body.orderId;

    console.log("[NicePay] authResultCode:", authResultCode);
    console.log("[NicePay] tid:", tid);
    console.log("[NicePay] amount:", amount);
    console.log("[NicePay] orderId:", orderId);

    const clientId = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY;
    const secretKey = process.env.NICEPAY_SECRET_KEY;

    if (!clientId || !secretKey) {
      console.error("[NicePay] Missing NEXT_PUBLIC_NICEPAY_CLIENT_KEY or NICEPAY_SECRET_KEY");
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
      console.log("[NicePay] Auth failed:", authResultCode, authResultMsg);
      return redirectToCheckout(
        request,
        "failed",
        authResultMsg || "결제 인증에 실패했습니다."
      );
    }

    // 2. Signature 검증
    const expectedSignature = createHash("sha256")
      .update(authToken + clientId + amount + secretKey)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.error("[NicePay] Signature mismatch");
      console.error("[NicePay] Expected:", expectedSignature);
      console.error("[NicePay] Received:", signature);
      return redirectToCheckout(
        request,
        "failed",
        "결제 서명 검증에 실패했습니다."
      );
    }

    // 3. 금액 일치 확인
    const plan = await getPlanById(Number(planId));
    if (!plan) {
      return redirectToCheckout(
        request,
        "failed",
        "플랜 정보를 찾을 수 없습니다."
      );
    }

    if (Number(amount) !== plan.price) {
      console.error(
        "[NicePay] Amount mismatch:",
        amount,
        "vs plan price:",
        plan.price
      );
      return redirectToCheckout(
        request,
        "failed",
        "결제 금액이 일치하지 않습니다."
      );
    }

    // 4. NicePay 승인 API 호출
    const authHeader = Buffer.from(`${clientId}:${secretKey}`).toString(
      "base64"
    );

    console.log("[NicePay] Calling approval API for tid:", tid);

    const approvalResponse = await fetch(
      `https://sandbox-api.nicepay.co.kr/v1/payments/${tid}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${authHeader}`,
        },
        body: JSON.stringify({
          amount: Number(amount),
          orderId,
        }),
      }
    );

    const approvalResult = await approvalResponse.json();
    console.log("[NicePay] Approval result:", JSON.stringify(approvalResult));

    if (approvalResult.resultCode !== "0000") {
      return redirectToCheckout(
        request,
        "failed",
        approvalResult.resultMsg || "결제 승인에 실패했습니다."
      );
    }

    // 5. 구독 생성
    const user = await getAuthUser(request);
    const createdBy = user?.memberId ?? Number(ownerId);
    console.log("[NicePay] Creating subscription:", {
      ownerId,
      ownerType,
      planId,
      createdBy,
    });
    await createSubscription(
      Number(ownerId),
      ownerType,
      Number(planId),
      createdBy
    );

    // 6. 성공 리다이렉트
    const locale = detectLocale(request);
    const successUrl = new URL(
      `/${locale}/dashboard/settings/billing`,
      request.nextUrl.origin
    );
    successUrl.searchParams.set("nicepay", "success");

    console.log("[NicePay] Success, redirecting to:", successUrl.toString());
    return NextResponse.redirect(successUrl, { status: 303 });
  } catch (error: any) {
    console.error("[NicePay] Unhandled error:", error.message);
    console.error("[NicePay] Stack:", error.stack);
    return redirectToCheckout(
      request,
      "failed",
      "결제 처리 중 서버 오류가 발생했습니다."
    );
  }
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
