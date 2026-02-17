import pool from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export interface Workspace {
  workspace_id: number;
  type: "personal" | "team";
  owner_id: number;
  name: string;
  created_at: Date;
  created_by: number;
  memberCount?: number;
}

/**
 * 회원의 개인 워크스페이스 목록 조회
 */
export async function getWorkspacesByMemberId(
    memberId: number
): Promise<Workspace[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
      w.workspace_id,
      w.type,
      w.owner_id,
      w.name,
      w.created_at,
      w.created_by
    FROM workspaces w
    WHERE w.type = 'personal'
      AND w.owner_id = ?
    ORDER BY w.created_at ASC`,
      [memberId]
  );

  return rows as Workspace[];
}

/**
 * 회원의 모든 워크스페이스 조회 (개인 + 소속 팀)
 */
export async function getWorkspacesPersonalAndTeamByMemberId(
    memberId: number
): Promise<Workspace[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
      w.workspace_id,
          w.type,
          w.owner_id,
          w.name,
          w.created_at,
          w.created_by,
          CASE
      WHEN w.type = 'team' THEN (
          SELECT COUNT(*)
      FROM team_members tm
      WHERE tm.team_id = w.owner_id
    )
      ELSE NULL
      END as memberCount
      FROM workspaces w
      WHERE
      (w.type = 'personal' AND w.owner_id = ?)
      OR (w.type = 'team' AND w.owner_id IN (
          SELECT team_id FROM team_members WHERE member_id = ?
    ))
      ORDER BY w.type DESC, w.created_at ASC `,
          [memberId, memberId]
    );

  return rows as Workspace[];
}



/**
 * 워크스페이스 ID로 조회
 */
export async function getWorkspaceById(
  workspaceId: number
): Promise<Workspace | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 
      w.workspace_id,
      w.type,
      w.owner_id,
      w.name,
      w.created_at,
      w.created_by,
      CASE 
        WHEN w.type = 'team' THEN (
          SELECT COUNT(*) 
          FROM team_members tm 
          WHERE tm.team_id = w.owner_id
        )
        ELSE NULL
      END as memberCount
    FROM workspaces w
    WHERE w.workspace_id = ?`,
    [workspaceId]
  );

  return rows.length > 0 ? (rows[0] as Workspace) : null;
}



/**
 * 개인 워크스페이스 생성 (회원 가입 시)
 */
export async function createPersonalWorkspace(
  memberId: number,
  name: string
): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO workspaces (type, owner_id, name, created_by, created_at)
     VALUES ('personal', ?, ?, ?, NOW())`,
    [memberId, name, memberId]
  );

  return result.insertId;
}

/**
 * 팀 워크스페이스 생성 (팀 생성 시)
 */
export async function createTeamWorkspace(
  teamId: number,
  name: string,
  createdBy: number
): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO workspaces (type, owner_id, name, created_by, created_at)
     VALUES ('team', ?, ?, ?, NOW())`,
    [teamId, name, createdBy]
  );

  return result.insertId;
}

/**
 * 워크스페이스 이름 수정
 */
export async function updateWorkspaceName(
  workspaceId: number,
  name: string
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE workspaces SET name = ? WHERE workspace_id = ?`,
    [name, workspaceId]
  );

  return result.affectedRows > 0;
}

/**
 * 워크스페이스 삭제
 */
export async function deleteWorkspace(
  workspaceId: number
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `DELETE FROM workspaces WHERE workspace_id = ?`,
    [workspaceId]
  );

  return result.affectedRows > 0;
}

/**
 * 회원이 워크스페이스에 접근 권한이 있는지 확인
 */
export async function checkWorkspaceAccess(
  workspaceId: number,
  memberId: number
): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 
    FROM workspaces w
    WHERE w.workspace_id = ?
      AND (
        (w.type = 'personal' AND w.owner_id = ?)
        OR (w.type = 'team' AND w.owner_id IN (
          SELECT team_id FROM team_members WHERE member_id = ?
        ))
      )`,
    [workspaceId, memberId, memberId]
  );

  return rows.length > 0;
}

