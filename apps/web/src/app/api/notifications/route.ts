import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { getNotificationsForMember } from "@/lib/notification";
import { jsonServerError, jsonSuccess, jsonUnauthorized } from "@/lib/api-response";

// GET /api/notifications?limit=20
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return jsonUnauthorized();

    const limit = Number(request.nextUrl.searchParams.get("limit") || 20);
    const notifications = await getNotificationsForMember(user.memberId, limit);
    return jsonSuccess({ notifications });
  } catch (error) {
    return jsonServerError(error, "Failed to fetch notifications");
  }
}
