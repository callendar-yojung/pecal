import pool from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export interface BillingKey {
  billing_key_id: number;
  member_id: number;
  bid: string;
  card_code: string;
  card_name: string;
  card_no_masked: string;
  status: "ACTIVE" | "REMOVED";
  created_at: string;
}

export async function saveBillingKey(
  memberId: number,
  bid: string,
  cardCode: string,
  cardName: string,
  cardNoMasked: string
): Promise<number> {
  // 기존 활성 빌키 비활성화
  await pool.execute(
    `UPDATE billing_keys SET status = 'REMOVED' WHERE member_id = ? AND status = 'ACTIVE'`,
    [memberId]
  );

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO billing_keys (member_id, bid, card_code, card_name, card_no_masked, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE', NOW())`,
    [memberId, bid, cardCode, cardName, cardNoMasked]
  );

  return result.insertId;
}

export async function getActiveBillingKey(
  memberId: number
): Promise<BillingKey | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT billing_key_id, member_id, bid, card_code, card_name, card_no_masked, status, created_at
     FROM billing_keys
     WHERE member_id = ? AND status = 'ACTIVE'
     ORDER BY created_at DESC
     LIMIT 1`,
    [memberId]
  );

  return rows.length > 0 ? (rows[0] as BillingKey) : null;
}

export async function removeBillingKeyById(
  billingKeyId: number
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE billing_keys SET status = 'REMOVED' WHERE billing_key_id = ?`,
    [billingKeyId]
  );

  return result.affectedRows > 0;
}

export async function removeBillingKeyByMemberId(
  memberId: number
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE billing_keys SET status = 'REMOVED' WHERE member_id = ? AND status = 'ACTIVE'`,
    [memberId]
  );

  return result.affectedRows > 0;
}
