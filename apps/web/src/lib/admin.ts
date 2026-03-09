import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { ADMIN_ROLES, ensureAdminSecuritySchema, type AdminRole, normalizeAdminRole, updateAdminPasswordSecurityState } from "@/lib/admin-security";
import pool from "./db";

export interface Admin {
  admin_id: number;
  username: string;
  name: string;
  email: string;
  role: AdminRole;
  created_at: string;
  last_login: string | null;
  two_factor_enabled?: boolean;
  password_changed_at?: string | null;
  force_password_change?: boolean;
}

export interface AdminWithPassword extends Admin {
  password: string;
  two_factor_secret?: string | null;
  two_factor_temp_secret?: string | null;
}

function mapAdminRow(row: RowDataPacket): Admin {
  return {
    admin_id: Number(row.admin_id),
    username: String(row.username),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    role: normalizeAdminRole(row.role),
    created_at: String(row.created_at),
    last_login: row.last_login ? String(row.last_login) : null,
    two_factor_enabled: row.two_factor_enabled !== undefined ? Number(row.two_factor_enabled) === 1 : undefined,
    password_changed_at: row.password_changed_at ? String(row.password_changed_at) : null,
    force_password_change: row.force_password_change !== undefined ? Number(row.force_password_change) === 1 : undefined,
  };
}

export async function loginAdmin(
  username: string,
  password: string,
): Promise<AdminWithPassword | null> {
  await ensureAdminSecuritySchema();
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM admins WHERE username = ?",
    [username],
  );

  if (rows.length === 0) {
    return null;
  }

  const admin = rows[0] as RowDataPacket;
  const isValid = await bcrypt.compare(password, String(admin.password ?? ""));

  if (!isValid) {
    return null;
  }

  await pool.execute(
    "UPDATE admins SET last_login = NOW() WHERE admin_id = ?",
    [admin.admin_id],
  );

  return {
    ...mapAdminRow(admin),
    password: String(admin.password),
    two_factor_secret: admin.two_factor_secret ? String(admin.two_factor_secret) : null,
    two_factor_temp_secret: admin.two_factor_temp_secret ? String(admin.two_factor_temp_secret) : null,
  };
}

export async function getAdminById(adminId: number): Promise<Admin | null> {
  await ensureAdminSecuritySchema();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT admin_id, username, name, email, role, created_at, last_login,
            two_factor_enabled, password_changed_at, force_password_change
     FROM admins WHERE admin_id = ?`,
    [adminId],
  );

  return rows.length > 0 ? mapAdminRow(rows[0]) : null;
}

export async function getAllAdmins(): Promise<Admin[]> {
  await ensureAdminSecuritySchema();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT admin_id, username, name, email, role, created_at, last_login,
            two_factor_enabled, password_changed_at, force_password_change
     FROM admins ORDER BY created_at DESC`,
  );

  return rows.map(mapAdminRow);
}

export async function createAdmin(data: {
  username: string;
  password: string;
  name: string;
  email: string;
  role?: AdminRole;
  force_password_change?: boolean;
}): Promise<number> {
  await ensureAdminSecuritySchema();
  const hashedPassword = await bcrypt.hash(data.password, 10);

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO admins
      (username, password, name, email, role, password_changed_at, force_password_change)
     VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
    [
      data.username,
      hashedPassword,
      data.name,
      data.email,
      data.role || "OPS",
      data.force_password_change ? 1 : 0,
    ],
  );

  return result.insertId;
}

export async function updateAdmin(
  adminId: number,
  data: {
    name?: string;
    email?: string;
    role?: AdminRole;
    force_password_change?: boolean;
  },
): Promise<boolean> {
  await ensureAdminSecuritySchema();
  const updates: string[] = [];
  const values: Array<string | number> = [];

  if (data.name !== undefined) {
    updates.push("name = ?");
    values.push(data.name);
  }
  if (data.email !== undefined) {
    updates.push("email = ?");
    values.push(data.email);
  }
  if (data.role !== undefined) {
    updates.push("role = ?");
    values.push(data.role);
  }
  if (data.force_password_change !== undefined) {
    updates.push("force_password_change = ?");
    values.push(data.force_password_change ? 1 : 0);
  }

  if (updates.length === 0) {
    return false;
  }

  values.push(adminId);

  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE admins SET ${updates.join(", ")} WHERE admin_id = ?`,
    values,
  );

  return result.affectedRows > 0;
}

export async function changeAdminPassword(
  adminId: number,
  newPassword: string,
): Promise<boolean> {
  await ensureAdminSecuritySchema();
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE admins SET password = ? WHERE admin_id = ?",
    [hashedPassword, adminId],
  );

  if (result.affectedRows > 0) {
    await updateAdminPasswordSecurityState(adminId, false);
    return true;
  }

  return false;
}

export async function verifyAdminCurrentPassword(adminId: number, password: string) {
  await ensureAdminSecuritySchema();
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT password FROM admins WHERE admin_id = ? LIMIT 1",
    [adminId],
  );

  if (rows.length === 0) return false;
  return bcrypt.compare(password, String(rows[0].password ?? ""));
}

export async function deleteAdmin(adminId: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    "DELETE FROM admins WHERE admin_id = ?",
    [adminId],
  );

  return result.affectedRows > 0;
}

export async function getDashboardStats() {
  const [membersCount] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM members",
  );
  const [teamsCount] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM teams",
  );
  const [subscriptionsCount] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM subscriptions WHERE status = 'ACTIVE'",
  );
  const [tasksCount] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM tasks",
  );
  const [recentMembers] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM members WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
  );

  return {
    totalMembers: Number(membersCount[0].count),
    totalTeams: Number(teamsCount[0].count),
    activeSubscriptions: Number(subscriptionsCount[0].count),
    totalTasks: Number(tasksCount[0].count),
    recentMembers: Number(recentMembers[0].count),
    availableRoles: [...ADMIN_ROLES],
  };
}
