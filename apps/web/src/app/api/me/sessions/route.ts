import { type NextRequest, NextResponse } from "next/server";
import { auth as getWebSession } from "@/auth";
import { requireAuth } from "@/lib/access";
import {
  getMemberRefreshSessions,
  storeBrowserSession,
} from "@/lib/auth-token-store";
import { verifyToken } from "@/lib/jwt";

function buildCurrentDevice(params: {
  sessionId: string;
  provider: string;
  userAgent: string | null;
}) {
  const now = new Date().toISOString();
  return {
    session_id: params.sessionId,
    provider: params.provider,
    client_platform: "web",
    client_name: "Pecal Web",
    app_version: null,
    user_agent: params.userAgent,
    created_at: now,
    last_seen_at: now,
    current: true,
  };
}

async function getCurrentSessionId(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return verifyToken(token).then((payload) => payload?.sid ?? null);
  }

  const cookieToken = request.cookies.get("PECAL_ACCESS_TOKEN")?.value;
  if (cookieToken) {
    return verifyToken(cookieToken).then((payload) => payload?.sid ?? null);
  }

  const session = await getWebSession();
  return session?.user?.sessionId ?? null;
}

export async function GET(request: NextRequest) {
  const access = await requireAuth(request);
  if (access instanceof NextResponse) return access;

  const [sessions, currentSessionId, webSession] = await Promise.all([
    getMemberRefreshSessions(access.user.memberId),
    getCurrentSessionId(request),
    getWebSession(),
  ]);

  let allSessions = sessions;

  if (
    currentSessionId &&
    webSession?.user?.memberId === access.user.memberId &&
    !sessions.some(
      (session: (typeof sessions)[number]) =>
        session.sessionId === currentSessionId,
    )
  ) {
    await storeBrowserSession({
      sessionId: currentSessionId,
      memberId: access.user.memberId,
      provider: access.user.provider,
      nickname: access.user.nickname,
      email: access.user.email,
      clientPlatform: "web",
      clientName: "Pecal Web",
      userAgent: request.headers.get("user-agent"),
    });

    allSessions = await getMemberRefreshSessions(access.user.memberId);
  }

  const mappedSessions = allSessions.map(
    (session: (typeof allSessions)[number]) => ({
      session_id: session.sessionId,
      provider: session.provider,
      client_platform: session.clientPlatform,
      client_name: session.clientName,
      app_version: session.appVersion ?? null,
      user_agent: session.userAgent ?? null,
      created_at: session.createdAt,
      last_seen_at: session.lastSeenAt,
      current: session.sessionId === currentSessionId,
    }),
  );

  const sessionsWithFallback =
    mappedSessions.length === 0 && currentSessionId
      ? [
          buildCurrentDevice({
            sessionId: currentSessionId,
            provider: access.user.provider,
            userAgent: request.headers.get("user-agent"),
          }),
        ]
      : mappedSessions;

  return NextResponse.json({
    sessions: sessionsWithFallback,
    currentSessionId,
  });
}
