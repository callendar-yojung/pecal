import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";

// GET /api/members/search?q=...&type=nickname|email
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const q = request.nextUrl.searchParams.get("q")?.trim() || "";
    const type = request.nextUrl.searchParams.get("type") || "";

    if (q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const like = `${q}%`;
    let where = "(nickname LIKE ? OR email LIKE ?)";
    let params: Array<string> = [like, like];

    if (type === "email") {
      where = "email LIKE ?";
      params = [like];
    } else if (type === "nickname") {
      where = "nickname LIKE ?";
      params = [like];
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT member_id, nickname, email, profile_image_url
       FROM members
       WHERE ${where}
       ORDER BY nickname ASC
       LIMIT 10`,
      params
    );

    return NextResponse.json({ results: rows });
  } catch (error) {
    console.error("Failed to search members:", error);
    return NextResponse.json({ error: "Failed to search members" }, { status: 500 });
  }
}
