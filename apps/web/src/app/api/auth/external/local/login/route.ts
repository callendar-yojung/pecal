import { type NextRequest, NextResponse } from "next/server";
import { loginLocalMember } from "@/lib/local-member-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await loginLocalMember({
      request,
      loginId: String(body.login_id ?? ""),
      password: String(body.password ?? ""),
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.body);
  } catch (error) {
    console.error("External local login error:", error);
    return NextResponse.json({ error: "로그인에 실패했습니다." }, { status: 500 });
  }
}
