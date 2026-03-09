import { type NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/admin-auth";
import {
  buildAdminNotificationAudiencePreview,
  type AdminNotificationTarget,
} from "@/lib/admin-notification-broadcast";

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminRole(request, ["SUPER_ADMIN", "OPS"]);
    if ("error" in admin) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const body = (await request.json()) as { target?: AdminNotificationTarget; memberIds?: number[] };
    const target = body.target === "members" ? "members" : "all";
    const memberIds = Array.isArray(body.memberIds) ? body.memberIds.map(Number) : [];
    const preview = await buildAdminNotificationAudiencePreview({ target, memberIds });
    return NextResponse.json({ success: true, ...preview });
  } catch (error) {
    console.error("Admin notifications preview error:", error);
    return NextResponse.json({ error: "발송 대상 미리보기를 불러오지 못했습니다." }, { status: 500 });
  }
}
