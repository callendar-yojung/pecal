import { type NextRequest, NextResponse } from "next/server";
import { validateRefreshSession } from "@/lib/auth-token-store";
import { generateTokenPair, verifyToken } from "@/lib/jwt";
import { findMemberById, isMemberLoginEnabled } from "@/lib/member";
import { getSessionClientMeta } from "@/lib/session-client-meta";
import { createOpsEvent } from "@/lib/ops-event-log";

/**
 * POST /api/auth/external/refresh
 * 리프레시 토큰으로 새 액세스 토큰 발급
 */
export async function POST(request: NextRequest) {
  try {
    const clientMeta = getSessionClientMeta(request);
    const body = await request.json();
    const { refresh_token } = body;

    if (!refresh_token) {
      await createOpsEvent({
        eventType: "AUTH_REFRESH_FAILURE",
        status: "failure",
        payload: { reason: "MISSING_REFRESH_TOKEN" },
      });
      return NextResponse.json(
        { error: "refresh_token is required" },
        { status: 400 },
      );
    }

    // 리프레시 토큰 검증
    const payload = await verifyToken(refresh_token);

    if (!payload || payload.type !== "refresh") {
      await createOpsEvent({
        eventType: "AUTH_REFRESH_FAILURE",
        status: "failure",
        payload: { reason: "INVALID_REFRESH_TOKEN" },
      });
      return NextResponse.json(
        { error: "Invalid refresh token" },
        { status: 401 },
      );
    }

    const isStored = await validateRefreshSession({
      sessionId: payload.sid,
      tokenId: payload.jti,
      refreshToken: refresh_token,
      memberId: payload.memberId,
    });
    if (!isStored) {
      await createOpsEvent({
        eventType: "AUTH_REFRESH_FAILURE",
        status: "failure",
        payload: {
          reason: "REFRESH_TOKEN_REVOKED",
          memberId: payload.memberId,
          sessionId: payload.sid,
        },
      });
      return NextResponse.json(
        { error: "Refresh token revoked or expired" },
        { status: 401 },
      );
    }

    const member = await findMemberById(payload.memberId);
    if (!member || !isMemberLoginEnabled(member)) {
      await createOpsEvent({
        eventType: "AUTH_REFRESH_FAILURE",
        status: "failure",
        payload: {
          reason: "ACCOUNT_UNAVAILABLE",
          memberId: payload.memberId,
        },
      });
      return NextResponse.json(
        { error: "Account is no longer available" },
        { status: 401 },
      );
    }

    // 새 토큰 발급
    const tokens = await generateTokenPair({
      memberId: member.member_id,
      nickname: member.nickname ?? payload.nickname,
      provider: member.provider ?? payload.provider,
      email: member.email ?? payload.email,
      ...clientMeta,
      sessionId: payload.sid,
      revokeRefreshTokenId: payload.jti,
      revokeRefreshTokenExpiresAt: payload.exp ?? null,
    });

    return NextResponse.json({
      success: true,
      ...tokens,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    await createOpsEvent({
      eventType: "AUTH_REFRESH_FAILURE",
      status: "failure",
      payload: {
        reason: "REFRESH_EXCEPTION",
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return NextResponse.json(
      { error: "Token refresh failed" },
      { status: 500 },
    );
  }
}
