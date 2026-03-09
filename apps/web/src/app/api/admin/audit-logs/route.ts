import { type NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/admin-auth";
import { listAdminAuditLogs } from "@/lib/admin-audit-log";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminRole(request, ["SUPER_ADMIN", "OPS", "BILLING"]);
    if ("error" in admin) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "100");
    const logs = await listAdminAuditLogs(limit);
    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error("Admin audit logs error:", error);
    return NextResponse.json({ error: "감사 로그를 불러오지 못했습니다." }, { status: 500 });
  }
}
