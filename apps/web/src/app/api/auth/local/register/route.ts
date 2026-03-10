import { type NextRequest, NextResponse } from "next/server";
import { registerLocalMember, withAuthCookies } from "@/lib/local-member-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await registerLocalMember({
      request,
      loginId: String(body.login_id ?? ""),
      password: String(body.password ?? ""),
      nickname: String(body.nickname ?? ""),
      email: String(body.email ?? ""),
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return withAuthCookies(result.body, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    console.error("Local web register error:", error);
    return NextResponse.json({ error: "회원가입에 실패했습니다." }, { status: 500 });
  }
}
