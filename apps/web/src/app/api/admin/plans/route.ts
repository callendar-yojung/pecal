import { type NextRequest, NextResponse } from "next/server";
import { createAdminAuditLogFromRequest } from "@/lib/admin-audit-log";
import { requireAdminRole } from "@/lib/admin-auth";
import { deletePlan, getAllPlans, updatePlan } from "@/lib/plan";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminRole(request, ["SUPER_ADMIN", "BILLING"]);
    if ("error" in admin) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }
    const plans = await getAllPlans();
    return NextResponse.json(plans);
  } catch (error) {
    console.error("Admin plans error:", error);
    return NextResponse.json({ error: "플랜 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdminRole(request, ["SUPER_ADMIN", "BILLING"]);
    if ("error" in admin) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const body = await request.json();
    const { plan_id, name, price, max_members, max_storage_mb, paypal_plan_id, paypal_product_id } = body;
    if (!plan_id || !name || price === undefined || !max_members || !max_storage_mb) {
      return NextResponse.json({ error: "필수 항목을 모두 입력해주세요." }, { status: 400 });
    }

    const success = await updatePlan(plan_id, name, price, max_members, max_storage_mb);
    if (!success) {
      return NextResponse.json({ error: "플랜 수정에 실패했습니다." }, { status: 400 });
    }

    await createAdminAuditLogFromRequest(request, {
      adminId: Number(admin.admin_id),
      action: "PLAN_UPDATE",
      targetType: "PLAN",
      targetId: Number(plan_id),
      payload: { name, price, max_members, max_storage_mb, paypal_plan_id: paypal_plan_id ?? null, paypal_product_id: paypal_product_id ?? null },
    });

    return NextResponse.json({ success: true, message: "플랜이 성공적으로 수정되었습니다." });
  } catch (error) {
    console.error("Admin plan update error:", error);
    return NextResponse.json({ error: "플랜 수정 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdminRole(request, ["SUPER_ADMIN", "BILLING"]);
    if ("error" in admin) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("plan_id");
    if (!planId) {
      return NextResponse.json({ error: "플랜 ID가 필요합니다." }, { status: 400 });
    }

    const success = await deletePlan(Number(planId));
    if (!success) {
      return NextResponse.json({ error: "플랜 삭제에 실패했습니다." }, { status: 400 });
    }

    await createAdminAuditLogFromRequest(request, {
      adminId: Number(admin.admin_id),
      action: "PLAN_DELETE",
      targetType: "PLAN",
      targetId: Number(planId),
      payload: { plan_id: Number(planId) },
    });

    return NextResponse.json({ success: true, message: "플랜이 성공적으로 삭제되었습니다." });
  } catch (error) {
    console.error("Admin plan delete error:", error);
    return NextResponse.json({ error: "플랜 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
