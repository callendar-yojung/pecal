import type { NextRequest } from "next/server";
import {
  jsonServerError,
  jsonSuccess,
  jsonUnauthorized,
} from "@/lib/api-response";
import { getAuthUser } from "@/lib/auth-helper";
import { invalidateMemberCaches } from "@/lib/member-cache";
import { clearNotifications } from "@/lib/notification";

// DELETE /api/notifications/clear
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return jsonUnauthorized();

    const deleted = await clearNotifications(user.memberId);
    if (deleted > 0) {
      await invalidateMemberCaches(user.memberId, {
        notificationsUnread: true,
        notificationsList: true,
      });
    }
    return jsonSuccess({ deleted });
  } catch (error) {
    return jsonServerError(error, "Failed to clear notifications");
  }
}
