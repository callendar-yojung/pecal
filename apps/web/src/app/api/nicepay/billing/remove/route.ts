import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { getActiveBillingKey, removeBillingKeyById } from "@/lib/billing-key";
import { expireBillingKey, generateMoid } from "@/lib/nicepay";

/** DELETE - 빌키 삭제 (NicePay expire + DB 상태 변경) */
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const billingKey = await getActiveBillingKey(user.memberId);
    if (!billingKey) {
      return NextResponse.json(
        { error: "등록된 카드가 없습니다." },
        { status: 404 }
      );
    }

    // NicePay BID 만료 요청 (실패해도 DB 삭제는 진행)
    try {
      const orderId = generateMoid(`PECAL_EX_${user.memberId}`);
      const expireResult = await expireBillingKey(billingKey.bid, orderId);
      console.log("[Billing Remove] NicePay expire result:", expireResult);
    } catch (expireError: any) {
      console.warn(
        "[Billing Remove] NicePay expire failed (continuing with DB removal):",
        expireError.message
      );
    }

    // DB에서 빌키 상태 변경
    await removeBillingKeyById(billingKey.billing_key_id);

    return NextResponse.json({
      success: true,
      message: "카드가 삭제되었습니다.",
    });
  } catch (error: any) {
    console.error("[Billing Remove] Error:", error.message);
    return NextResponse.json(
      { error: error.message || "카드 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
