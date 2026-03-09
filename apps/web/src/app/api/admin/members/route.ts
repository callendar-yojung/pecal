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
      `SELECT member_id, email, nickname, provider, created_at, lasted_at
       FROM members
       ORDER BY created_at DESC`,
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Admin members error:", error);
    return NextResponse.json({ error: "회원 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
