import { type NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/admin-auth";
import { getAdminHealthSnapshot, listAdminHealthSnapshot } from "@/lib/admin-health";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminRole(request, ["SUPER_ADMIN", "OPS", "BILLING"]);
    if ("error" in admin) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const force = request.nextUrl.searchParams.get("force") === "1";
    if (force) {
      const snapshot = await getAdminHealthSnapshot();
      return NextResponse.json({ success: true, ...snapshot });
    }

    const items = await listAdminHealthSnapshot();
    if (items.length === 0) {
      const snapshot = await getAdminHealthSnapshot();
      return NextResponse.json({ success: true, ...snapshot });
    }

    const overallStatus = items.some((item) => item.status === "error")
      ? "error"
      : items.some((item) => item.status === "warn")
        ? "warn"
        : "ok";
    const checkedAt = items.reduce<string | null>((latest, item) => {
      if (!latest) return item.checkedAt;
      return new Date(item.checkedAt).getTime() > new Date(latest).getTime() ? item.checkedAt : latest;
    }, null);

    return NextResponse.json({ success: true, overallStatus, checkedAt, items });
  } catch (error) {
    console.error("Admin health error:", error);
    return NextResponse.json({ error: "헬스체크 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
