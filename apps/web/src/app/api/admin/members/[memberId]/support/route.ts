import { type NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/admin-auth";
import { getAdminMemberSupportSnapshot } from "@/lib/admin-member-support";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> },
) {
  try {
    const admin = await requireAdminRole(request, ["SUPER_ADMIN", "OPS"]);
    if ("error" in admin) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const { memberId } = await context.params;
    const numericMemberId = Number(memberId);
    if (!Number.isInteger(numericMemberId) || numericMemberId <= 0) {
      return NextResponse.json({ error: "Invalid member id" }, { status: 400 });
    }

    const snapshot = await getAdminMemberSupportSnapshot(numericMemberId);
    if (!snapshot) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Admin member support error:", error);
    return NextResponse.json(
      { error: "회원 지원 정보를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
