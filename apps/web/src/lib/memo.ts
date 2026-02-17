import pool from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

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

export async function getMemoById(
  memoId: number,
  ownerType: MemoOwnerType,
  ownerId: number,
  memberId: number
): Promise<MemoRecord | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT memo_id, owner_type, owner_id, member_id, title, content_json, is_favorite, created_at, updated_at
     FROM memos
     WHERE memo_id = ? AND owner_type = ? AND owner_id = ? AND member_id = ?
     LIMIT 1`,
    [memoId, ownerType, ownerId, memberId]
  );
  return rows.length > 0 ? (rows[0] as MemoRecord) : null;
}

export async function getMemos(
  ownerType: MemoOwnerType,
  ownerId: number,
  memberId: number,
  query: string,
  sort: "latest" | "oldest" | "favorite",
  favoriteOnly: boolean,
  limit: number,
  offset: number
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

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT memo_id, owner_type, owner_id, member_id, title, content_json, is_favorite, created_at, updated_at
     FROM memos
     ${whereClause}
     ORDER BY ${orderBy}
     LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    params
  );

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total
     FROM memos
     ${whereClause}`,
    params
  );

  return {
    memos: rows as MemoRecord[],
    total: Number(countRows[0]?.total || 0),
  };
}

export async function createMemo(
  ownerType: MemoOwnerType,
  ownerId: number,
  memberId: number,
  title: string,
  contentJson: string
): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO memos (owner_type, owner_id, member_id, title, content_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [ownerType, ownerId, memberId, title, contentJson]
  );
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
  }
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
    params
  );
  return result.affectedRows > 0;
}

export async function deleteMemo(
  memoId: number,
  ownerType: MemoOwnerType,
  ownerId: number,
  memberId: number
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `DELETE FROM memos WHERE memo_id = ? AND owner_type = ? AND owner_id = ? AND member_id = ?`,
    [memoId, ownerType, ownerId, memberId]
  );
  return result.affectedRows > 0;
}
