import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { getUnreadCount } from "@/lib/notification";
import { jsonServerError, jsonSuccess, jsonUnauthorized } from "@/lib/api-response";

// GET /api/notifications/unread
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return jsonUnauthorized();

    const count = await getUnreadCount(user.memberId);
    return jsonSuccess({ count });
  } catch (error) {
    return jsonServerError(error, "Failed to fetch unread count");
  }
}
