import { type NextRequest, NextResponse } from "next/server";
import { revokeRefreshSession } from "@/lib/auth-token-store";
import { blacklistVerifiedToken, verifyToken } from "@/lib/jwt";

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return request.cookies.get("PECAL_ACCESS_TOKEN")?.value ?? null;
}

function getRefreshToken(
  request: NextRequest,
  body: { refresh_token?: string },
) {
  if (typeof body.refresh_token === "string") {
    return body.refresh_token;
  }
  return request.cookies.get("PECAL_REFRESH_TOKEN")?.value ?? null;
}

/**
 * POST /api/auth/external/logout
 * 현재 access/refresh token을 폐기합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      refresh_token?: string;
    };

    const rawAccessToken = getBearerToken(request);
    const rawRefreshToken = getRefreshToken(request, body);

    const accessPayload = rawAccessToken
      ? await verifyToken(rawAccessToken)
      : null;
    const refreshPayload = rawRefreshToken
      ? await verifyToken(rawRefreshToken)
      : null;

    await Promise.all([
      blacklistVerifiedToken(accessPayload),
      blacklistVerifiedToken(refreshPayload),
    ]);

    if (refreshPayload?.type === "refresh") {
      await revokeRefreshSession({
        sessionId: refreshPayload.sid,
        memberId: refreshPayload.memberId,
        refreshTokenId: refreshPayload.jti,
        refreshTokenExpiresAt: refreshPayload.exp ?? null,
      });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set("PECAL_ACCESS_TOKEN", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    response.cookies.set("PECAL_REFRESH_TOKEN", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    console.error("External logout error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
