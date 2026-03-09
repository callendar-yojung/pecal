import type { RowDataPacket } from "mysql2";
import { type NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/admin-auth";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminRole(request, ["SUPER_ADMIN", "OPS"]);
    if ("error" in admin) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT t.team_id, t.name, t.description, t.created_at, t.created_by,
              COUNT(tm.member_id) as member_count
       FROM teams t
       LEFT JOIN team_members tm ON t.team_id = tm.team_id
       GROUP BY t.team_id
       ORDER BY t.created_at DESC`,
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Admin teams error:", error);
    return NextResponse.json({ error: "팀 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
