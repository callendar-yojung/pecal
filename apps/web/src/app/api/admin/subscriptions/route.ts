import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";

const secret = new TextEncoder().encode(
  process.env.API_SECRET_KEY || "default-secret-key"
);

async function verifyAdminToken(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.type !== "admin") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// GET /api/admin/subscriptions - 전체 구독 조회
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);

    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        s.subscription_id,
        s.owner_id,
        s.owner_type,
        CASE 
          WHEN s.owner_type = 'team' THEN t.name
          WHEN s.owner_type = 'personal' THEN m.nickname
          ELSE 'Unknown'
        END as owner_name,
        p.name as plan_name,
        p.price as plan_price,
        s.status,
        s.started_at,
        s.ended_at
       FROM subscriptions s
       LEFT JOIN teams t ON s.owner_type = 'team' AND s.owner_id = t.team_id
       LEFT JOIN members m ON s.owner_type = 'personal' AND s.owner_id = m.member_id
       JOIN plans p ON s.plan_id = p.plan_id
       ORDER BY s.started_at DESC`
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Admin subscriptions error:", error);
    return NextResponse.json(
      { error: "구독 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
