import { type NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { isNicknameReserved, isNicknameTaken } from "@/lib/member";

// GET /api/me/account/nickname-check?nickname=...
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const nickname = request.nextUrl.searchParams.get("nickname")?.trim() ?? "";
    if (!nickname) {
      return NextResponse.json(
        { error: "nickname is required" },
        { status: 400 },
      );
    }

    if (nickname.length > 200) {
      return NextResponse.json(
        { available: false, reason: "too_long" },
        { status: 200 },
      );
    }

    if (isNicknameReserved(nickname)) {
      return NextResponse.json(
        { available: false, reason: "reserved" },
        { status: 200 },
      );
    }

    const taken = await isNicknameTaken(nickname, user.memberId);
    return NextResponse.json(
      { available: !taken, reason: taken ? "taken" : null },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to check nickname:", error);
    return NextResponse.json(
      { error: "Failed to check nickname" },
      { status: 500 },
    );
  }
}
