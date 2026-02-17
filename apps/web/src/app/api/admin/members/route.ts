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

// GET /api/admin/members - 전체 회원 조회
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);

    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT member_id, email, nickname, provider, created_at, lasted_at 
       FROM members 
       ORDER BY created_at DESC`
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Admin members error:", error);
    return NextResponse.json(
      { error: "회원 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

