import type { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "./db";
import {
  createCacheKey,
  deleteCacheByPattern,
  deleteCacheKey,
  readThroughCache,
} from "./redis-cache";

export type MemoOwnerType = "personal" | "team";

export interface MemoRecord {
  memo_id: number;
  owner_type: MemoOwnerType;
  owner_id: number;
  member_id: number;
  title: string;
  content_json: string;
  is_favorite: number;
  created_at: Date;
  updated_at: Date;
}

export interface MemoListResult {
  memos: MemoRecord[];
  total: number;
}

const MEMO_LIST_TTL_SECONDS = Number(process.env.REDIS_MEMO_LIST_TTL_SEC ?? 20);
const MEMO_DETAIL_TTL_SECONDS = Number(process.env.REDIS_MEMO_DETAIL_TTL_SEC ?? 20);

function memoListCacheKey(
  ownerType: MemoOwnerType,
  ownerId: number,
  memberId: number,
  query: string,
  sort: "latest" | "oldest" | "favorite",
  favoriteOnly: boolean,
  limit: number,
  offset: number,
) {
  const queryKey = JSON.stringify({
    query,
    sort,
    favoriteOnly,
    limit,
    offset,
  });
  return createCacheKey(
    "memos",
    "list",
    ownerType,
    ownerId,
    "member",
    memberId,
    queryKey,
  );
}

function memoDetailCacheKey(
  memoId: number,
  ownerType: MemoOwnerType,
  ownerId: number,
  memberId: number,
) {
  return createCacheKey("memos", "detail", memoId, ownerType, ownerId, "member", memberId);
}

async function invalidateMemoCache(
  ownerType: MemoOwnerType,
  ownerId: number,
  memberId: number,
  memoId?: number,
) {
  await deleteCacheByPattern(
    createCacheKey("memos", "list", ownerType, ownerId, "member", memberId, "*"),
  );
  if (memoId) {
    await deleteCacheKey(memoDetailCacheKey(memoId, ownerType, ownerId, memberId));
  }
}

export async function getMemoById(
  memoId: number,
  ownerType: MemoOwnerType,
  ownerId: number,
  memberId: number,
): Promise<MemoRecord | null> {
  return readThroughCache<MemoRecord | null>(
    memoDetailCacheKey(memoId, ownerType, ownerId, memberId),
    MEMO_DETAIL_TTL_SECONDS,
    async () => {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT memo_id, owner_type, owner_id, member_id, title, content_json, is_favorite, created_at, updated_at
         FROM memos
         WHERE memo_id = ? AND owner_type = ? AND owner_id = ? AND member_id = ?
         LIMIT 1`,
        [memoId, ownerType, ownerId, memberId],
      );
      return rows.length > 0 ? (rows[0] as MemoRecord) : null;
    },
  );
}

export async function getMemos(
  ownerType: MemoOwnerType,
  ownerId: number,
  memberId: number,
  query: string,
  sort: "latest" | "oldest" | "favorite",
  favoriteOnly: boolean,
  limit: number,
  offset: number,
): Promise<MemoListResult> {
  const conditions: string[] = [
    "owner_type = ?",
    "owner_id = ?",
    "member_id = ?",
  ];
  const params: Array<string | number> = [ownerType, ownerId, memberId];

  if (query) {
    conditions.push("title LIKE ?");
    params.push(`%${query}%`);
  }

  if (favoriteOnly) {
    conditions.push("is_favorite = 1");
  }

  let orderBy = "updated_at DESC";
  if (sort === "oldest") {
    orderBy = "updated_at ASC";
  }
  if (sort === "favorite") {
    orderBy = "is_favorite DESC, updated_at DESC";
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  return readThroughCache<MemoListResult>(
    memoListCacheKey(
      ownerType,
      ownerId,
      memberId,
      query,
      sort,
      favoriteOnly,
      limit,
      offset,
    ),
    MEMO_LIST_TTL_SECONDS,
    async () => {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT memo_id, owner_type, owner_id, member_id, title, content_json, is_favorite, created_at, updated_at
         FROM memos
         ${whereClause}
         ORDER BY ${orderBy}
         LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
        params,
      );

      const [countRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as total
         FROM memos
         ${whereClause}`,
        params,
      );

      return {
        memos: rows as MemoRecord[],
        total: Number(countRows[0]?.total || 0),
      };
    },
  );
}

export async function createMemo(
  ownerType: MemoOwnerType,
  ownerId: number,
  memberId: number,
  title: string,
  contentJson: string,
): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO memos (owner_type, owner_id, member_id, title, content_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [ownerType, ownerId, memberId, title, contentJson],
  );
  await invalidateMemoCache(ownerType, ownerId, memberId);
  return result.insertId;
}

export async function updateMemo(
  memoId: number,
  ownerType: MemoOwnerType,
  ownerId: number,
  memberId: number,
  data: {
    title?: string;
    contentJson?: string;
    isFavorite?: boolean;
  },
): Promise<boolean> {
  const updates: string[] = [];
  const params: Array<string | number> = [];

  if (typeof data.title === "string") {
    updates.push("title = ?");
    params.push(data.title);
  }
  if (typeof data.contentJson === "string") {
    updates.push("content_json = ?");
    params.push(data.contentJson);
  }
  if (typeof data.isFavorite === "boolean") {
    updates.push("is_favorite = ?");
    params.push(data.isFavorite ? 1 : 0);
  }

  if (updates.length === 0) return false;

  params.push(memoId, ownerType, ownerId, memberId);

  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE memos
     SET ${updates.join(", ")}, updated_at = NOW()
     WHERE memo_id = ? AND owner_type = ? AND owner_id = ? AND member_id = ?`,
    params,
  );
  const updated = result.affectedRows > 0;
  if (updated) {
    await invalidateMemoCache(ownerType, ownerId, memberId, memoId);
  }
  return updated;
}

export async function deleteMemo(
  memoId: number,
  ownerType: MemoOwnerType,
  ownerId: number,
  memberId: number,
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `DELETE FROM memos WHERE memo_id = ? AND owner_type = ? AND owner_id = ? AND member_id = ?`,
    [memoId, ownerType, ownerId, memberId],
  );
  const deleted = result.affectedRows > 0;
  if (deleted) {
    await invalidateMemoCache(ownerType, ownerId, memberId, memoId);
  }
  return deleted;
}
