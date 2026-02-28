import type { NextRequest } from "next/server";
import { readThroughCache } from "@/lib/redis-cache";
import {
  notificationsListCacheKey as memberNotificationsListCacheKey,
  notificationsListTtlSeconds as memberNotificationsListTtlSeconds,
} from "@/lib/member-cache";
import {
  jsonServerError,
  jsonSuccess,
  jsonUnauthorized,
} from "@/lib/api-response";
import { getAuthUser } from "@/lib/auth-helper";
import { getNotificationsForMember } from "@/lib/notification";

// GET /api/notifications?limit=20
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return jsonUnauthorized();

    const limit = Number(request.nextUrl.searchParams.get("limit") || 20);
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;
    const notifications = await readThroughCache(
      memberNotificationsListCacheKey(user.memberId, safeLimit),
      memberNotificationsListTtlSeconds,
      () => getNotificationsForMember(user.memberId, safeLimit),
    );
    return jsonSuccess({ notifications });
  } catch (error) {
    return jsonServerError(error, "Failed to fetch notifications");
  }
}
