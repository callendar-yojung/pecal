import { NextResponse } from "next/server";
import { resetLocalPassword } from "@/lib/local-member-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await resetLocalPassword({
      loginId: String(body.login_id ?? ""),
      email: String(body.email ?? ""),
      code: String(body.code ?? ""),
      password: String(body.password ?? ""),
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    const message =
      error instanceof Error ? error.message : "비밀번호 재설정에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
