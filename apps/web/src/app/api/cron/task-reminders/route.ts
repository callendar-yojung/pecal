import { type NextRequest, NextResponse } from "next/server";
import {
  dispatchDueTaskReminders,
  processTaskReminderStream,
} from "@/lib/task-reminder-stream";
import { getRedisClient, toRedisKey } from "@/lib/redis-cache";

const LAST_RUN_KEY = toRedisKey("task:reminders:cron:last-run");

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * POST /api/cron/task-reminders
 * Redis Stream 기반 태스크 리마인더 처리
 *
 * 인증: Authorization: Bearer {CRON_SECRET}
 */
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
    const processedStreamEvents = await processTaskReminderStream();
    const sentNotifications = await dispatchDueTaskReminders();
    const payload = {
      ranAt: new Date().toISOString(),
      processedStreamEvents,
      sentNotifications,
    };
    const redis = getRedisClient();
    if (redis) {
      await redis.set(LAST_RUN_KEY, JSON.stringify(payload), "EX", 60 * 60 * 24);
    }

    return NextResponse.json({
      success: true,
      processedStreamEvents,
      sentNotifications,
    });
  } catch (error) {
    console.error("[Cron Task Reminders] failed:", error);
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
      { error: "Failed to process task reminders" },
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
