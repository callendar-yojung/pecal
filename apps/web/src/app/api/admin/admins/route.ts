import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getAllAdmins } from "@/lib/admin";

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

// GET /api/admin/admins - 전체 관리자 조회
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);

    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admins = await getAllAdmins();

    return NextResponse.json(admins);
  } catch (error) {
    console.error("Admin admins error:", error);
    return NextResponse.json(
      { error: "관리자 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

