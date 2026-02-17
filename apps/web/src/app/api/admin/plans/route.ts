import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getAllPlans, updatePlan, deletePlan } from "@/lib/plan";

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

// GET /api/admin/plans - 관리자용 플랜 목록 조회
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);

    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const plans = await getAllPlans();
    return NextResponse.json(plans);
  } catch (error) {
    console.error("Admin plans error:", error);
    return NextResponse.json(
      { error: "플랜 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT /api/admin/plans - 플랜 수정
export async function PUT(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);

    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      plan_id,
      name,
      price,
      max_members,
      max_storage_mb,
      paypal_plan_id,
      paypal_product_id,
    } = body;

    if (!plan_id || !name || price === undefined || !max_members || !max_storage_mb) {
      return NextResponse.json(
        { error: "필수 항목을 모두 입력해주세요." },
        { status: 400 }
      );
    }

    const success = await updatePlan(
      plan_id,
      name,
      price,
      max_members,
      max_storage_mb
    );

    if (!success) {
      return NextResponse.json(
        { error: "플랜 수정에 실패했습니다." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "플랜이 성공적으로 수정되었습니다.",
    });
  } catch (error) {
    console.error("Admin plan update error:", error);
    return NextResponse.json(
      { error: "플랜 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/plans - 플랜 삭제
export async function DELETE(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);

    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("plan_id");

    if (!planId) {
      return NextResponse.json(
        { error: "플랜 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const success = await deletePlan(Number(planId));

    if (!success) {
      return NextResponse.json(
        { error: "플랜 삭제에 실패했습니다." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "플랜이 성공적으로 삭제되었습니다.",
    });
  } catch (error) {
    console.error("Admin plan delete error:", error);
    return NextResponse.json(
      { error: "플랜 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
