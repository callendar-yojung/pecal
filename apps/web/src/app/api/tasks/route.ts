import { type NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  requireTaskAccess,
  requireWorkspaceAccess,
} from "@/lib/access";
import {
  createTask,
  deleteTask,
  getTaskById,
  getTasksByWorkspaceIdPaginated,
  updateTask,
} from "@/lib/task";
import { attachFileToTask } from "@/lib/task-attachment";
import { enqueueTaskReminderEvent } from "@/lib/task-reminder-stream";
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

function extractTimePart(value: string): string {
  const m = value.match(/[T ](\d{2}:\d{2})(?::(\d{2}))?/);
  if (!m) return "09:00:00";
  return `${m[1]}:${m[2] ?? "00"}`;
}

function formatLocalDateTime(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
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
    if (Number.isNaN(sourceStart.getTime()) || Number.isNaN(sourceEnd.getTime())) {
      return NextResponse.json(
        { error: "Invalid start_time or end_time" },
        { status: 400 },
      );
    }
    const durationMs = sourceEnd.getTime() - sourceStart.getTime();
    if (durationMs <= 0) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 },
      );
    }

    const startTimePart = extractTimePart(start_time);
    const maxOccurrences = 730;
    const occurrenceDates: Date[] = [];
    for (
      let cursor = new Date(recurrenceStart);
      cursor <= recurrenceEnd;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      if (!weekdays.includes(cursor.getDay())) continue;
      occurrenceDates.push(new Date(cursor));
      if (occurrenceDates.length > maxOccurrences) {
        return NextResponse.json(
          { error: `Too many recurrence occurrences (max ${maxOccurrences})` },
          { status: 400 },
        );
      }
    }

    if (occurrenceDates.length === 0) {
      return NextResponse.json(
        { error: "No dates matched recurrence settings" },
        { status: 400 },
      );
    }

    const createdTaskIds: number[] = [];
    for (const day of occurrenceDates) {
      const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      const occurrenceStart = new Date(`${dateKey}T${startTimePart}`);
      const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
      const occurrenceStartText = formatLocalDateTime(occurrenceStart);
      const occurrenceEndText = formatLocalDateTime(occurrenceEnd);

      const createdTaskId = await createTask({
        title,
        start_time: occurrenceStartText,
        end_time: occurrenceEndText,
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
      createdTaskIds.push(createdTaskId);

      await enqueueTaskReminderEvent({
        action: "upsert",
        taskId: createdTaskId,
        workspaceId: Number(workspace_id),
        title: title,
        color: color || "#3B82F6",
        startTime: occurrenceStartText,
        reminderMinutes: reminderParsed.value,
      });
    }

    return NextResponse.json(
      {
        success: true,
        taskId: createdTaskIds[0],
        taskIds: createdTaskIds,
        createdCount: createdTaskIds.length,
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

    if (!taskId) {
      return NextResponse.json(
        { error: "task_id is required" },
        { status: 400 },
      );
    }

    const access = await requireTaskAccess(request, Number(taskId));
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

    await deleteTask(Number(taskId));
    await enqueueTaskReminderEvent({
      action: "delete",
      taskId: Number(taskId),
      workspaceId: task.workspace_id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete task:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 },
    );
  }
}
