import pool from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { PERMISSION_CODE_SET } from "./permissions";
import { ensurePermissionsSeeded } from "./permissions-db";

export interface Team {
  id: number;
  name: string;
  description: string | null;
  created_at: Date;
  created_by: number;
  memberCount?: number;
  role_name?: string | null;
}

export interface TeamMember {
  member_id: number;
  nickname: string | null;
  email: string | null;
  role_name: string | null;
  role_id: number | null;
}

export interface TeamPermission {
  permission_id: number;
  code: string;
  description: string | null;
}

export interface TeamRole {
  team_role_id: number;
  name: string;
  memberCount?: number;
}

export async function getPermissionsByMember(
  teamId: number,
  memberId: number
): Promise<string[]> {
  const [teamRows] = await pool.execute<RowDataPacket[]>(
    `SELECT created_by FROM teams WHERE team_id = ? LIMIT 1`,
    [teamId]
  );
  if (teamRows.length > 0 && Number(teamRows[0].created_by) === memberId) {
    return Array.from(PERMISSION_CODE_SET).sort();
  }

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.code
     FROM team_members tm
     JOIN team_roles tr ON tm.team_role_id = tr.team_role_id
     JOIN team_role_permissions trp ON tr.team_role_id = trp.team_role_id
     JOIN permissions p ON trp.permission_id = p.permission_id
     WHERE tm.team_id = ? AND tm.member_id = ?
     ORDER BY p.code ASC`,
    [teamId, memberId]
  );

  return rows.map((r: any) => r.code);
}

export async function getTeamsByMemberId(
  memberId: number
): Promise<Team[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 
      t.team_id as id, 
      t.name, 
      t.description, 
      t.created_at,
      t.created_by,
      tr.name as role_name,
      (SELECT COUNT(*) FROM team_members WHERE team_id = t.team_id) as memberCount
     FROM teams t
     JOIN team_members tm ON t.team_id = tm.team_id
     JOIN team_roles tr ON tm.team_role_id = tr.team_role_id
     WHERE tm.member_id = ?
     ORDER BY t.created_at DESC`,
    [memberId]
  );
  return rows as Team[];
}

export async function getTeamById(teamId: number): Promise<Team | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 
      t.team_id as id, 
      t.name, 
      t.description, 
      t.created_at,
      t.created_by,
      (SELECT COUNT(*) FROM team_members WHERE team_id = t.team_id) as memberCount
     FROM teams t
     WHERE t.team_id = ?`,
    [teamId]
  );
  return rows.length > 0 ? (rows[0] as Team) : null;
}

export async function createTeam(
  name: string,
  description: string | null,
  memberId: number
): Promise<number> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. teams 테이블에 삽입
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO teams (name, description, created_at, created_by)
       VALUES (?, ?, NOW(), ?)`,
      [name, description, memberId]
    );

    const teamId = result.insertId;

    // 2. 기본 팀 역할 생성 (Owner)
    const [roleResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO team_roles (team_id, name, created_at, created_by)
       VALUES (?, 'Owner', NOW(), ?)`,
      [teamId, memberId]
    );

    const roleId = roleResult.insertId;

    // 3. team_members 테이블에 생성자 추가
    await connection.execute(
      `INSERT INTO team_members (team_id, member_id, team_role_id)
       VALUES (?, ?, ?)`,
      [teamId, memberId, roleId]
    );

    // 4. 팀 워크스페이스 생성 (트랜잭션 커넥션 사용)
    await connection.execute(
      `INSERT INTO workspaces (type, owner_id, name, created_by, created_at)
       VALUES ('team', ?, ?, ?, NOW())`,
      [teamId, name, memberId]
    );

    await connection.commit();
    return teamId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateTeam(
  teamId: number,
  name: string,
  description: string | null
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE teams 
     SET name = ?, description = ?
     WHERE team_id = ?`,
    [name, description, teamId]
  );
  return result.affectedRows > 0;
}

export async function deleteTeam(teamId: number): Promise<boolean> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. team_role_permissions 삭제
    await connection.execute(
      `DELETE trp FROM team_role_permissions trp
       JOIN team_roles tr ON trp.team_role_id = tr.team_role_id
       WHERE tr.team_id = ?`,
      [teamId]
    );

    // 2. team_roles 삭제
    await connection.execute(
      `DELETE FROM team_roles WHERE team_id = ?`,
      [teamId]
    );

    // 3. team_members 삭제
    await connection.execute(
      `DELETE FROM team_members WHERE team_id = ?`,
      [teamId]
    );

    // 4. workspaces 삭제 (팀 워크스페이스)
    await connection.execute(
      `DELETE FROM workspaces WHERE type = 'team' AND owner_id = ?`,
      [teamId]
    );

    // 5. teams 삭제
    const [result] = await connection.execute<ResultSetHeader>(
      `DELETE FROM teams WHERE team_id = ?`,
      [teamId]
    );

    await connection.commit();
    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 회원이 팀에 속해있는지 확인
 */
export async function checkTeamMembership(
  teamId: number,
  memberId: number
): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 FROM team_members 
     WHERE team_id = ? AND member_id = ?`,
    [teamId, memberId]
  );
  return rows.length > 0;
}

export async function getTeamMembers(teamId: number): Promise<TeamMember[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 
      m.member_id,
      m.nickname,
      m.email,
      tr.name as role_name,
      tr.team_role_id as role_id
     FROM team_members tm
     JOIN members m ON tm.member_id = m.member_id
     JOIN team_roles tr ON tm.team_role_id = tr.team_role_id
     WHERE tm.team_id = ?
     ORDER BY tm.member_id ASC`,
    [teamId]
  );
  return rows as TeamMember[];
}

async function getOrCreateMemberRole(
  teamId: number,
  createdBy: number
): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT team_role_id FROM team_roles WHERE team_id = ? AND name = 'Member' LIMIT 1`,
    [teamId]
  );
  if (rows.length > 0) {
    return Number(rows[0].team_role_id);
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO team_roles (team_id, name, created_at, created_by)
     VALUES (?, 'Member', NOW(), ?)`,
    [teamId, createdBy]
  );
  return result.insertId;
}

async function getOrCreateRole(
  teamId: number,
  roleName: string,
  createdBy: number
): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT team_role_id FROM team_roles WHERE team_id = ? AND name = ? LIMIT 1`,
    [teamId, roleName]
  );
  if (rows.length > 0) {
    return Number(rows[0].team_role_id);
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO team_roles (team_id, name, created_at, created_by)
     VALUES (?, ?, NOW(), ?)`,
    [teamId, roleName, createdBy]
  );
  return result.insertId;
}

export async function addTeamMember(
  teamId: number,
  memberId: number,
  createdBy: number,
  roleId?: number | null
): Promise<boolean> {
  let resolvedRoleId = roleId ?? null;
  if (!resolvedRoleId) {
    resolvedRoleId = await getOrCreateMemberRole(teamId, createdBy);
  } else {
    const role = await getTeamRoleById(teamId, resolvedRoleId);
    if (!role) {
      throw new Error("Invalid role");
    }
  }
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO team_members (team_id, member_id, team_role_id)
     VALUES (?, ?, ?)`,
    [teamId, memberId, resolvedRoleId]
  );
  return result.affectedRows > 0;
}

export async function removeTeamMember(
  teamId: number,
  memberId: number
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `DELETE FROM team_members WHERE team_id = ? AND member_id = ?`,
    [teamId, memberId]
  );
  return result.affectedRows > 0;
}

export async function updateTeamMemberRole(
  teamId: number,
  memberId: number,
  roleId: number
): Promise<boolean> {
  const role = await getTeamRoleById(teamId, roleId);
  if (!role) {
    throw new Error("Invalid role");
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE team_members SET team_role_id = ? WHERE team_id = ? AND member_id = ?`,
    [roleId, teamId, memberId]
  );
  return result.affectedRows > 0;
}

export async function getPermissionsByRole(
  teamId: number,
  roleName: string
): Promise<TeamPermission[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.permission_id, p.code, p.description
     FROM permissions p
     JOIN team_role_permissions trp ON p.permission_id = trp.permission_id
     JOIN team_roles tr ON trp.team_role_id = tr.team_role_id
     WHERE tr.team_id = ? AND tr.name = ?
     ORDER BY p.code ASC`,
    [teamId, roleName]
  );
  return rows as TeamPermission[];
}

export async function addPermissionToRole(
  teamId: number,
  roleName: string,
  code: string,
  description: string | null,
  createdBy: number
): Promise<boolean> {
  if (!PERMISSION_CODE_SET.has(code)) {
    throw new Error("Invalid permission code");
  }

  await ensurePermissionsSeeded();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const roleId = await getOrCreateRole(teamId, roleName, createdBy);

    const [permRows] = await connection.execute<RowDataPacket[]>(
      `SELECT permission_id FROM permissions WHERE code = ? LIMIT 1`,
      [code]
    );

    if (permRows.length === 0) {
      await connection.rollback();
      return false;
    }
    const permissionId = Number(permRows[0].permission_id);

    const [existsRows] = await connection.execute<RowDataPacket[]>(
      `SELECT 1 FROM team_role_permissions WHERE team_role_id = ? AND permission_id = ?`,
      [roleId, permissionId]
    );
    if (existsRows.length === 0) {
      await connection.execute(
        `INSERT INTO team_role_permissions (permission_id, team_role_id)
         VALUES (?, ?)`,
        [permissionId, roleId]
      );
    }

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function removePermissionFromRole(
  teamId: number,
  roleName: string,
  code: string
): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT tr.team_role_id as role_id, p.permission_id as permission_id
     FROM team_roles tr
     JOIN team_role_permissions trp ON tr.team_role_id = trp.team_role_id
     JOIN permissions p ON trp.permission_id = p.permission_id
     WHERE tr.team_id = ? AND tr.name = ? AND p.code = ?
     LIMIT 1`,
    [teamId, roleName, code]
  );

  if (rows.length === 0) {
    return false;
  }

  const roleId = Number(rows[0].role_id);
  const permissionId = Number(rows[0].permission_id);

  const [result] = await pool.execute<ResultSetHeader>(
    `DELETE FROM team_role_permissions WHERE team_role_id = ? AND permission_id = ?`,
    [roleId, permissionId]
  );

  return result.affectedRows > 0;
}

export async function getTeamRoles(teamId: number): Promise<TeamRole[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT tr.team_role_id, tr.name, COUNT(tm.member_id) as memberCount
     FROM team_roles tr
     LEFT JOIN team_members tm ON tr.team_role_id = tm.team_role_id
     WHERE tr.team_id = ?
     GROUP BY tr.team_role_id
     ORDER BY tr.team_role_id ASC`,
    [teamId]
  );
  return rows as TeamRole[];
}

export async function getTeamRoleById(
  teamId: number,
  roleId: number
): Promise<TeamRole | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT team_role_id, name FROM team_roles WHERE team_id = ? AND team_role_id = ? LIMIT 1`,
    [teamId, roleId]
  );
  return rows.length > 0 ? (rows[0] as TeamRole) : null;
}

export async function getTeamRoleByName(
  teamId: number,
  name: string
): Promise<TeamRole | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT team_role_id, name FROM team_roles WHERE team_id = ? AND name = ? LIMIT 1`,
    [teamId, name]
  );
  return rows.length > 0 ? (rows[0] as TeamRole) : null;
}

export async function createTeamRole(
  teamId: number,
  name: string,
  createdBy: number
): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO team_roles (team_id, name, created_at, created_by)
     VALUES (?, ?, NOW(), ?)`,
    [teamId, name, createdBy]
  );
  return result.insertId;
}

export async function deleteTeamRole(
  teamId: number,
  roleId: number
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `DELETE FROM team_roles WHERE team_id = ? AND team_role_id = ?`,
    [teamId, roleId]
  );
  return result.affectedRows > 0;
}

export async function getRolePermissionsByRoleId(
  teamId: number,
  roleId: number
): Promise<TeamPermission[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.permission_id, p.code, p.description
     FROM permissions p
     JOIN team_role_permissions trp ON p.permission_id = trp.permission_id
     JOIN team_roles tr ON trp.team_role_id = tr.team_role_id
     WHERE tr.team_id = ? AND tr.team_role_id = ?
     ORDER BY p.code ASC`,
    [teamId, roleId]
  );
  return rows as TeamPermission[];
}

export async function setRolePermissions(
  teamId: number,
  roleId: number,
  codes: string[]
): Promise<boolean> {
  if (codes.some((code) => !PERMISSION_CODE_SET.has(code))) {
    throw new Error("Invalid permission code");
  }

  await ensurePermissionsSeeded();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [roleRows] = await connection.execute<RowDataPacket[]>(
      `SELECT team_role_id FROM team_roles WHERE team_id = ? AND team_role_id = ? LIMIT 1`,
      [teamId, roleId]
    );
    if (roleRows.length === 0) {
      throw new Error("Role not found");
    }

    await connection.execute(
      `DELETE FROM team_role_permissions WHERE team_role_id = ?`,
      [roleId]
    );

    if (codes.length > 0) {
      const placeholders = codes.map(() => "?").join(",");
      const [permRows] = await connection.execute<RowDataPacket[]>(
        `SELECT permission_id, code FROM permissions WHERE code IN (${placeholders})`,
        codes
      );
      const permissionIds = permRows.map((row: any) => Number(row.permission_id));
      if (permissionIds.length !== codes.length) {
        throw new Error("Permission not found");
      }

      const insertValues = permissionIds
        .map(() => "(?, ?)")
        .join(", ");
      const insertParams = permissionIds.flatMap((id) => [id, roleId]);

      await connection.execute(
        `INSERT INTO team_role_permissions (permission_id, team_role_id)
         VALUES ${insertValues}`,
        insertParams
      );
    }

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
