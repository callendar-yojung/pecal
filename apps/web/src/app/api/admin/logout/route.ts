import { NextRequest, NextResponse } from "next/server";

// POST /api/admin/logout - 관리자 로그아웃
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });

  // 쿠키 삭제
  response.cookies.delete("admin_token");

  return response;
}

