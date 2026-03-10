import { compare } from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import {
  findMemberById,
  isValidMemberPassword,
  updateLocalMemberPassword,
} from "@/lib/member";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const member = await findMemberById(user.memberId);
    if (!member || member.provider !== "local" || !member.password_hash) {
      return NextResponse.json(
        { error: "비밀번호 변경은 Pecal ID 로그인 계정에서만 가능합니다." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");

    if (!currentPassword.trim() || !newPassword.trim()) {
      return NextResponse.json(
        { error: "현재 비밀번호와 새 비밀번호를 입력해 주세요." },
        { status: 400 },
      );
    }

    if (!isValidMemberPassword(newPassword)) {
      return NextResponse.json(
        { error: "비밀번호는 8자 이상이며 특수문자를 포함해야 합니다." },
        { status: 400 },
      );
    }

    const matches = await compare(currentPassword, member.password_hash);
    if (!matches) {
      return NextResponse.json(
        { error: "현재 비밀번호가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    await updateLocalMemberPassword({
      memberId: user.memberId,
      password: newPassword,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update local password:", error);
    return NextResponse.json(
      { error: "비밀번호 변경에 실패했습니다." },
      { status: 500 },
    );
  }
}
