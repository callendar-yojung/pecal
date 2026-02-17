import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { captureOrder } from "@/lib/paypal";
import { createSubscription, type OwnerType } from "@/lib/subscription";

// POST /api/paypal/capture-order - PayPal 결제 승인 및 구독 생성
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { order_id, owner_id, owner_type, plan_id } = body;

    if (!order_id || !owner_id || !owner_type || !plan_id) {
      return NextResponse.json(
        { error: "order_id, owner_id, owner_type, plan_id가 필요합니다." },
        { status: 400 }
      );
    }

    // PayPal 결제 승인
    const capture = await captureOrder(order_id);

    if (capture.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "결제가 완료되지 않았습니다." },
        { status: 400 }
      );
    }

    // 구독 생성
    const subscriptionId = await createSubscription(
      Number(owner_id),
      owner_type as OwnerType,
      Number(plan_id)
    );

    return NextResponse.json({
      success: true,
      subscription_id: subscriptionId,
      payment: {
        id: capture.id,
        status: capture.status,
        payer: capture.payer,
      },
    });
  } catch (error) {
    console.error("Error capturing PayPal order:", error);
    return NextResponse.json(
      { error: "Failed to capture PayPal order" },
      { status: 500 }
    );
  }
}

