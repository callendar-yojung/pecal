import { type NextRequest, NextResponse } from "next/server";
import { requireAdminToken } from "@/lib/admin-auth";
import { getAdminSecurityState } from "@/lib/admin-security";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminToken(request, { allowPasswordChangeOnly: true });
    if ("error" in admin) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const security = await getAdminSecurityState(Number(admin.admin_id));

    return NextResponse.json({
      admin_id: admin.admin_id,
      username: admin.username,
      role: security?.role ?? admin.role,
      requiresPasswordChange: security?.requiresPasswordChange ?? admin.must_change_password === true,
      twoFactorEnabled: security?.twoFactorEnabled ?? false,
      passwordChangedAt: security?.passwordChangedAt ?? null,
    });
  } catch (error) {
    console.error("Admin auth error:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
