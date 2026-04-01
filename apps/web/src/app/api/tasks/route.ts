import { type NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  requireTaskAccess,
  requireWorkspaceAccess,
} from "@/lib/access";
import {
  createTask,
  deleteTaskRecurrence,
  deleteTask,
  getTaskById,
  getTasksByWorkspaceIdPaginated,
  upsertTaskRecurrence,
  updateTask,
} from "@/lib/task";
import { attachFileToTask } from "@/lib/task-attachment";
import { enqueueTaskReminderEvent } from "@/lib/task-reminder-stream";
import { computeReminderTriggerUnix } from "@/lib/reminder-time";
import { getPermissionsByMember, getTeamById } from "@/lib/team";
import { getWorkspaceById } from "@/lib/workspace";
import { getCategoryById } from "@/lib/category";

type RecurrenceInput = {
  enabled?: boolean;
  start_date?: string;
  end_date?: string;
  weekdays?: number[];
};

function parseReminderMinutes(value: unknown): {
  valid: boolean;
  value: number | null;
} {
  if (value === undefined || value === null || value === "") {
    return { valid: true, value: null };
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return { valid: false, value: null };
  const minutes = Math.trunc(parsed);
  if (minutes < 0 || minutes > 10080) return { valid: false, value: null };
  return { valid: true, value: minutes };
}

function parseLocalDateFromString(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const date = new Date(year, month, day, 0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function extractTimePart(datetime: string): string | null {
  const match = datetime.match(/[ T](\d{2}:\d{2}(?::\d{2})?)/);
  if (!match) return null;
  return match[1].length === 5 ? `${match[1]}:00` : match[1];
}

function findNextRecurringReminderTriggerUnix(params: {
  nowUnix: number;
  recurrenceStartDate: string;
  recurrenceEndDate: string;
  weekdays: number[];
  startTimeTemplate: string;
  reminderMinutes: number;
}): number | null {
  const recurrenceStart = parseLocalDateFromString(params.recurrenceStartDate);
  const recurrenceEnd = parseLocalDateFromString(params.recurrenceEndDate);
  const timePart = extractTimePart(params.startTimeTemplate);
  if (!recurrenceStart || !recurrenceEnd || !timePart) return null;
  if (recurrenceStart > recurrenceEnd) return null;
  const weekdaySet = new Set(params.weekdays);
  if (weekdaySet.size === 0) return null;

  const cursor = new Date(recurrenceStart);
  while (cursor <= recurrenceEnd) {
    if (weekdaySet.has(cursor.getDay())) {
      const startTime = `${formatDateKey(cursor)}T${timePart}`;
      const triggerUnix = computeReminderTriggerUnix({
        startTime,
        reminderMinutes: params.reminderMinutes,
      });
      if (triggerUnix !== null && triggerUnix > params.nowUnix) {
        return triggerUnix;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

// GET /api/tasks?workspace_id={id}&page=1&limit=20&sort_by=start_time&sort_order=DESC&status=TODO&search=keyword
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get("workspace_id");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspace_id is required" },
        { status: 400 },
      );
    }

    // 워크스페이스 접근 권한 확인
    const access = await requireWorkspaceAccess(request, Number(workspaceId));
    if (access instanceof NextResponse) return access;

    const page = searchParams.get("page");
    const limit = searchParams.get("limit");
    const sort_by = searchParams.get("sort_by");
    const sort_order = searchParams.get("sort_order");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const result = await getTasksByWorkspaceIdPaginated(Number(workspaceId), {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sort_by: sort_by || undefined,
      sort_order:
        sort_order === "ASC" || sort_order === "DESC" ? sort_order : undefined,
      status: status || undefined,
      search: search || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 },
    );
  }
}

// POST /api/tasks - 새 태스크 생성
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const body = await request.json();
    const {
      title,
      start_time,
      end_time,
      content,
      status,
      workspace_id,
      color,
      category_id,
      tag_ids,
      file_ids,
      reminder_minutes,
      recurrence,
    } = body;

    // 유효성 검사
    if (!title || !start_time || !end_time || !workspace_id) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: title, start_time, end_time, workspace_id",
        },
        { status: 400 },
      );
    }

    // 워크스페이스 접근 권한 확인
    const access = await requireWorkspaceAccess(request, Number(workspace_id));
    if (access instanceof NextResponse) return access;

    const workspace = await getWorkspaceById(Number(workspace_id));
    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );
    }

    if (workspace.type === "team") {
      const team = await getTeamById(workspace.owner_id);
      if (!team) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 });
      }

      if (team.created_by !== user.memberId) {
        const permissions = await getPermissionsByMember(
          team.id,
          user.memberId,
        );
        if (!permissions.includes("TASK_CREATE")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    // 시간 유효성 검사
    if (new Date(start_time) >= new Date(end_time)) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 },
      );
    }

    const reminderParsed = parseReminderMinutes(reminder_minutes);
    if (!reminderParsed.valid) {
      return NextResponse.json(
        { error: "reminder_minutes must be an integer between 0 and 10080" },
        { status: 400 },
      );
    }
    const nowUnix = Math.floor(Date.now() / 1000);

    const recurrenceInput: RecurrenceInput | null =
      recurrence && typeof recurrence === "object" ? (recurrence as RecurrenceInput) : null;

    const shouldCreateRecurring = Boolean(
      recurrenceInput?.enabled &&
        recurrenceInput?.start_date &&
        recurrenceInput?.end_date &&
        Array.isArray(recurrenceInput?.weekdays) &&
        recurrenceInput.weekdays.length > 0,
    );
    if (category_id !== undefined && category_id !== null) {
      const category = await getCategoryById(Number(category_id));
      if (!category) {
        return NextResponse.json({ error: "Category not found" }, { status: 404 });
      }
      if (
        category.owner_type !== workspace.type ||
        Number(category.owner_id) !== Number(workspace.owner_id)
      ) {
        return NextResponse.json(
          { error: "Category does not belong to this workspace owner" },
          { status: 400 },
        );
      }
    }

    if (!shouldCreateRecurring) {
      if (reminderParsed.value !== null) {
        const triggerUnix = computeReminderTriggerUnix({
          startTime: start_time,
          reminderMinutes: reminderParsed.value,
        });
        if (triggerUnix === null) {
          return NextResponse.json(
            { error: "Invalid start_time for reminder calculation" },
            { status: 400 },
          );
        }
        if (triggerUnix <= nowUnix) {
          return NextResponse.json(
            { error: "Reminder time must be in the future" },
            { status: 400 },
          );
        }
      }

      const taskId = await createTask({
        title,
        start_time,
        end_time,
        content,
        status: status || "TODO",
        color: color || "#3B82F6",
        category_id: category_id ?? null,
        tag_ids: tag_ids || [],
        reminder_minutes: reminderParsed.value,
        rrule: null,
        member_id: user.memberId,
        workspace_id: Number(workspace_id),
      });

      if (file_ids && Array.isArray(file_ids) && file_ids.length > 0) {
        for (const fileId of file_ids) {
          await attachFileToTask(taskId, fileId, user.memberId);
        }
      }

      await enqueueTaskReminderEvent({
        action: "upsert",
        taskId,
        workspaceId: Number(workspace_id),
        title: title,
        color: color || "#3B82F6",
        startTime: start_time,
        reminderMinutes: reminderParsed.value,
      });

      return NextResponse.json({ success: true, taskId }, { status: 201 });
    }

    const recurrenceStart = parseLocalDateFromString(String(recurrenceInput?.start_date ?? ""));
    const recurrenceEnd = parseLocalDateFromString(String(recurrenceInput?.end_date ?? ""));
    const weekdays = Array.from(
      new Set(
        (recurrenceInput?.weekdays ?? [])
          .map((day) => Number(day))
          .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
      ),
    ).sort((a, b) => a - b);

    if (!recurrenceStart || !recurrenceEnd || recurrenceStart > recurrenceEnd) {
      return NextResponse.json(
        { error: "recurrence start_date/end_date is invalid" },
        { status: 400 },
      );
    }
    if (weekdays.length === 0) {
      return NextResponse.json(
        { error: "recurrence weekdays must include at least one day" },
        { status: 400 },
      );
    }

    const sourceStart = new Date(start_time);
    const sourceEnd = new Date(end_time);
    if (
      Number.isNaN(sourceStart.getTime()) ||
      Number.isNaN(sourceEnd.getTime()) ||
      sourceStart >= sourceEnd
    ) {
      return NextResponse.json(
        { error: "Invalid start_time or end_time" },
        { status: 400 },
      );
    }

    if (reminderParsed.value !== null) {
      const nextRecurringTriggerUnix = findNextRecurringReminderTriggerUnix({
        nowUnix,
        recurrenceStartDate: String(recurrenceInput?.start_date),
        recurrenceEndDate: String(recurrenceInput?.end_date),
        weekdays,
        startTimeTemplate: start_time,
        reminderMinutes: reminderParsed.value,
      });
      if (nextRecurringTriggerUnix === null) {
        return NextResponse.json(
          { error: "No future reminder occurrence found in recurrence range" },
          { status: 400 },
        );
      }
    }

    const taskId = await createTask({
      title,
      start_time,
      end_time,
      content,
      status: status || "TODO",
      color: color || "#3B82F6",
      category_id: category_id ?? null,
      tag_ids: tag_ids || [],
      reminder_minutes: reminderParsed.value,
      rrule: JSON.stringify({
        type: "WEEKLY_RANGE",
        start_date: recurrenceInput?.start_date,
        end_date: recurrenceInput?.end_date,
        weekdays,
      }),
      member_id: user.memberId,
      workspace_id: Number(workspace_id),
    });

    await upsertTaskRecurrence(taskId, {
      start_date: String(recurrenceInput?.start_date),
      end_date: String(recurrenceInput?.end_date),
      weekdays,
    });

    if (file_ids && Array.isArray(file_ids) && file_ids.length > 0) {
      for (const fileId of file_ids) {
        await attachFileToTask(taskId, fileId, user.memberId);
      }
    }

    await enqueueTaskReminderEvent({
      action: "upsert",
      taskId,
      workspaceId: Number(workspace_id),
      title: title,
      color: color || "#3B82F6",
      startTime: start_time,
      reminderMinutes: reminderParsed.value,
    });

    return NextResponse.json(
      {
        success: true,
        taskId,
        createdCount: 1,
        recurring: true,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create task:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 },
    );
  }
}

// PATCH /api/tasks - 태스크 수정
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const body = await request.json();
    const {
      task_id,
      title,
      start_time,
      end_time,
      content,
      status,
      color,
      category_id,
      tag_ids,
      reminder_minutes,
      recurrence,
    } = body;

    if (!task_id) {
      return NextResponse.json(
        { error: "task_id is required" },
        { status: 400 },
      );
    }

    const access = await requireTaskAccess(request, Number(task_id));
    if (access instanceof NextResponse) return access;
    const { task } = access;

    const workspace = await getWorkspaceById(task.workspace_id);
    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );
    }

    if (category_id !== undefined && category_id !== null) {
      const category = await getCategoryById(Number(category_id));
      if (!category) {
        return NextResponse.json({ error: "Category not found" }, { status: 404 });
      }
      if (
        category.owner_type !== workspace.type ||
        Number(category.owner_id) !== Number(workspace.owner_id)
      ) {
        return NextResponse.json(
          { error: "Category does not belong to this workspace owner" },
          { status: 400 },
        );
      }
    }

    if (workspace.type === "team") {
      const team = await getTeamById(workspace.owner_id);
      if (!team) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 });
      }

      if (team.created_by !== user.memberId) {
        const permissions = await getPermissionsByMember(
          team.id,
          user.memberId,
        );
        const canEditAll = permissions.includes("TASK_EDIT_ALL");
        const canEditOwn = permissions.includes("TASK_EDIT_OWN");

        if (
          !(canEditAll || (canEditOwn && task.created_by === user.memberId))
        ) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    const hasReminderMinutes = Object.prototype.hasOwnProperty.call(
      body,
      "reminder_minutes",
    );
    const reminderParsed = hasReminderMinutes
      ? parseReminderMinutes(reminder_minutes)
      : { valid: true, value: null };
    if (!reminderParsed.valid) {
      return NextResponse.json(
        { error: "reminder_minutes must be an integer between 0 and 10080" },
        { status: 400 },
      );
    }
    const hasRrule = Object.prototype.hasOwnProperty.call(body, "rrule");
    const hasRecurrence = Object.prototype.hasOwnProperty.call(body, "recurrence");

    let recurrencePatch:
      | { enabled: false }
      | { enabled: true; start_date: string; end_date: string; weekdays: number[] }
      | null = null;
    if (hasRecurrence) {
      const recurrenceInput: RecurrenceInput | null =
        recurrence && typeof recurrence === "object" ? (recurrence as RecurrenceInput) : null;
      const shouldUpsertRecurrence = Boolean(
        recurrenceInput?.enabled &&
          recurrenceInput?.start_date &&
          recurrenceInput?.end_date &&
          Array.isArray(recurrenceInput?.weekdays) &&
          recurrenceInput.weekdays.length > 0,
      );

      if (!shouldUpsertRecurrence) {
        recurrencePatch = { enabled: false };
      } else {
        const recurrenceStart = parseLocalDateFromString(String(recurrenceInput?.start_date ?? ""));
        const recurrenceEnd = parseLocalDateFromString(String(recurrenceInput?.end_date ?? ""));
        const weekdays = Array.from(
          new Set(
            (recurrenceInput?.weekdays ?? [])
              .map((day) => Number(day))
              .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
          ),
        ).sort((a, b) => a - b);

        if (!recurrenceStart || !recurrenceEnd || recurrenceStart > recurrenceEnd) {
          return NextResponse.json(
            { error: "recurrence start_date/end_date is invalid" },
            { status: 400 },
          );
        }
        if (weekdays.length === 0) {
          return NextResponse.json(
            { error: "recurrence weekdays must include at least one day" },
            { status: 400 },
          );
        }
        recurrencePatch = {
          enabled: true,
          start_date: String(recurrenceInput?.start_date),
          end_date: String(recurrenceInput?.end_date),
          weekdays,
        };
      }
    }

    const touchesReminderSchedule =
      hasReminderMinutes ||
      typeof start_time === "string" ||
      hasRecurrence;
    if (touchesReminderSchedule) {
      const nowUnix = Math.floor(Date.now() / 1000);
      const effectiveReminderMinutes = hasReminderMinutes
        ? reminderParsed.value
        : task.reminder_minutes ?? null;

      if (effectiveReminderMinutes !== null) {
        const effectiveStartTime = typeof start_time === "string" && start_time
          ? start_time
          : task.start_time;

        const effectiveRecurrence =
          recurrencePatch !== null
            ? recurrencePatch.enabled
              ? recurrencePatch
              : null
            : task.recurrence ?? null;

        if (!effectiveRecurrence) {
          const triggerUnix = computeReminderTriggerUnix({
            startTime: effectiveStartTime,
            reminderMinutes: effectiveReminderMinutes,
          });
          if (triggerUnix === null) {
            return NextResponse.json(
              { error: "Invalid start_time for reminder calculation" },
              { status: 400 },
            );
          }
          if (triggerUnix <= nowUnix) {
            return NextResponse.json(
              { error: "Reminder time must be in the future" },
              { status: 400 },
            );
          }
        } else {
          const nextRecurringTriggerUnix = findNextRecurringReminderTriggerUnix({
            nowUnix,
            recurrenceStartDate: effectiveRecurrence.start_date,
            recurrenceEndDate: effectiveRecurrence.end_date,
            weekdays: effectiveRecurrence.weekdays,
            startTimeTemplate: effectiveStartTime,
            reminderMinutes: effectiveReminderMinutes,
          });
          if (nextRecurringTriggerUnix === null) {
            return NextResponse.json(
              { error: "No future reminder occurrence found in recurrence range" },
              { status: 400 },
            );
          }
        }
      }
    }

    await updateTask(
      Number(task_id),
      {
        title,
        start_time,
        end_time,
        content,
        status,
        color,
        category_id,
        tag_ids,
        reminder_minutes: hasReminderMinutes ? reminderParsed.value : undefined,
        rrule: hasRrule ? null : undefined,
      },
      user.memberId,
    );

    if (recurrencePatch) {
      if (!recurrencePatch.enabled) {
        await deleteTaskRecurrence(Number(task_id));
      } else {
        await upsertTaskRecurrence(Number(task_id), {
          start_date: recurrencePatch.start_date,
          end_date: recurrencePatch.end_date,
          weekdays: recurrencePatch.weekdays,
        });
      }
    }

    const updatedTask = await getTaskById(Number(task_id));
    if (updatedTask) {
      await enqueueTaskReminderEvent({
        action: "upsert",
        taskId: updatedTask.id,
        workspaceId: updatedTask.workspace_id,
        title: updatedTask.title,
        color: updatedTask.color ?? null,
        startTime: updatedTask.start_time,
        reminderMinutes: updatedTask.reminder_minutes ?? null,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update task:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 },
    );
  }
}

// DELETE /api/tasks - 태스크 삭제
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get("task_id");
    const taskIdsRaw = searchParams.get("task_ids");

    if (!taskId && !taskIdsRaw) {
      return NextResponse.json(
        { error: "task_id or task_ids is required" },
        { status: 400 },
      );
    }

    const targetIds = taskIdsRaw
      ? Array.from(
          new Set(
            taskIdsRaw
              .split(",")
              .map((value) => Number(value.trim()))
              .filter((value) => Number.isFinite(value) && value > 0),
          ),
        )
      : [Number(taskId)];

    if (targetIds.length === 0) {
      return NextResponse.json(
        { error: "No valid task IDs provided" },
        { status: 400 },
      );
    }

    const deletableTasks: Array<{ id: number; workspace_id: number }> = [];

    for (const targetId of targetIds) {
      const access = await requireTaskAccess(request, targetId);
      if (access instanceof NextResponse) return access;
      const { task } = access;

      const workspace = await getWorkspaceById(task.workspace_id);
      if (!workspace) {
        return NextResponse.json(
          { error: "Workspace not found" },
          { status: 404 },
        );
      }

      if (workspace.type === "team") {
        const team = await getTeamById(workspace.owner_id);
        if (!team) {
          return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }

        if (team.created_by !== user.memberId) {
          const permissions = await getPermissionsByMember(
            team.id,
            user.memberId,
          );
          const canDeleteAll = permissions.includes("TASK_DELETE_ALL");
          const canDeleteOwn = permissions.includes("TASK_DELETE_OWN");

          if (
            !(canDeleteAll || (canDeleteOwn && task.created_by === user.memberId))
          ) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
          }
        }
      }

      deletableTasks.push({ id: targetId, workspace_id: task.workspace_id });
    }

    for (const task of deletableTasks) {
      await deleteTask(task.id);
      await enqueueTaskReminderEvent({
        action: "delete",
        taskId: task.id,
        workspaceId: task.workspace_id,
      });
    }

    return NextResponse.json({ success: true, deletedCount: deletableTasks.length });
  } catch (error) {
    console.error("Failed to delete task:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 },
    );
  }
}
