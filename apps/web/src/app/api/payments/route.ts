import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { getPaymentsByOwner } from "@/lib/payment-history";

/**
 * GET /api/payments?owner_id={id}&owner_type={type}
 * 결제 이력 조회
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const ownerId = searchParams.get("owner_id");
  const ownerType = searchParams.get("owner_type") as
    | "team"
    | "personal"
    | null;

  if (!ownerId || !ownerType) {
    return NextResponse.json(
      { error: "owner_id and owner_type are required" },
      { status: 400 }
    );
  }

  try {
    const payments = await getPaymentsByOwner(Number(ownerId), ownerType);
    return NextResponse.json({ payments });
  } catch (error: any) {
    console.error("[Payments API] Error:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch payment history" },
      { status: 500 }
    );
  }
}
