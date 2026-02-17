import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import {
  getSubscriptionsByOwnerId,
  getActiveSubscriptionByOwner,
  getSubscriptionById,
  createSubscription,
  updateSubscriptionStatus,
  cancelSubscription,
} from "@/lib/subscription";

// GET /api/subscriptions?owner_id=1&owner_type=team - 오너의 모든 구독 조회
// GET /api/subscriptions?owner_id=1&owner_type=personal&active=true - 오너의 활성 구독 조회
// GET /api/subscriptions?id=1 - 특정 구독 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get("owner_id");
    const ownerType = searchParams.get("owner_type") as "team" | "personal";
    const active = searchParams.get("active") === "true";
    const id = searchParams.get("id");

    let subscriptions;
    if (id) {
      // 특정 구독 조회
      subscriptions = await getSubscriptionById(Number(id));
    } else if (ownerId && ownerType) {
      // 오너의 구독 조회
      if (active) {
        subscriptions = await getActiveSubscriptionByOwner(Number(ownerId), ownerType);
      } else {
        subscriptions = await getSubscriptionsByOwnerId(Number(ownerId), ownerType);
      }
    } else {
      return NextResponse.json(
        { error: "오너 ID와 타입 또는 구독 ID가 필요합니다." },
        { status: 400 }
      );
    }

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}

// POST /api/subscriptions - 새 구독 생성
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { owner_id, owner_type, plan_id } = body;

    if (!owner_id || !owner_type || !plan_id) {
      return NextResponse.json(
        { error: "owner_id, owner_type, plan_id가 필요합니다." },
        { status: 400 }
      );
    }

    // 구독 생성 로직
    const newSubscription = await createSubscription(
      Number(owner_id),
      owner_type,
      Number(plan_id)
    );

    return NextResponse.json({ subscription_id: newSubscription }, { status: 201 });
  } catch (error) {
    console.error("Error creating subscription:", error);
    return NextResponse.json(
      { error: "Failed to create subscription" },
      { status: 500 }
    );
  }
}

// PUT /api/subscriptions - 구독 상태 수정
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, status } = body;

    // CANCELED 상태면 next_payment_date도 NULL로 설정하는 cancelSubscription 사용
    let result: boolean;
    if (status === "CANCELED") {
      result = await cancelSubscription(Number(id));
    } else {
      result = await updateSubscriptionStatus(Number(id), status);
    }

    return NextResponse.json({ success: result });
  } catch (error) {
    console.error("Error updating subscription:", error);
    return NextResponse.json(
      { error: "Failed to update subscription" },
      { status: 500 }
    );
  }
}

// DELETE /api/subscriptions?id=1 - 구독 취소
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "구독 ID가 필요합니다." },
        { status: 400 }
      );
    }

    // 구독 취소 로직
    const canceled = await cancelSubscription(Number(id));

    return NextResponse.json({ success: canceled });
  } catch (error) {
    console.error("Error canceling subscription:", error);
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}
