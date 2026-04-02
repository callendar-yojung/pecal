import type { RowDataPacket } from "mysql2";
import pool from "./db";
import { invalidateMemberCaches } from "./member-cache";
import { createNotificationsBulk } from "./notification";
import { sendExpoPushNotifications } from "./push-notification";
import { getActivePushTokensByMemberIds } from "./push-token";
import {
  computeReminderTriggerUnix,
  parseDateTimeToUnix,
} from "./reminder-time";
import { getRedisClient, toRedisKey } from "./redis-cache";
import { getTaskById } from "./task";

type ReminderAction = "upsert" | "delete";

type ReminderJobState =
  | "PENDING"
  | "SENT"
  | "SKIPPED_PAST"
  | "CANCELLED"
  | "FAILED";

interface ReminderEventPayload {
  action: ReminderAction;
  taskId: number;
  workspaceId: number;
  title?: string;
  color?: string | null;
  startTime?: string;
  reminderMinutes?: number | null;
}

interface ReminderJobPayload {
  taskId: number;
  workspaceId: number;
  title: string;
  color: string | null;
  startAtUnix: number;
  reminderMinutes: number;
}

const STREAM_KEY = toRedisKey("task:reminders:stream");
const LAST_ID_KEY = toRedisKey("task:reminders:last-id");
const DUE_ZSET_KEY = toRedisKey("task:reminders:due");
const JOB_HASH_KEY = toRedisKey("task:reminders:jobs");
const STATUS_HASH_KEY = toRedisKey("task:reminders:status");

const BATCH_SIZE = Number(process.env.REMINDER_STREAM_BATCH_SIZE ?? 200);
const MAX_BATCH_LOOPS = Number(process.env.REMINDER_STREAM_MAX_LOOPS ?? 10);
const SEND_BATCH_SIZE = Number(process.env.REMINDER_SEND_BATCH_SIZE ?? 100);
const SEND_MAX_LOOPS = Number(process.env.REMINDER_SEND_MAX_LOOPS ?? 20);
const SENT_DEDUPE_TTL_SECONDS = Number(
  process.env.REMINDER_SENT_DEDUPE_TTL_SEC ?? 60 * 60 * 24 * 7,
);
const STREAM_MAXLEN = Number(process.env.REMINDER_STREAM_MAXLEN ?? 100000);
const MAX_LATE_DISPATCH_SECONDS = Number(
  process.env.REMINDER_MAX_LATE_DISPATCH_SECONDS ?? 900,
);
const FAILURE_RETRY_SECONDS = Number(
  process.env.REMINDER_FAILURE_RETRY_SECONDS ?? 60,
);

function toReminderJobKey(taskId: number) {
  return `task:${taskId}`;
}

function sanitizeReminderMinutes(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return null;
  const safe = Math.trunc(minutes);
  if (safe < 0 || safe > 7 * 24 * 60) return null;
  return safe;
}

function toIntOrNull(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

async function setReminderState(
  redis: NonNullable<ReturnType<typeof getRedisClient>>,
  jobKey: string,
  state: ReminderJobState,
  meta?: Record<string, unknown>,
) {
  await redis.hset(
    STATUS_HASH_KEY,
    jobKey,
    JSON.stringify({
      state,
      updatedAt: new Date().toISOString(),
      ...(meta ?? {}),
    }),
  );
}

function logReminderDecision(params: {
  taskId: number;
  workspaceId: number;
  taskStartUnix: number | null;
  remindAtUnix: number | null;
  nowUnix: number;
  decision: string;
  reason?: string;
}) {
  console.info(
    "[task-reminder]",
    JSON.stringify({
      task_id: params.taskId,
      workspace_id: params.workspaceId,
      task_start_unix: params.taskStartUnix,
      remind_at_unix: params.remindAtUnix,
      now_unix: params.nowUnix,
      decision: params.decision,
      reason: params.reason ?? null,
    }),
  );
}

export async function enqueueTaskReminderEvent(
  payload: ReminderEventPayload,
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const reminderMinutes = sanitizeReminderMinutes(payload.reminderMinutes);
  const fields: Record<string, string> = {
    action: payload.action,
    task_id: String(payload.taskId),
    workspace_id: String(payload.workspaceId),
    reminder_minutes: reminderMinutes === null ? "" : String(reminderMinutes),
    title: payload.title ?? "",
    color: payload.color ?? "",
    start_time: payload.startTime ?? "",
  };

  try {
    const maxLen = Math.max(1000, STREAM_MAXLEN);
    await redis.xadd(
      STREAM_KEY,
      "MAXLEN",
      "~",
      String(maxLen),
      "*",
      ...Object.entries(fields).flat(),
    );
  } catch (error) {
    console.warn("[task-reminder] enqueue failed:", error);
  }
}

function parseStreamEntryFields(
  entry: [string, string[]],
): ReminderEventPayload | null {
  const [, raw] = entry;
  const fields: Record<string, string> = {};
  for (let i = 0; i < raw.length; i += 2) {
    fields[raw[i]] = raw[i + 1] ?? "";
  }
  const taskId = Number(fields.task_id);
  const workspaceId = Number(fields.workspace_id);
  const action = fields.action as ReminderAction;
  if (!Number.isFinite(taskId) || taskId <= 0) return null;
  if (!Number.isFinite(workspaceId) || workspaceId <= 0) return null;
  if (action !== "upsert" && action !== "delete") return null;

  return {
    action,
    taskId,
    workspaceId,
    title: fields.title || undefined,
    color: fields.color || null,
    startTime: fields.start_time || undefined,
    reminderMinutes: sanitizeReminderMinutes(fields.reminder_minutes),
  };
}

async function upsertReminderJob(
  redis: NonNullable<ReturnType<typeof getRedisClient>>,
  payload: ReminderEventPayload,
) {
  const reminderMinutes = sanitizeReminderMinutes(payload.reminderMinutes);
  const startAtUnix = payload.startTime
    ? parseDateTimeToUnix(payload.startTime)
    : null;
  const jobKey = toReminderJobKey(payload.taskId);
  const nowUnix = Math.floor(Date.now() / 1000);

  if (reminderMinutes === null || startAtUnix === null || reminderMinutes < 0) {
    await setReminderState(redis, jobKey, "CANCELLED", {
      reason: "missing_or_invalid_schedule",
    });
    await redis
      .multi()
      .zrem(DUE_ZSET_KEY, jobKey)
      .hdel(JOB_HASH_KEY, jobKey)
      .exec();
    return;
  }

  const triggerAt = computeReminderTriggerUnix({
    startTime: new Date(startAtUnix * 1000),
    reminderMinutes,
  });
  if (triggerAt === null) {
    await setReminderState(redis, jobKey, "CANCELLED", {
      reason: "failed_to_compute_trigger",
    });
    await redis
      .multi()
      .zrem(DUE_ZSET_KEY, jobKey)
      .hdel(JOB_HASH_KEY, jobKey)
      .exec();
    return;
  }
  const scheduledTriggerAt = triggerAt > nowUnix ? triggerAt : nowUnix;

  const [futureRows] = await pool.query<RowDataPacket[]>(
    `SELECT id
     FROM tasks
     WHERE id = ?
       AND workspace_id = ?
       AND reminder_minutes IS NOT NULL
       AND (
         DATE_SUB(start_time, INTERVAL reminder_minutes MINUTE) > NOW()
         OR start_time > NOW()
       )
     LIMIT 1`,
    [payload.taskId, payload.workspaceId],
  );
  if (futureRows.length === 0) {
    logReminderDecision({
      taskId: payload.taskId,
      workspaceId: payload.workspaceId,
      taskStartUnix: startAtUnix,
      remindAtUnix: triggerAt,
      nowUnix,
      decision: "enqueue_skip_db_filter",
      reason: "db_query_filter_rejected",
    });
    await setReminderState(redis, jobKey, "SKIPPED_PAST", {
      reason: "db_query_filter_rejected",
      taskStartUnix: startAtUnix,
      remindAtUnix: triggerAt,
      nowUnix,
    });
    await redis
      .multi()
      .zrem(DUE_ZSET_KEY, jobKey)
      .hdel(JOB_HASH_KEY, jobKey)
      .exec();
    return;
  }

  const job: ReminderJobPayload = {
    taskId: payload.taskId,
    workspaceId: payload.workspaceId,
    title: payload.title ?? "",
    color: payload.color ?? null,
    startAtUnix,
    reminderMinutes,
  };

  await redis
    .multi()
    .zadd(DUE_ZSET_KEY, String(scheduledTriggerAt), jobKey)
    .hset(JOB_HASH_KEY, jobKey, JSON.stringify(job))
    .exec();
  await setReminderState(redis, jobKey, "PENDING", {
    taskStartUnix: startAtUnix,
    remindAtUnix: triggerAt,
    scheduledRemindAtUnix: scheduledTriggerAt,
  });
}

async function deleteReminderJob(
  redis: NonNullable<ReturnType<typeof getRedisClient>>,
  taskId: number,
) {
  const jobKey = toReminderJobKey(taskId);
  await setReminderState(redis, jobKey, "CANCELLED", { reason: "deleted" });
  await redis
    .multi()
    .zrem(DUE_ZSET_KEY, jobKey)
    .hdel(JOB_HASH_KEY, jobKey)
    .exec();
}

export async function processTaskReminderStream(): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;

  const lastId = (await redis.get(LAST_ID_KEY)) ?? "0-0";
  let processed = 0;
  let nextLastId = lastId;
  let loops = 0;

  while (loops < MAX_BATCH_LOOPS) {
    loops += 1;
    const result = await redis.xread(
      "COUNT",
      Math.max(1, BATCH_SIZE),
      "STREAMS",
      STREAM_KEY,
      nextLastId,
    );
    if (!result || result.length === 0) break;

    for (const [, entries] of result) {
      for (const entry of entries) {
        const payload = parseStreamEntryFields(entry as [string, string[]]);
        const entryId = entry[0];
        if (!payload) {
          nextLastId = entryId;
          continue;
        }
        if (payload.action === "delete") {
          await deleteReminderJob(redis, payload.taskId);
        } else {
          await upsertReminderJob(redis, payload);
        }
        processed += 1;
        nextLastId = entryId;
      }
    }

    if (processed >= BATCH_SIZE * MAX_BATCH_LOOPS) break;
  }

  if (nextLastId !== lastId) {
    await redis.set(LAST_ID_KEY, nextLastId);
  }
  return processed;
}

async function getWorkspaceMemberIds(workspaceId: number): Promise<number[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT w.type, w.owner_id
     FROM workspaces w
     WHERE w.workspace_id = ?
     LIMIT 1`,
    [workspaceId],
  );

  if (rows.length === 0) return [];
  const row = rows[0];
  if (row.type === "personal") {
    return [Number(row.owner_id)];
  }

  const [memberRows] = await pool.query<RowDataPacket[]>(
    `SELECT tm.member_id
     FROM team_members tm
     WHERE tm.team_id = ?`,
    [Number(row.owner_id)],
  );
  return memberRows
    .map((r) => Number(r.member_id))
    .filter((id) => Number.isFinite(id) && id > 0);
}

function formatReminderMessage(taskTitle: string, minutes: number) {
  if (minutes <= 0) {
    return `'${taskTitle}' 일정 시작 시간입니다.`;
  }
  return `'${taskTitle}' 일정 ${minutes}분 전입니다.`;
}

export async function dispatchDueTaskReminders(): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;

  let sentCount = 0;
  let loop = 0;
  while (loop < Math.max(1, SEND_MAX_LOOPS)) {
    loop += 1;
    const nowUnix = Math.floor(Date.now() / 1000);
    const jobKeys = await redis.zrangebyscore(
      DUE_ZSET_KEY,
      "-inf",
      String(nowUnix),
      "LIMIT",
      0,
      Math.max(1, SEND_BATCH_SIZE),
    );
    if (jobKeys.length === 0) break;

    for (const jobKey of jobKeys) {
      try {
      const raw = await redis.hget(JOB_HASH_KEY, jobKey);
      if (!raw) {
        await redis.zrem(DUE_ZSET_KEY, jobKey);
        continue;
      }

      let job: ReminderJobPayload | null = null;
      try {
        job = JSON.parse(raw) as ReminderJobPayload;
      } catch {
        await setReminderState(redis, jobKey, "FAILED", {
          reason: "job_json_parse_failed",
        });
        await redis
          .multi()
          .zrem(DUE_ZSET_KEY, jobKey)
          .hdel(JOB_HASH_KEY, jobKey)
          .exec();
        continue;
      }
      if (!job) continue;

      const task = await getTaskById(job.taskId);
      if (!task || task.status === "DONE") {
        await setReminderState(redis, jobKey, "CANCELLED", {
          reason: !task ? "task_not_found" : "task_done",
        });
        await redis
          .multi()
          .zrem(DUE_ZSET_KEY, jobKey)
          .hdel(JOB_HASH_KEY, jobKey)
          .exec();
        continue;
      }

      const currentStartAtUnix = parseDateTimeToUnix(task.start_time);
      const currentReminderMinutes = sanitizeReminderMinutes(task.reminder_minutes);
      if (
        currentStartAtUnix === null ||
        currentReminderMinutes === null ||
        currentStartAtUnix !== job.startAtUnix ||
        currentReminderMinutes !== job.reminderMinutes
      ) {
        await setReminderState(redis, jobKey, "CANCELLED", {
          reason: "schedule_changed_or_invalid",
        });
        await redis
          .multi()
          .zrem(DUE_ZSET_KEY, jobKey)
          .hdel(JOB_HASH_KEY, jobKey)
          .exec();
        continue;
      }

      const remindAtUnix = currentStartAtUnix - currentReminderMinutes * 60;
      if (remindAtUnix > nowUnix) {
        await redis.zadd(DUE_ZSET_KEY, String(remindAtUnix), jobKey);
        await setReminderState(redis, jobKey, "PENDING", {
          reason: "early_fetch_rescheduled",
          taskStartUnix: currentStartAtUnix,
          remindAtUnix,
        });
        continue;
      }
      if (
        nowUnix > remindAtUnix + MAX_LATE_DISPATCH_SECONDS
      ) {
        logReminderDecision({
          taskId: job.taskId,
          workspaceId: job.workspaceId,
          taskStartUnix: currentStartAtUnix,
          remindAtUnix,
          nowUnix,
          decision: "skip_past",
          reason: "late_dispatch_window_exceeded",
        });
        await setReminderState(redis, jobKey, "SKIPPED_PAST", {
          taskStartUnix: currentStartAtUnix,
          remindAtUnix,
          nowUnix,
          reason: "late_dispatch_window_exceeded",
        });
        await redis
          .multi()
          .zrem(DUE_ZSET_KEY, jobKey)
          .hdel(JOB_HASH_KEY, jobKey)
          .exec();
        continue;
      }

      const memberIds = await getWorkspaceMemberIds(job.workspaceId);
      if (memberIds.length > 0) {
        const notificationRows: Array<{
          member_id: number;
          type: string;
          title?: string | null;
          message?: string | null;
          payload?: Record<string, unknown> | null;
          source_type?: string | null;
          source_id?: number | null;
        }> = [];

        for (const memberId of memberIds) {
          const idempotencyKey = `${memberId}:${job.taskId}:${job.startAtUnix}:${job.reminderMinutes}`;
          const dedupeKey = toRedisKey(
            `task:reminders:idempotency:${idempotencyKey}`,
          );
          const setResult = await redis.set(
            dedupeKey,
            "1",
            "EX",
            Math.max(60, SENT_DEDUPE_TTL_SECONDS),
            "NX",
          );
          if (setResult !== "OK") continue;

          notificationRows.push({
            member_id: memberId,
            type: "TASK_REMINDER",
            title: "일정 알림",
            message: formatReminderMessage(task.title, job.reminderMinutes),
            payload: {
              task_id: task.id,
              workspace_id: task.workspace_id,
              start_time: task.start_time,
              end_time: task.end_time,
              reminder_minutes: job.reminderMinutes,
              color: task.color ?? null,
              reminder_idempotency_key: idempotencyKey,
            },
            source_type: "TASK",
            source_id: task.id,
          });
        }

        if (notificationRows.length > 0) {
          const inserted = await createNotificationsBulk(notificationRows);
          sentCount += inserted;
          const memberIdsForPush = [
            ...new Set(notificationRows.map((row) => row.member_id)),
          ];
          const pushTokens = await getActivePushTokensByMemberIds(memberIdsForPush);
          if (pushTokens.length > 0) {
            const pushByMember = new Map<number, string[]>();
            for (const tokenRow of pushTokens) {
              const current = pushByMember.get(tokenRow.member_id) ?? [];
              current.push(tokenRow.token);
              pushByMember.set(tokenRow.member_id, current);
            }
            const pushMessages = notificationRows.flatMap((row) => {
              const tokens = pushByMember.get(row.member_id) ?? [];
              return tokens.map((token) => ({
                to: token,
                title: row.title ?? "일정 알림",
                body: row.message ?? "",
                sound: "default" as const,
                priority: "high" as const,
                data: {
                  type: "TASK_REMINDER",
                  task_id: row.source_id ?? null,
                  source_type: row.source_type ?? "TASK",
                  ...row.payload,
                },
              }));
            });
            if (pushMessages.length > 0) {
              await sendExpoPushNotifications(pushMessages);
            }
          }
          await Promise.all(
            notificationRows.map((row) =>
              invalidateMemberCaches(row.member_id, {
                notificationsUnread: true,
                notificationsList: true,
              }),
            ),
          );
        }
      }

      logReminderDecision({
        taskId: job.taskId,
        workspaceId: job.workspaceId,
        taskStartUnix: currentStartAtUnix,
        remindAtUnix,
        nowUnix,
        decision: "sent",
      });
      await setReminderState(redis, jobKey, "SENT", {
        taskStartUnix: currentStartAtUnix,
        remindAtUnix,
        nowUnix,
      });
      await redis
        .multi()
        .zrem(DUE_ZSET_KEY, jobKey)
        .hdel(JOB_HASH_KEY, jobKey)
        .exec();
      } catch (error) {
        await setReminderState(redis, jobKey, "FAILED", {
          reason: error instanceof Error ? error.message : String(error),
        });
        const retryAt =
          Math.floor(Date.now() / 1000) + Math.max(30, FAILURE_RETRY_SECONDS);
        await redis.zadd(DUE_ZSET_KEY, String(retryAt), jobKey);
        console.error("[task-reminder] dispatch error", { jobKey, error });
      }
    }
  }

  return sentCount;
}
