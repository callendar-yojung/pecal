import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { deleteNotification, markNotificationRead } from "@/lib/notification";
import {
  jsonError,
  jsonServerError,
  jsonSuccess,
  jsonUnauthorized,
} from "@/lib/api-response";

// PATCH /api/notifications/{id}
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    return jsonSuccess({ success });
  } catch (error) {
    return jsonServerError(error, "Failed to update notification");
  }
}

// DELETE /api/notifications/{id}
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    return jsonSuccess({ success });
  } catch (error) {
    return jsonServerError(error, "Failed to delete notification");
  }
}
