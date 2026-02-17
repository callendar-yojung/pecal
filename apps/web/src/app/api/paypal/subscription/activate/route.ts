import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { createSubscription } from "@/lib/subscription";

// POST /api/paypal/subscription/activate - PayPal 구독 활성화 및 로컬 구독 생성
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { subscription_id, owner_id, owner_type, plan_id } = body;

    if (!subscription_id || !owner_id || !owner_type || !plan_id) {
      return NextResponse.json(
        { error: "subscription_id, owner_id, owner_type, plan_id가 필요합니다." },
        { status: 400 }
      );
    }

    // 로컬 데이터베이스에 구독 생성
    const localSubscriptionId = await createSubscription(
      Number(owner_id),
      owner_type,
      Number(plan_id),
      user.memberId
    );

    return NextResponse.json({
      success: true,
      subscription_id: localSubscriptionId,
      paypal_subscription_id: subscription_id,
      message: "PayPal 구독이 성공적으로 활성화되었습니다.",
    });
  } catch (error: any) {
    console.error("PayPal subscription activation error:", error);
    return NextResponse.json(
      {
        error: "PayPal 구독 활성화 중 오류가 발생했습니다.",
        details: error.message
      },
      { status: 500 }
    );
  }
}
