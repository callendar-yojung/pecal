import pool from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export type PaymentStatus = "SUCCESS" | "FAILED" | "REFUNDED";
export type PaymentType = "FIRST" | "RECURRING" | "RETRY";
export type OwnerType = "team" | "personal";

export interface PaymentRecord {
  payment_id: number;
  subscription_id: number;
  owner_id: number;
  owner_type: OwnerType;
  member_id: number;
  plan_id: number;
  amount: number;
  order_id: string;
  tid: string | null;
  bid: string;
  status: PaymentStatus;
  result_code: string | null;
  result_msg: string | null;
  payment_type: PaymentType;
  created_at: Date;
  plan_name?: string;
}

export async function createPaymentRecord(data: {
  subscriptionId: number;
  ownerId: number;
  ownerType: OwnerType;
  memberId: number;
  planId: number;
  amount: number;
  orderId: string;
  tid: string | null;
  bid: string;
  status: PaymentStatus;
  resultCode: string | null;
  resultMsg: string | null;
  paymentType: PaymentType;
}): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO payment_history
      (subscription_id, owner_id, owner_type, member_id, plan_id, amount,
       order_id, tid, bid, status, result_code, result_msg, payment_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      data.subscriptionId,
      data.ownerId,
      data.ownerType,
      data.memberId,
      data.planId,
      data.amount,
      data.orderId,
      data.tid,
      data.bid,
      data.status,
      data.resultCode,
      data.resultMsg,
      data.paymentType,
    ]
  );

  return result.insertId;
}

export async function getPaymentsByOwner(
  ownerId: number,
  ownerType: OwnerType,
  limit = 50,
  offset = 0
): Promise<PaymentRecord[]> {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.trunc(limit))) : 50;
  const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.trunc(offset)) : 0;

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT
       ph.payment_id, ph.subscription_id, ph.owner_id, ph.owner_type,
       ph.member_id, ph.plan_id, ph.amount, ph.order_id, ph.tid, ph.bid,
       ph.status, ph.result_code, ph.result_msg, ph.payment_type, ph.created_at,
       p.name as plan_name
     FROM payment_history ph
     LEFT JOIN plans p ON ph.plan_id = p.plan_id
     WHERE ph.owner_id = ? AND ph.owner_type = ?
     ORDER BY ph.created_at DESC
     LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    [ownerId, ownerType]
  );

  return rows as PaymentRecord[];
}

export async function getPaymentsBySubscription(
  subscriptionId: number
): Promise<PaymentRecord[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT
       ph.payment_id, ph.subscription_id, ph.owner_id, ph.owner_type,
       ph.member_id, ph.plan_id, ph.amount, ph.order_id, ph.tid, ph.bid,
       ph.status, ph.result_code, ph.result_msg, ph.payment_type, ph.created_at,
       p.name as plan_name
     FROM payment_history ph
     LEFT JOIN plans p ON ph.plan_id = p.plan_id
     WHERE ph.subscription_id = ?
     ORDER BY ph.created_at DESC`,
    [subscriptionId]
  );

  return rows as PaymentRecord[];
}
