import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helper";
import { createMobileClientEvent } from "@/lib/admin-mobile-ops";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    platform?: "ios" | "android";
    event_type?: "WIDGET_SYNC_FAILURE" | "WIDGET_SYNC_SUCCESS" | "APP_HEARTBEAT";
    app_version?: string | null;
    payload?: Record<string, unknown> | null;
  };

  if ((body.platform !== "ios" && body.platform !== "android") || !body.event_type) {
    return NextResponse.json({ error: "platform과 event_type이 필요합니다." }, { status: 400 });
  }

  await createMobileClientEvent({
    memberId: user.memberId,
    platform: body.platform,
    eventType: body.event_type,
    appVersion: body.app_version ?? null,
    payload: body.payload ?? null,
  });

  return NextResponse.json({ success: true });
}
