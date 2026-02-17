import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { clearNotifications } from "@/lib/notification";
import { jsonServerError, jsonSuccess, jsonUnauthorized } from "@/lib/api-response";

// DELETE /api/notifications/clear
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return jsonUnauthorized();

    const deleted = await clearNotifications(user.memberId);
    return jsonSuccess({ deleted });
  } catch (error) {
    return jsonServerError(error, "Failed to clear notifications");
  }
}
