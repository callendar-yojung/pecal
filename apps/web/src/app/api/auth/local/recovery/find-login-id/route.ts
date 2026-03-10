import { NextResponse } from "next/server";
import { sendLocalLoginIdReminder } from "@/lib/local-member-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await sendLocalLoginIdReminder(String(body.email ?? ""));
    return NextResponse.json({
      success: true,
      message: "입력한 이메일로 아이디 안내 메일을 보냈습니다. 가입된 계정이 없으면 메일이 발송되지 않습니다.",
    });
  } catch (error) {
    console.error("Find login ID error:", error);
    const message =
      error instanceof Error ? error.message : "아이디 찾기 요청에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
