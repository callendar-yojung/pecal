import pool from "./db";
import { PERMISSIONS } from "./permissions";

export async function ensurePermissionsSeeded() {
  for (const permission of PERMISSIONS) {
    await pool.execute(
      `INSERT INTO permissions (code, description)
       SELECT ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = ?)`,
      [permission.code, permission.description, permission.code]
    );
  }
}
