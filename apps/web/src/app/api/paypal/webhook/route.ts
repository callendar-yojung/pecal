import { NextRequest, NextResponse } from "next/server";
import { updateSubscriptionStatus } from "@/lib/subscription";

// POST /api/paypal/webhook - PayPal 웹훅 처리
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = body.event_type;

    console.log("PayPal Webhook Event:", eventType);

    // 웹훅 이벤트 처리
    switch (eventType) {
      case "PAYMENT.SALE.COMPLETED":
        // 결제 완료
        console.log("Payment completed:", body.resource);
        break;

      case "PAYMENT.SALE.REFUNDED":
        // 환불 완료
        console.log("Payment refunded:", body.resource);
        // 구독 상태 업데이트
        // await updateSubscriptionStatus(subscriptionId, "CANCELED");
        break;

      case "BILLING.SUBSCRIPTION.CANCELLED":
        // 구독 취소
        console.log("Subscription cancelled:", body.resource);
        break;

      default:
        console.log("Unhandled event type:", eventType);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing PayPal webhook:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

