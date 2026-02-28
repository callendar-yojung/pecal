import type { NextRequest } from "next/server";
import {
  jsonServerError,
  jsonSuccess,
  jsonUnauthorized,
} from "@/lib/api-response";
import { getAuthUser } from "@/lib/auth-helper";
import {
  notificationsUnreadCacheKey,
  notificationsUnreadTtlSeconds,
} from "@/lib/member-cache";
import { getUnreadCount } from "@/lib/notification";
import { readThroughCache } from "@/lib/redis-cache";

// GET /api/notifications/unread
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return jsonUnauthorized();

    const count = await readThroughCache(
      notificationsUnreadCacheKey(user.memberId),
      notificationsUnreadTtlSeconds,
      () => getUnreadCount(user.memberId),
    );
    return jsonSuccess({ count });
  } catch (error) {
    return jsonServerError(error, "Failed to fetch unread count");
  }
}
