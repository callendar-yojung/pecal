import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/access";
import { revokeMemberSession } from "@/lib/auth-token-store";
import { createOpsEvent } from "@/lib/ops-event-log";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { sessionId } = await params;
  const success = await revokeMemberSession({
    memberId: auth.user.memberId,
    sessionId,
  });

  if (!success) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  await createOpsEvent({
    eventType: "SESSION_FORCE_LOGOUT",
    status: "info",
    payload: {
      memberId: auth.user.memberId,
      sessionId,
    },
  });

  return NextResponse.json({ success: true });
}
