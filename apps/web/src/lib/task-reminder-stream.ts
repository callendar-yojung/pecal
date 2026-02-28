import { createNotificationsBulk } from "./notification";
import { getRedisClient, toRedisKey } from "./redis-cache";
import { invalidateMemberCaches } from "./member-cache";
import { getTaskById } from "./task";
import { sendExpoPushNotifications } from "./push-notification";
import { getActivePushTokensByMemberIds } from "./push-token";
import pool from "./db";
import type { RowDataPacket } from "mysql2";

type ReminderAction = "upsert" | "delete";

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

const BATCH_SIZE = Number(process.env.REMINDER_STREAM_BATCH_SIZE ?? 200);
const MAX_BATCH_LOOPS = Number(process.env.REMINDER_STREAM_MAX_LOOPS ?? 10);
const SEND_BATCH_SIZE = Number(process.env.REMINDER_SEND_BATCH_SIZE ?? 100);
const SENT_DEDUPE_TTL_SECONDS = Number(
  process.env.REMINDER_SENT_DEDUPE_TTL_SEC ?? 60 * 60 * 24 * 7,
);
const STREAM_MAXLEN = Number(process.env.REMINDER_STREAM_MAXLEN ?? 100000);
const DEFAULT_TZ_OFFSET_MINUTES = Number(
  process.env.REMINDER_DEFAULT_TZ_OFFSET_MINUTES ?? 540,
);

function toReminderJobKey(taskId: number) {
  return `task:${taskId}`;
}

function resolveReminderOffsetMinutes(): number {
  if (
    Number.isFinite(DEFAULT_TZ_OFFSET_MINUTES) &&
    Math.abs(DEFAULT_TZ_OFFSET_MINUTES) <= 24 * 60
  ) {
    return Math.trunc(DEFAULT_TZ_OFFSET_MINUTES);
  }
  return 540;
}

function parseDatetimeToUnix(datetime: string | Date): number | null {
  if (datetime instanceof Date) {
    if (Number.isNaN(datetime.getTime())) return null;
    return Math.floor(datetime.getTime() / 1000);
  }
  const match = datetime.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (!match) return null;
  const [, y, m, d, hh, mm, ss = "00"] = match;
  const utcMs = Date.UTC(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(hh),
    Number(mm),
    Number(ss),
    0,
  );
  const offsetMinutes = resolveReminderOffsetMinutes();
  return Math.floor((utcMs - offsetMinutes * 60 * 1000) / 1000);
}

function sanitizeReminderMinutes(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return null;
  const safe = Math.trunc(minutes);
  if (safe < 0 || safe > 7 * 24 * 60) return null;
  return safe;
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
    reminder_minutes:
      reminderMinutes === null ? "" : String(reminderMinutes),
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

function parseStreamEntryFields(entry: [string, string[]]): ReminderEventPayload | null {
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

async function upsertReminderJob(redis: NonNullable<ReturnType<typeof getRedisClient>>, payload: ReminderEventPayload) {
  const reminderMinutes = sanitizeReminderMinutes(payload.reminderMinutes);
  const startAtUnix = payload.startTime ? parseDatetimeToUnix(payload.startTime) : null;
  const jobKey = toReminderJobKey(payload.taskId);

  if (
    reminderMinutes === null ||
    startAtUnix === null ||
    reminderMinutes < 0
  ) {
    await redis.multi().zrem(DUE_ZSET_KEY, jobKey).hdel(JOB_HASH_KEY, jobKey).exec();
    return;
  }

  const triggerAt = startAtUnix - reminderMinutes * 60;
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
    .zadd(DUE_ZSET_KEY, String(triggerAt), jobKey)
    .hset(JOB_HASH_KEY, jobKey, JSON.stringify(job))
    .exec();
}

async function deleteReminderJob(redis: NonNullable<ReturnType<typeof getRedisClient>>, taskId: number) {
  const jobKey = toReminderJobKey(taskId);
  await redis.multi().zrem(DUE_ZSET_KEY, jobKey).hdel(JOB_HASH_KEY, jobKey).exec();
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
  return memberRows.map((r) => Number(r.member_id)).filter((id) => Number.isFinite(id) && id > 0);
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

  const nowUnix = Math.floor(Date.now() / 1000);
  const jobKeys = await redis.zrangebyscore(
    DUE_ZSET_KEY,
    "-inf",
    String(nowUnix),
    "LIMIT",
    0,
    Math.max(1, SEND_BATCH_SIZE),
  );
  if (jobKeys.length === 0) return 0;

  let sentCount = 0;

  for (const jobKey of jobKeys) {
    const raw = await redis.hget(JOB_HASH_KEY, jobKey);
    if (!raw) {
      await redis.zrem(DUE_ZSET_KEY, jobKey);
      continue;
    }

    let job: ReminderJobPayload | null = null;
    try {
      job = JSON.parse(raw) as ReminderJobPayload;
    } catch {
      await redis.multi().zrem(DUE_ZSET_KEY, jobKey).hdel(JOB_HASH_KEY, jobKey).exec();
      continue;
    }
    if (!job) continue;

    const task = await getTaskById(job.taskId);
    if (!task || task.status === "DONE") {
      await redis.multi().zrem(DUE_ZSET_KEY, jobKey).hdel(JOB_HASH_KEY, jobKey).exec();
      continue;
    }

    const currentStartAtUnix = parseDatetimeToUnix(task.start_time);
    const currentReminderMinutes = sanitizeReminderMinutes(task.reminder_minutes);
    if (
      currentStartAtUnix === null ||
      currentReminderMinutes === null ||
      currentStartAtUnix !== job.startAtUnix ||
      currentReminderMinutes !== job.reminderMinutes
    ) {
      await redis.multi().zrem(DUE_ZSET_KEY, jobKey).hdel(JOB_HASH_KEY, jobKey).exec();
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
        const dedupeKey = toRedisKey(
          `task:reminders:sent:${memberId}:${job.taskId}:${job.startAtUnix}:${job.reminderMinutes}`,
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
          },
          source_type: "TASK",
          source_id: task.id,
        });
      }

      if (notificationRows.length > 0) {
        const inserted = await createNotificationsBulk(notificationRows);
        sentCount += inserted;
        const memberIdsForPush = [...new Set(notificationRows.map((row) => row.member_id))];
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

    await redis.multi().zrem(DUE_ZSET_KEY, jobKey).hdel(JOB_HASH_KEY, jobKey).exec();
  }

  return sentCount;
}
