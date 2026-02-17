import pool from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import bcrypt from "bcryptjs";

export interface Admin {
  admin_id: number;
  username: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN";
  created_at: Date;
  last_login: Date | null;
}

export interface AdminWithPassword extends Admin {
  password: string;
}

// 관리자 로그인
export async function loginAdmin(
  username: string,
  password: string
): Promise<Admin | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM admins WHERE username = ?",
    [username]
  );

  if (rows.length === 0) {
    return null;
  }

  const admin = rows[0] as AdminWithPassword;
  const isValid = await bcrypt.compare(password, admin.password);

  if (!isValid) {
    return null;
  }

  // 마지막 로그인 시간 업데이트
  await pool.execute("UPDATE admins SET last_login = NOW() WHERE admin_id = ?", [
    admin.admin_id,
  ]);

  // 비밀번호 제외하고 반환
  const { password: _, ...adminWithoutPassword } = admin;
  return adminWithoutPassword as Admin;
}

// 관리자 조회 (ID)
export async function getAdminById(adminId: number): Promise<Admin | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT admin_id, username, name, email, role, created_at, last_login FROM admins WHERE admin_id = ?",
    [adminId]
  );

  return rows.length > 0 ? (rows[0] as Admin) : null;
}

// 모든 관리자 조회
export async function getAllAdmins(): Promise<Admin[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT admin_id, username, name, email, role, created_at, last_login FROM admins ORDER BY created_at DESC"
  );

  return rows as Admin[];
}

// 관리자 생성
export async function createAdmin(data: {
  username: string;
  password: string;
  name: string;
  email: string;
  role?: "SUPER_ADMIN" | "ADMIN";
}): Promise<number> {
  const hashedPassword = await bcrypt.hash(data.password, 10);

  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO admins (username, password, name, email, role) VALUES (?, ?, ?, ?, ?)",
    [
      data.username,
      hashedPassword,
      data.name,
      data.email,
      data.role || "ADMIN",
    ]
  );

  return result.insertId;
}

// 관리자 수정
export async function updateAdmin(
  adminId: number,
  data: {
    name?: string;
    email?: string;
    role?: "SUPER_ADMIN" | "ADMIN";
  }
): Promise<boolean> {
  const updates: string[] = [];
  const values: any[] = [];

  if (data.name) {
    updates.push("name = ?");
    values.push(data.name);
  }
  if (data.email) {
    updates.push("email = ?");
    values.push(data.email);
  }
  if (data.role) {
    updates.push("role = ?");
    values.push(data.role);
  }

  if (updates.length === 0) {
    return false;
  }

  values.push(adminId);

  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE admins SET ${updates.join(", ")} WHERE admin_id = ?`,
    values
  );

  return result.affectedRows > 0;
}

// 관리자 비밀번호 변경
export async function changeAdminPassword(
  adminId: number,
  newPassword: string
): Promise<boolean> {
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE admins SET password = ? WHERE admin_id = ?",
    [hashedPassword, adminId]
  );

  return result.affectedRows > 0;
}

// 관리자 삭제
export async function deleteAdmin(adminId: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    "DELETE FROM admins WHERE admin_id = ?",
    [adminId]
  );

  return result.affectedRows > 0;
}

// 대시보드 통계
export async function getDashboardStats() {
  // 총 회원 수
  const [membersCount] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM members"
  );

  // 총 팀 수
  const [teamsCount] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM teams"
  );

  // 총 구독 수
  const [subscriptionsCount] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM subscriptions WHERE status = 'ACTIVE'"
  );

  // 총 태스크 수
  const [tasksCount] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM tasks"
  );

  // 최근 가입 회원 (7일)
  const [recentMembers] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM members WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
  );

  return {
    totalMembers: membersCount[0].count,
    totalTeams: teamsCount[0].count,
    activeSubscriptions: subscriptionsCount[0].count,
    totalTasks: tasksCount[0].count,
    recentMembers: recentMembers[0].count,
  };
}

