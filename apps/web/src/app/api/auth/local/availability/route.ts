import { type NextRequest, NextResponse } from "next/server";
import { checkLocalRegisterAvailability } from "@/lib/local-member-auth";

export async function GET(request: NextRequest) {
  try {
    const loginId = request.nextUrl.searchParams.get("login_id") ?? undefined;
    const nickname = request.nextUrl.searchParams.get("nickname") ?? undefined;

    if (!loginId && !nickname) {
      return NextResponse.json(
        { error: "login_id or nickname is required" },
        { status: 400 },
      );
    }

    const result = await checkLocalRegisterAvailability({ loginId, nickname });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Local auth availability check failed:", error);
    return NextResponse.json(
      { error: "중복 확인에 실패했습니다." },
      { status: 500 },
    );
  }
}
