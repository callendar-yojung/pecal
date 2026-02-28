import type { NextRequest } from "next/server";
import {
  jsonError,
  jsonServerError,
  jsonSuccess,
  jsonUnauthorized,
} from "@/lib/api-response";
import { getAuthUser } from "@/lib/auth-helper";
import { invalidateMemberCaches } from "@/lib/member-cache";
import { deleteNotification, markNotificationRead } from "@/lib/notification";

// PATCH /api/notifications/{id}
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return jsonUnauthorized();

    const { id } = await params;
    const notificationId = Number(id);
    if (Number.isNaN(notificationId)) {
      return jsonError("Invalid notification id", 400);
    }

    const success = await markNotificationRead(notificationId, user.memberId);
    if (success) {
      await invalidateMemberCaches(user.memberId, {
        notificationsUnread: true,
        notificationsList: true,
      });
    }
    return jsonSuccess({ success });
  } catch (error) {
    return jsonServerError(error, "Failed to update notification");
  }
}

// DELETE /api/notifications/{id}
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return jsonUnauthorized();

    const { id } = await params;
    const notificationId = Number(id);
    if (Number.isNaN(notificationId)) {
      return jsonError("Invalid notification id", 400);
    }

    const success = await deleteNotification(notificationId, user.memberId);
    if (success) {
      await invalidateMemberCaches(user.memberId, {
        notificationsUnread: true,
        notificationsList: true,
      });
    }
    return jsonSuccess({ success });
  } catch (error) {
    return jsonServerError(error, "Failed to delete notification");
  }
}
