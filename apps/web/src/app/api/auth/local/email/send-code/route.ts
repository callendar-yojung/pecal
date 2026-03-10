import { NextResponse } from "next/server";
import { sendRegisterVerificationCode } from "@/lib/local-email-verification";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await sendRegisterVerificationCode(String(body.email ?? ""));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Send register verification code error:", error);
    const message =
      error instanceof Error ? error.message : "인증 코드를 보내지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
