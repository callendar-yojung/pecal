import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { createOrder } from "@/lib/paypal";

// POST /api/paypal/create-order - PayPal 주문 생성
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { plan_id, amount } = body;

    if (!plan_id || !amount) {
      return NextResponse.json(
        { error: "plan_id와 amount가 필요합니다." },
        { status: 400 }
      );
    }

    // PayPal 주문 생성
    const order = await createOrder(amount);

    return NextResponse.json({
      orderId: order.id,
      status: order.status,
    });
  } catch (error) {
    console.error("Error creating PayPal order:", error);
    return NextResponse.json(
      { error: "Failed to create PayPal order" },
      { status: 500 }
    );
  }
}

