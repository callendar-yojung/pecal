import { NextResponse } from "next/server";
import { verifyRegisterVerificationCode } from "@/lib/local-email-verification";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await verifyRegisterVerificationCode({
      email: String(body.email ?? ""),
      code: String(body.code ?? ""),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Verify register verification code error:", error);
    const message =
      error instanceof Error ? error.message : "인증 코드 확인에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
