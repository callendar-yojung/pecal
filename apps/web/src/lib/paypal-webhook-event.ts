import type { ResultSetHeader } from "mysql2";
import pool from "@/lib/db";

const PROVIDER = "paypal";

export async function claimPayPalWebhookEvent(
  eventId: string,
  eventType: string,
  payload: unknown,
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT IGNORE INTO paypal_webhook_events
      (provider, event_id, event_type, status, payload_json, received_at, attempt_count)
     VALUES (?, ?, ?, 'PROCESSING', ?, NOW(), 1)`,
    [PROVIDER, eventId, eventType, JSON.stringify(payload)],
  );

  return result.affectedRows > 0;
}

export async function completePayPalWebhookEvent(
  eventId: string,
): Promise<void> {
  await pool.execute(
    `UPDATE paypal_webhook_events
     SET status = 'COMPLETED', processed_at = NOW()
     WHERE provider = ? AND event_id = ?`,
    [PROVIDER, eventId],
  );
}

export async function releasePayPalWebhookEvent(
  eventId: string,
): Promise<void> {
  await pool.execute(
    `DELETE FROM paypal_webhook_events
     WHERE provider = ? AND event_id = ? AND status = 'PROCESSING'`,
    [PROVIDER, eventId],
  );
}
