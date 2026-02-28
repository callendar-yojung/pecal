import { type NextRequest, NextResponse } from "next/server";
import { verifyPayPalWebhookSignature } from "@/lib/paypal-webhook";
import {
  claimPayPalWebhookEvent,
  completePayPalWebhookEvent,
  releasePayPalWebhookEvent,
} from "@/lib/paypal-webhook-event";

// POST /api/paypal/webhook - PayPal 웹훅 처리
export async function POST(request: NextRequest) {
  let eventId: string | null = null;
  try {
    const body = await request.json();

    const isVerified = await verifyPayPalWebhookSignature(
      request.headers,
      body,
    );
    if (!isVerified) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 },
      );
    }

    eventId = typeof body?.id === "string" ? body.id : null;
    const eventType =
      typeof body?.event_type === "string" ? body.event_type : "UNKNOWN";

    if (!eventId) {
      return NextResponse.json(
        { error: "Missing webhook event id" },
        { status: 400 },
      );
    }

    const claimed = await claimPayPalWebhookEvent(eventId, eventType, body);
    if (!claimed) {
      return NextResponse.json(
        { received: true, duplicate: true },
        { status: 200 },
      );
    }

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

    await completePayPalWebhookEvent(eventId);
    return NextResponse.json({ received: true });
  } catch (error) {
    if (eventId) {
      await releasePayPalWebhookEvent(eventId);
    }
    console.error("Error processing PayPal webhook:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 },
    );
  }
}
