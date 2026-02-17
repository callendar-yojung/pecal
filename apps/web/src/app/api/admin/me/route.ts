import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.API_SECRET_KEY || "default-secret-key"
);

// GET /api/admin/me - 현재 로그인한 관리자 정보
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("admin_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, secret);

    if (payload.type !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      admin_id: payload.admin_id,
      username: payload.username,
      role: payload.role,
    });
  } catch (error) {
    console.error("Admin auth error:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

