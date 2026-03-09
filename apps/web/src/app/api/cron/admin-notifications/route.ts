import { type NextRequest, NextResponse } from "next/server";
import { processScheduledAdminNotificationBroadcasts } from "@/lib/admin-notification-broadcast";
import { getRedisClient, toRedisKey } from "@/lib/redis-cache";

const LAST_RUN_KEY = toRedisKey("admin:notifications:cron:last-run");

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processScheduledAdminNotificationBroadcasts();
    const payload = {
      ranAt: new Date().toISOString(),
      ...result,
    };
    const redis = getRedisClient();
    if (redis) {
      await redis.set(LAST_RUN_KEY, JSON.stringify(payload), "EX", 60 * 60 * 24);
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Cron Admin Notifications] failed:", error);
    const redis = getRedisClient();
    if (redis) {
      await redis.set(
        LAST_RUN_KEY,
        JSON.stringify({
          ranAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        }),
        "EX",
        60 * 60 * 24,
      );
    }

    return NextResponse.json(
      { error: "Failed to process admin notifications" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redis = getRedisClient();
  if (!redis) {
    return NextResponse.json(
      { success: true, redis: false, lastRun: null },
      { status: 200 },
    );
  }

  const raw = await redis.get(LAST_RUN_KEY);
  let lastRun: Record<string, unknown> | null = null;
  if (raw) {
    try {
      lastRun = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      lastRun = { raw };
    }
  }

  return NextResponse.json({
    success: true,
    redis: true,
    lastRun,
  });
}
