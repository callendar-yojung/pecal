import {
  createCacheKey,
  deleteCacheByPattern,
  deleteCacheKey,
} from "./redis-cache";

const ME_WORKSPACES_TTL_DEFAULT = 30;
const ME_TEAMS_TTL_DEFAULT = 30;
const NOTIFICATIONS_UNREAD_TTL_DEFAULT = 10;
const NOTIFICATIONS_LIST_TTL_DEFAULT = 10;

function toPositiveNumber(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const meWorkspacesTtlSeconds = toPositiveNumber(
  process.env.REDIS_ME_WORKSPACES_TTL_SEC,
  ME_WORKSPACES_TTL_DEFAULT,
);

export const meTeamsTtlSeconds = toPositiveNumber(
  process.env.REDIS_ME_TEAMS_TTL_SEC,
  ME_TEAMS_TTL_DEFAULT,
);

export const notificationsUnreadTtlSeconds = toPositiveNumber(
  process.env.REDIS_NOTIFICATIONS_UNREAD_TTL_SEC,
  NOTIFICATIONS_UNREAD_TTL_DEFAULT,
);

export const notificationsListTtlSeconds = toPositiveNumber(
  process.env.REDIS_NOTIFICATIONS_LIST_TTL_SEC,
  NOTIFICATIONS_LIST_TTL_DEFAULT,
);

export function meWorkspacesCacheKey(memberId: number) {
  return createCacheKey("me", "workspaces", "member", memberId);
}

export function meTeamsCacheKey(memberId: number) {
  return createCacheKey("me", "teams", "member", memberId);
}

export function notificationsUnreadCacheKey(memberId: number) {
  return createCacheKey("notifications", "unread", "member", memberId);
}

export function notificationsListCacheKey(memberId: number, limit: number) {
  return createCacheKey("notifications", "list", "member", memberId, "limit", limit);
}

export function notificationsListCachePattern(memberId: number) {
  return createCacheKey("notifications", "list", "member", memberId, "limit", "*");
}

export async function invalidateMemberCaches(
  memberId: number,
  options?: {
    meWorkspaces?: boolean;
    meTeams?: boolean;
    notificationsUnread?: boolean;
    notificationsList?: boolean;
    notificationsListLimit?: number;
  },
) {
  const jobs: Promise<void>[] = [];
  if (options?.meWorkspaces) {
    jobs.push(deleteCacheKey(meWorkspacesCacheKey(memberId)));
  }
  if (options?.meTeams) {
    jobs.push(deleteCacheKey(meTeamsCacheKey(memberId)));
  }
  if (options?.notificationsUnread) {
    jobs.push(deleteCacheKey(notificationsUnreadCacheKey(memberId)));
  }
  if (options?.notificationsList) {
    if (options.notificationsListLimit && options.notificationsListLimit > 0) {
      jobs.push(
        deleteCacheKey(
          notificationsListCacheKey(memberId, options.notificationsListLimit),
        ),
      );
    } else {
      jobs.push(deleteCacheByPattern(notificationsListCachePattern(memberId)));
    }
  }
  await Promise.all(jobs);
}
