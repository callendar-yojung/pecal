import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import pool from "./db";
import { createCacheKey, deleteCacheKey, readThroughCache } from "./redis-cache";

export interface Category {
  category_id: number;
  name: string;
  color: string;
  owner_type: "team" | "personal";
  owner_id: number;
  created_at: Date;
  created_by: number;
}

export interface CreateCategoryData {
  name: string;
  color?: string;
  owner_type: "team" | "personal";
  owner_id: number;
  member_id: number;
}

const CATEGORY_LIST_TTL_SECONDS = Number(
  process.env.REDIS_CATEGORY_LIST_TTL_SEC ?? 120,
);

function categoriesByOwnerCacheKey(
  ownerType: "team" | "personal",
  ownerId: number,
) {
  return createCacheKey("categories", "owner", ownerType, ownerId);
}

async function getCategoryOwnerById(
  categoryId: number,
): Promise<{ owner_type: "team" | "personal"; owner_id: number } | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT owner_type, owner_id FROM categories WHERE category_id = ? LIMIT 1`,
    [categoryId],
  );
  if (rows.length === 0) return null;
  return {
    owner_type: rows[0].owner_type,
    owner_id: Number(rows[0].owner_id),
  };
}

export async function getCategoryById(categoryId: number): Promise<Category | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM categories WHERE category_id = ? LIMIT 1`,
    [categoryId],
  );
  if (rows.length === 0) return null;
  return rows[0] as Category;
}

export async function createCategory(data: CreateCategoryData): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO categories (name, color, owner_type, owner_id, created_at, created_by)
     VALUES (?, ?, ?, ?, NOW(), ?)`,
    [
      data.name,
      data.color || "#3B82F6",
      data.owner_type,
      data.owner_id,
      data.member_id,
    ],
  );
  await deleteCacheKey(categoriesByOwnerCacheKey(data.owner_type, data.owner_id));
  return result.insertId;
}

export async function getCategoriesByOwner(
  ownerType: "team" | "personal",
  ownerId: number,
): Promise<Category[]> {
  return readThroughCache<Category[]>(
    categoriesByOwnerCacheKey(ownerType, ownerId),
    CATEGORY_LIST_TTL_SECONDS,
    async () => {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM categories
         WHERE owner_type = ? AND owner_id = ?
         ORDER BY name ASC`,
        [ownerType, ownerId],
      );
      return rows as Category[];
    },
  );
}

export async function updateCategory(
  categoryId: number,
  data: { name?: string; color?: string },
): Promise<void> {
  const owner = await getCategoryOwnerById(categoryId);
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

  values.push(categoryId);
  await pool.query(
    `UPDATE categories SET ${updates.join(", ")} WHERE category_id = ?`,
    values,
  );

  if (owner) {
    await deleteCacheKey(
      categoriesByOwnerCacheKey(owner.owner_type, owner.owner_id),
    );
  }
}

export async function deleteCategory(categoryId: number): Promise<void> {
  const owner = await getCategoryOwnerById(categoryId);
  await pool.query(`DELETE FROM categories WHERE category_id = ?`, [categoryId]);
  if (owner) {
    await deleteCacheKey(
      categoriesByOwnerCacheKey(owner.owner_type, owner.owner_id),
    );
  }
}
