import { type NextRequest, NextResponse } from "next/server";
import { createAdminAuditLogFromRequest } from "@/lib/admin-audit-log";
import { requireAdminRole } from "@/lib/admin-auth";
import {
  createPayPalBillingPlan,
  createPayPalProduct,
} from "@/lib/paypal-subscription";
import { createPlan } from "@/lib/plan";

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminRole(request, ["SUPER_ADMIN", "BILLING"]);
    if ("error" in admin) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
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
      return NextResponse.json({ error: "필수 항목을 모두 입력해주세요." }, { status: 400 });
    }

    const product = await createPayPalProduct({ name, description, type: "SERVICE" });
    const billingPlan = await createPayPalBillingPlan({
      product_id: product.id,
      name,
      description,
      price,
      currency,
      interval_unit,
      interval_count,
    });
    const planId = await createPlan(name, price, max_members, max_storage_mb);

    await createAdminAuditLogFromRequest(request, {
      adminId: Number(admin.admin_id),
      action: "PLAN_CREATE",
      targetType: "PLAN",
      targetId: planId,
      payload: {
        name,
        description,
        price,
        max_members,
        max_storage_mb,
        currency,
        interval_unit,
        interval_count,
        paypal_product_id: product.id,
        paypal_plan_id: billingPlan.id,
      },
    });

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
      { error: "PayPal 구독 상품 생성 중 오류가 발생했습니다.", details: error.message },
      { status: 500 },
    );
  }
}
