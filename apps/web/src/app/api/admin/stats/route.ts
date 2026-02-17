import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getDashboardStats } from "@/lib/admin";

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

// GET /api/admin/stats - 대시보드 통계
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);

    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stats = await getDashboardStats();

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "통계 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

