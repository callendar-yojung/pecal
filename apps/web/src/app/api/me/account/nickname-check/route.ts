import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { isNicknameReserved, isNicknameTaken } from "@/lib/member";

// GET /api/me/account/nickname-check?nickname=...
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const nickname = request.nextUrl.searchParams.get("nickname")?.trim() || "";
    if (!nickname) {
      return NextResponse.json({ error: "Nickname is required" }, { status: 400 });
    }

    if (isNicknameReserved(nickname)) {
      return NextResponse.json({ available: false, reason: "reserved" });
    }

    const taken = await isNicknameTaken(nickname, user.memberId);
    return NextResponse.json({ available: !taken });
  } catch (error) {
    console.error("Failed to check nickname:", error);
    return NextResponse.json({ error: "Failed to check nickname" }, { status: 500 });
  }
}
