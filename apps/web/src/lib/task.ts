import pool from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

/**
 * datetime-local 또는 ISO 8601 string을 MySQL datetime 형식으로 변환
 *
 * 입력 형식:
 * - datetime-local: "2026-02-09T18:26" (16자) 또는 "2026-02-09T18:26:00" (19자)
 * - MySQL datetime: "2026-02-09 18:26:00"
 * - ISO 8601: "2026-02-09T09:26:00.000Z" (Z 또는 +00:00 타임존 포함)
 *
 * 출력: "2026-02-09 18:26:00" (MySQL datetime 형식)
 *
 * 중요: 타임존 변환 없이 문자열에서 직접 파싱하여 사용자가 선택한 시간 그대로 저장
 */
function toMySQLDatetime(dateTimeString: string): string {
  if (!dateTimeString) return dateTimeString;

  // 이미 MySQL datetime 형식인 경우 ("YYYY-MM-DD HH:mm:ss")
  const mysqlMatch = dateTimeString.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (mysqlMatch) {
    return dateTimeString;
  }

  // datetime-local 또는 ISO 8601 형식 파싱 (타임존 정보 무시하고 시간값만 추출)
  // "2026-02-09T18:26" (16자)
  // "2026-02-09T18:26:00" (19자)
  // "2026-02-09T18:26:00.000Z" (24자)
  // "2026-02-09T18:26:00+09:00" (25자)
  const match = dateTimeString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const [, year, month, day, hours, minutes, seconds = '00'] = match;
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  // 그 외 형식은 그대로 반환
  return dateTimeString;
}

export interface Task {
  id: number;
  title: string;
  start_time: string;  // MySQL datetime string: "2026-02-09 18:26:00"
  end_time: string;    // MySQL datetime string: "2026-02-09 18:26:00"
  content: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  color?: string;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  workspace_id: number;
  tags?: Array<{ tag_id: number; name: string; color: string }>;
}

export async function getTaskById(taskId: number): Promise<Task | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM tasks WHERE id = ? LIMIT 1`,
    [taskId]
  );
  return rows.length > 0 ? (rows[0] as Task) : null;
}

export async function getTaskByIdWithNames(taskId: number): Promise<Task | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      t.*,
      creator.nickname as created_by_name,
      updater.nickname as updated_by_name
     FROM tasks t
     LEFT JOIN members creator ON t.created_by = creator.member_id
     LEFT JOIN members updater ON t.updated_by = updater.member_id
     WHERE t.id = ?
     LIMIT 1`,
    [taskId]
  );

  return rows.length > 0 ? (rows[0] as Task) : null;
}

export interface CreateTaskData {
  title: string;
  start_time: string;
  end_time: string;
  content?: string;
  status?: "TODO" | "IN_PROGRESS" | "DONE";
  color?: string;
  member_id: number;
  workspace_id: number;
  tag_ids?: number[];
}

/**
 * 새 태스크 생성 (워크스페이스 기반)
 */
export async function createTask(data: CreateTaskData): Promise<number> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO tasks (title, start_time, end_time, content, status, color, created_at, updated_at, created_by, updated_by, workspace_id)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?)`,
      [
        data.title,
        toMySQLDatetime(data.start_time),
        toMySQLDatetime(data.end_time),
        data.content || null,
        data.status || "TODO",
        data.color || "#3B82F6",
        data.member_id,
        data.member_id,
        data.workspace_id
      ]
    );

    const taskId = result.insertId;

    // 태그 추가
    if (data.tag_ids && data.tag_ids.length > 0) {
      const now = new Date();
      const tagValues = data.tag_ids.map(tagId => [taskId, tagId, now]);
      await connection.query(
        `INSERT INTO task_tags (task_id, tag_id, created_at) VALUES ?`,
        [tagValues]
      );
    }

    await connection.commit();
    return taskId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 워크스페이스의 태스크 목록 조회
 */
export async function getTasksByWorkspaceId(workspaceId: number): Promise<Task[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM tasks
     WHERE workspace_id = ?
     ORDER BY start_time DESC`,
    [workspaceId]
  );
  return rows as Task[];
}

export interface PaginatedTasksResult {
  tasks: Task[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ALLOWED_SORT_COLUMNS = ["start_time", "end_time", "created_at", "updated_at", "title", "status"] as const;
type SortColumn = typeof ALLOWED_SORT_COLUMNS[number];

/**
 * 워크스페이스의 태스크 목록 조회 (페이징/정렬/필터)
 */
export async function getTasksByWorkspaceIdPaginated(
  workspaceId: number,
  options: {
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: "ASC" | "DESC";
    status?: string;
    search?: string;
  } = {}
): Promise<PaginatedTasksResult> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;
  const sortOrder = options.sort_order === "ASC" ? "ASC" : "DESC";
  const sortBy: SortColumn = ALLOWED_SORT_COLUMNS.includes(options.sort_by as SortColumn)
    ? (options.sort_by as SortColumn)
    : "start_time";

  const conditions: string[] = ["t.workspace_id = ?"];
  const params: any[] = [workspaceId];

  if (options.status && ["TODO", "IN_PROGRESS", "DONE"].includes(options.status)) {
    conditions.push("t.status = ?");
    params.push(options.status);
  }

  if (options.search) {
    conditions.push("(t.title LIKE ? OR t.content LIKE ?)");
    const searchTerm = `%${options.search}%`;
    params.push(searchTerm, searchTerm);
  }

  const whereClause = conditions.join(" AND ");

  // 전체 개수 조회
  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT t.id) as total FROM tasks t WHERE ${whereClause}`,
    params
  );
  const total = countRows[0].total;

  // 데이터 조회 (태그 포함)
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      t.*,
      creator.nickname as created_by_name,
      updater.nickname as updated_by_name,
      tg.tag_id,
      tags.name as tag_name,
      tags.color as tag_color
     FROM tasks t
     LEFT JOIN members creator ON t.created_by = creator.member_id
     LEFT JOIN members updater ON t.updated_by = updater.member_id
     LEFT JOIN task_tags tg ON t.id = tg.task_id
     LEFT JOIN tags ON tg.tag_id = tags.tag_id
     WHERE ${whereClause} 
     ORDER BY t.${sortBy} ${sortOrder}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // 태스크별로 그룹화하여 태그 배열 생성
  const tasksMap = new Map<number, Task>();

  rows.forEach((row: any) => {
    if (!tasksMap.has(row.id)) {
      tasksMap.set(row.id, {
        id: row.id,
        title: row.title,
        start_time: row.start_time,
        end_time: row.end_time,
        content: row.content,
        status: row.status,
        color: row.color,
        created_at: row.created_at,
        updated_at: row.updated_at,
        created_by: row.created_by,
        updated_by: row.updated_by,
        created_by_name: row.created_by_name || null,
        updated_by_name: row.updated_by_name || null,
        workspace_id: row.workspace_id,
        tags: []
      });
    }

    // 태그가 있으면 추가
    if (row.tag_id) {
      tasksMap.get(row.id)!.tags!.push({
        tag_id: row.tag_id,
        name: row.tag_name,
        color: row.tag_color
      });
    }
  });

  const tasks = Array.from(tasksMap.values());

  return {
    tasks,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * 태스크 수정
 */
export async function updateTask(
  taskId: number,
  data: {
    title?: string;
    start_time?: string;
    end_time?: string;
    content?: string;
    status?: "TODO" | "IN_PROGRESS" | "DONE";
    color?: string;
    tag_ids?: number[];
  },
  memberId: number
): Promise<void> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const updates: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      values.push(data.title);
    }
    if (data.start_time) {
      updates.push('start_time = ?');
      values.push(toMySQLDatetime(data.start_time));
    }
    if (data.end_time) {
      updates.push('end_time = ?');
      values.push(toMySQLDatetime(data.end_time));
    }
    if (data.content !== undefined) {
      updates.push('content = ?');
      values.push(data.content);
    }
    if (data.status) {
      updates.push('status = ?');
      values.push(data.status);
    }
    if (data.color !== undefined) {
      updates.push('color = ?');
      values.push(data.color);
    }

    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      updates.push('updated_by = ?');
      values.push(memberId, taskId);

      await connection.query(
        `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    // 태그 업데이트
    if (data.tag_ids !== undefined) {
      // 기존 태그 삭제
      await connection.query('DELETE FROM task_tags WHERE task_id = ?', [taskId]);

      // 새 태그 추가
      if (data.tag_ids.length > 0) {
        const now = new Date();
        const tagValues = data.tag_ids.map(tagId => [taskId, tagId, now]);
        await connection.query(
          `INSERT INTO task_tags (task_id, tag_id, created_at) VALUES ?`,
          [tagValues]
        );
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 태스크 삭제
 */
export async function deleteTask(taskId: number): Promise<void> {
  await pool.query(`DELETE FROM tasks WHERE id = ?`, [taskId]);
}

/**
 * 특정 월의 날짜별 태스크 개수 조회 (워크스페이스 기반)
 */
export async function getTaskCountsByMonth(
  workspaceId: number,
  year: number,
  month: number
): Promise<{ date: string; count: number }[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT dates.date, COUNT(t.id) as count
     FROM (
       SELECT DATE_ADD(?, INTERVAL seq DAY) as date
       FROM (
         SELECT 0 as seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL 
         SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL 
         SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL 
         SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15 UNION ALL 
         SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL 
         SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL 
         SELECT 24 UNION ALL SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL 
         SELECT 28 UNION ALL SELECT 29 UNION ALL SELECT 30
       ) as seq_table
       WHERE DATE_ADD(?, INTERVAL seq DAY) <= ?
     ) as dates
     LEFT JOIN tasks t ON DATE(dates.date) BETWEEN DATE(t.start_time) AND DATE(t.end_time)
       AND t.workspace_id = ?
     WHERE dates.date BETWEEN ? AND ?
     GROUP BY dates.date
     HAVING count > 0
     ORDER BY dates.date`,
    [startDate, startDate, endDate, workspaceId, startDate, endDate]
  );

  return rows.map(row => ({
    date: row.date,
    count: Number(row.count)
  }));
}

/**
 * 특정 날짜의 태스크 목록 조회 (워크스페이스 기반)
 * @param workspaceId - 워크스페이스 ID
 * @param date - 조회할 날짜 (YYYY-MM-DD)
 */
export async function getTasksByDate(
  workspaceId: number,
  date: string
): Promise<Task[]> {
  // start_time is stored as user's local time, so we can query by date directly
  const dateStart = `${date} 00:00:00`;
  const dateEnd = `${date} 23:59:59`;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      t.*,
      creator.nickname as created_by_name,
      updater.nickname as updated_by_name,
      tg.tag_id,
      tags.name as tag_name,
      tags.color as tag_color
     FROM tasks t
     LEFT JOIN members creator ON t.created_by = creator.member_id
     LEFT JOIN members updater ON t.updated_by = updater.member_id
     LEFT JOIN task_tags tg ON t.id = tg.task_id
     LEFT JOIN tags ON tg.tag_id = tags.tag_id
     WHERE t.workspace_id = ?
       AND t.start_time >= ?
       AND t.start_time <= ?
     ORDER BY t.start_time ASC`,
    [workspaceId, dateStart, dateEnd]
  );

  // 태스크별로 그룹화하여 태그 배열 생성
  const tasksMap = new Map<number, Task>();

  rows.forEach((row: any) => {
    if (!tasksMap.has(row.id)) {
      tasksMap.set(row.id, {
        id: row.id,
        title: row.title,
        start_time: row.start_time,
        end_time: row.end_time,
        content: row.content,
        status: row.status,
        color: row.color,
        created_at: row.created_at,
        updated_at: row.updated_at,
        created_by: row.created_by,
        updated_by: row.updated_by,
        created_by_name: row.created_by_name || null,
        updated_by_name: row.updated_by_name || null,
        workspace_id: row.workspace_id,
        tags: []
      });
    }

    // 태그가 있으면 추가
    if (row.tag_id) {
      tasksMap.get(row.id)!.tags!.push({
        tag_id: row.tag_id,
        name: row.tag_name,
        color: row.tag_color
      });
    }
  });

  return Array.from(tasksMap.values());
}

/**
 * 특정 월의 날짜별 태스크 목록 조회 (워크스페이스 기반) - 제목 포함
 * @param workspaceId - 워크스페이스 ID
 * @param year - 연도
 * @param month - 월 (1-12)
 * @param timezoneOffsetMinutes - 사용자 타임존 오프셋 (분 단위, UTC 기준)
 */
export async function getTasksWithTitlesByMonth(
  workspaceId: number,
  year: number,
  month: number
): Promise<{ date: string; tasks: { id: number; title: string; start_time: string; end_time: string; color: string | null }[] }[]> {
  // start_time is stored as user's local time, so we can query by date directly
  const lastDay = new Date(year, month, 0).getDate();
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`;
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')} 23:59:59`;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       t.id,
       t.title,
       t.color,
       t.start_time,
       t.end_time
     FROM tasks t
     WHERE t.workspace_id = ?
       AND t.start_time >= ?
       AND t.start_time <= ?
     ORDER BY t.start_time ASC`,
    [workspaceId, monthStart, monthEnd]
  );

  // Group by date (start_time is already stored as user's local time)
  const grouped = rows.reduce((acc: any, row: any) => {
    // start_time is "YYYY-MM-DD HH:mm:ss" format - extract date part
    const dateStr = row.start_time.split(' ')[0];

    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push({
      id: row.id,
      title: row.title,
      color: row.color || null,
      start_time: row.start_time,
      end_time: row.end_time
    });
    return acc;
  }, {});

  return Object.entries(grouped).map(([date, tasks]) => ({
    date,
    tasks: tasks as { id: number; title: string; start_time: string; end_time: string; color: string | null }[]
  }));
}

/**
 * 워크스페이스의 이번 달 태스크 통계 조회
 */
export async function getTaskStatsByWorkspace(
  workspaceId: number
): Promise<{
  tasksCreated: number;
  tasksCompleted: number;
  tasksTodo: number;
  tasksInProgress: number;
}> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')} 23:59:59`;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      COUNT(*) as tasksCreated,
      SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) as tasksCompleted,
      SUM(CASE WHEN status = 'TODO' THEN 1 ELSE 0 END) as tasksTodo,
      SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as tasksInProgress
     FROM tasks
     WHERE workspace_id = ?
       AND created_at >= ?
       AND created_at <= ?`,
    [workspaceId, monthStart, monthEnd]
  );

  return {
    tasksCreated: Number(rows[0]?.tasksCreated || 0),
    tasksCompleted: Number(rows[0]?.tasksCompleted || 0),
    tasksTodo: Number(rows[0]?.tasksTodo || 0),
    tasksInProgress: Number(rows[0]?.tasksInProgress || 0),
  };
}

/**
 * 워크스페이스의 전체 태스크 수 조회
 */
export async function getTotalTaskCount(workspaceId: number): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM tasks WHERE workspace_id = ?`,
    [workspaceId]
  );
  return Number(rows[0]?.total || 0);
}
