import { type NextRequest, NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/admin";
import { requireAdminRole } from "@/lib/admin-auth";
import { getOpsDashboardMetrics, listRecentOpsEvents } from "@/lib/ops-event-log";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminRole(request, ["SUPER_ADMIN", "OPS", "BILLING"]);
    if ("error" in admin) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const [stats, ops, recentEvents] = await Promise.all([
      getDashboardStats(),
      getOpsDashboardMetrics(),
      listRecentOpsEvents(20),
    ]);

    return NextResponse.json({ ...stats, ops, recentEvents });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ error: "통계 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
