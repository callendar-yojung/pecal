import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { respondToInvitation } from "@/lib/invitation";
import { markNotificationsReadBySource } from "@/lib/notification";
import {
  jsonError,
  jsonServerError,
  jsonSuccess,
  jsonUnauthorized,
} from "@/lib/api-response";

// PATCH /api/invitations/{id} { action: 'accept' | 'decline' }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return jsonUnauthorized();

    const { id } = await params;
    const invitationId = Number(id);
    if (Number.isNaN(invitationId)) {
      return jsonError("Invalid invitation id", 400);
    }

    const body = await request.json();
    const action = body?.action === "accept" ? "accept" : body?.action === "decline" ? "decline" : null;
    if (!action) {
      return jsonError("Invalid action", 400);
    }

    const result = await respondToInvitation({
      invitationId,
      memberId: user.memberId,
      action,
    });

    if (!result.success) {
      return jsonError(result.message || "Failed", 400);
    }

    await markNotificationsReadBySource(user.memberId, "TEAM_INVITE", invitationId);

    return jsonSuccess();
  } catch (error) {
    return jsonServerError(error, "Failed to respond invitation");
  }
}
