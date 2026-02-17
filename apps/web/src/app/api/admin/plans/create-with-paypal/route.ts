import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { createPayPalProduct, createPayPalBillingPlan } from "@/lib/paypal-subscription";
import { createPlan } from "@/lib/plan";

const secret = new TextEncoder().encode(
  process.env.API_SECRET_KEY || "default-secret-key"
);

async function verifyAdminToken(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.type !== "admin") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// POST /api/admin/plans/create-with-paypal - PayPal 구독 상품 생성 및 플랜 등록
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);

    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      price,
      max_members,
      max_storage_mb,
      currency = "USD",
      interval_unit = "MONTH",
      interval_count = 1,
    } = body;

    if (!name || !description || price === undefined || !max_members || !max_storage_mb) {
      return NextResponse.json(
        { error: "필수 항목을 모두 입력해주세요." },
        { status: 400 }
      );
    }

    // 1. PayPal 상품(Product) 생성
    const product = await createPayPalProduct({
      name,
      description,
      type: "SERVICE",
    });

    // 2. PayPal 플랜(Billing Plan) 생성
    const billingPlan = await createPayPalBillingPlan({
      product_id: product.id,
      name,
      description,
      price,
      currency,
      interval_unit,
      interval_count,
    });

    // 3. 로컬 데이터베이스에 플랜 저장
    const planId = await createPlan(
      name,
      price,
      max_members,
      max_storage_mb
    );

    return NextResponse.json({
      success: true,
      plan_id: planId,
      paypal_product_id: product.id,
      paypal_plan_id: billingPlan.id,
      message: "PayPal 구독 상품이 성공적으로 생성되었습니다.",
    });
  } catch (error: any) {
    console.error("PayPal plan creation error:", error);
    return NextResponse.json(
      {
        error: "PayPal 구독 상품 생성 중 오류가 발생했습니다.",
        details: error.message
      },
      { status: 500 }
    );
  }
}

