import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import pool from "./db";
import { createCacheKey, deleteCacheKey, readThroughCache } from "./redis-cache";

export interface Tag {
  tag_id: number;
  name: string;
  color: string;
  owner_type: "team" | "personal";
  owner_id: number;
  created_at: Date;
  created_by: number;
}

export interface CreateTagData {
  name: string;
  color?: string;
  owner_type: "team" | "personal";
  owner_id: number;
  member_id: number;
}

const TAG_LIST_TTL_SECONDS = Number(process.env.REDIS_TAG_LIST_TTL_SEC ?? 120);

function tagsByOwnerCacheKey(ownerType: "team" | "personal", ownerId: number) {
  return createCacheKey("tags", "owner", ownerType, ownerId);
}

async function getTagOwnerById(
  tagId: number,
): Promise<{ owner_type: "team" | "personal"; owner_id: number } | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT owner_type, owner_id FROM tags WHERE tag_id = ? LIMIT 1`,
    [tagId],
  );
  if (rows.length === 0) return null;
  return {
    owner_type: rows[0].owner_type,
    owner_id: Number(rows[0].owner_id),
  };
}

/**
 * 태그 생성
 */
export async function createTag(data: CreateTagData): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO tags (name, color, owner_type, owner_id, created_at, created_by)
     VALUES (?, ?, ?, ?, NOW(), ?)`,
    [
      data.name,
      data.color || "#3B82F6",
      data.owner_type,
      data.owner_id,
      data.member_id,
    ],
  );

  await deleteCacheKey(tagsByOwnerCacheKey(data.owner_type, data.owner_id));
  return result.insertId;
}

/**
 * 팀 또는 개인의 태그 목록 조회
 */
export async function getTagsByOwner(
  ownerType: "team" | "personal",
  ownerId: number,
): Promise<Tag[]> {
  return readThroughCache<Tag[]>(
    tagsByOwnerCacheKey(ownerType, ownerId),
    TAG_LIST_TTL_SECONDS,
    async () => {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM tags
         WHERE owner_type = ? AND owner_id = ?
         ORDER BY name ASC`,
        [ownerType, ownerId],
      );
      return rows as Tag[];
    },
  );
}

/**
 * 태그 수정
 */
export async function updateTag(
  tagId: number,
  data: { name?: string; color?: string },
): Promise<void> {
  const owner = await getTagOwnerById(tagId);
  const updates: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) {
    updates.push("name = ?");
    values.push(data.name);
  }
  if (data.color !== undefined) {
    updates.push("color = ?");
    values.push(data.color);
  }

  if (updates.length === 0) return;

  values.push(tagId);

  await pool.query(
    `UPDATE tags SET ${updates.join(", ")} WHERE tag_id = ?`,
    values,
  );

  if (owner) {
    await deleteCacheKey(tagsByOwnerCacheKey(owner.owner_type, owner.owner_id));
  }
}

/**
 * 태그 삭제
 */
export async function deleteTag(tagId: number): Promise<void> {
  const owner = await getTagOwnerById(tagId);
  await pool.query("DELETE FROM tags WHERE tag_id = ?", [tagId]);
  if (owner) {
    await deleteCacheKey(tagsByOwnerCacheKey(owner.owner_type, owner.owner_id));
  }
}

/**
 * 태스크에 태그 추가
 */
export async function addTagToTask(
  taskId: number,
  tagId: number,
): Promise<void> {
  await pool.query(
    `INSERT IGNORE INTO task_tags (task_id, tag_id, created_at)
     VALUES (?, ?, NOW())`,
    [taskId, tagId],
  );
}

/**
 * 태스크에서 태그 제거
 */
export async function removeTagFromTask(
  taskId: number,
  tagId: number,
): Promise<void> {
  await pool.query("DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?", [
    taskId,
    tagId,
  ]);
}

/**
 * 태스크의 모든 태그 제거
 */
export async function removeAllTagsFromTask(taskId: number): Promise<void> {
  await pool.query("DELETE FROM task_tags WHERE task_id = ?", [taskId]);
}

/**
 * 태스크의 태그 목록 조회
 */
export async function getTaskTags(taskId: number): Promise<Tag[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT t.* FROM tags t
     INNER JOIN task_tags tt ON t.tag_id = tt.tag_id
     WHERE tt.task_id = ?
     ORDER BY t.name ASC`,
    [taskId],
  );
  return rows as Tag[];
}

/**
 * 태스크의 태그 ID 목록 조회
 */
export async function getTaskTagIds(taskId: number): Promise<number[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT tag_id FROM task_tags WHERE task_id = ?`,
    [taskId],
  );
  return rows.map((row) => row.tag_id);
}
