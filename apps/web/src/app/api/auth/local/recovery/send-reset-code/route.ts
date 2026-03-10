import { NextResponse } from "next/server";
import { requestLocalPasswordReset } from "@/lib/local-member-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await requestLocalPasswordReset({
      loginId: String(body.login_id ?? ""),
      email: String(body.email ?? ""),
    });
    return NextResponse.json({
      success: true,
      message: "입력한 정보가 맞으면 비밀번호 재설정 코드가 이메일로 발송됩니다.",
    });
  } catch (error) {
    console.error("Send password reset code error:", error);
    const message =
      error instanceof Error ? error.message : "비밀번호 재설정 코드 발송에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
