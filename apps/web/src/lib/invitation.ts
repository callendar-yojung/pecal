import pool from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { addTeamMember, checkTeamMembership, getTeamById } from "./team";
import { getActivePlanForOwner } from "./storage";

export interface TeamInvitation {
  invitation_id: number;
  team_id: number;
  invited_member_id: number;
  invited_by: number;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  created_at: Date;
  responded_at: Date | null;
}

export async function upsertTeamInvitation(params: {
  teamId: number;
  invitedMemberId: number;
  invitedBy: number;
}): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO team_invitations (team_id, invited_member_id, invited_by, status, created_at)
     VALUES (?, ?, ?, 'PENDING', NOW())
     ON DUPLICATE KEY UPDATE
       invited_by = VALUES(invited_by),
       status = 'PENDING',
       created_at = NOW(),
       responded_at = NULL`,
    [params.teamId, params.invitedMemberId, params.invitedBy]
  );

  if (result.insertId) return result.insertId;
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT invitation_id FROM team_invitations WHERE team_id = ? AND invited_member_id = ? LIMIT 1`,
    [params.teamId, params.invitedMemberId]
  );
  return Number(rows[0]?.invitation_id || 0);
}

export async function getInvitationById(invitationId: number): Promise<TeamInvitation | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM team_invitations WHERE invitation_id = ? LIMIT 1`,
    [invitationId]
  );
  return (rows[0] as TeamInvitation) || null;
}

export async function respondToInvitation(params: {
  invitationId: number;
  memberId: number;
  action: "accept" | "decline";
}): Promise<{ success: boolean; message?: string }>
{
  const invitation = await getInvitationById(params.invitationId);
  if (!invitation) return { success: false, message: "Invitation not found" };
  if (invitation.invited_member_id !== params.memberId) {
    return { success: false, message: "Forbidden" };
  }
  if (invitation.status !== "PENDING") {
    return { success: false, message: "Invitation already handled" };
  }

  if (params.action === "decline") {
    await pool.execute(
      `UPDATE team_invitations SET status = 'DECLINED', responded_at = NOW() WHERE invitation_id = ?`,
      [params.invitationId]
    );
    return { success: true };
  }

  // accept
  const team = await getTeamById(invitation.team_id);
  if (!team) return { success: false, message: "Team not found" };

  const alreadyMember = await checkTeamMembership(invitation.team_id, params.memberId);
  if (alreadyMember) {
    await pool.execute(
      `UPDATE team_invitations SET status = 'ACCEPTED', responded_at = NOW() WHERE invitation_id = ?`,
      [params.invitationId]
    );
    return { success: true };
  }

  const planInfo = await getActivePlanForOwner("team", invitation.team_id);
  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM team_members WHERE team_id = ?`,
    [invitation.team_id]
  );
  const currentCount = Number(countRows[0]?.count || 0);
  if (currentCount >= planInfo.max_members) {
    return { success: false, message: "Member limit reached" };
  }

  await addTeamMember(invitation.team_id, params.memberId, invitation.invited_by, null);
  await pool.execute(
    `UPDATE team_invitations SET status = 'ACCEPTED', responded_at = NOW() WHERE invitation_id = ?`,
    [params.invitationId]
  );

  return { success: true };
}
