import type { NextRequest } from "next/server";

export interface SessionClientMeta {
  clientPlatform: string;
  clientName: string;
  appVersion?: string | null;
  userAgent?: string | null;
}

function sanitizeHeaderValue(value: string | null, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 120) : fallback;
}

export function getSessionClientMeta(request: NextRequest): SessionClientMeta {
  return {
    clientPlatform: sanitizeHeaderValue(
      request.headers.get("x-client-platform"),
      "web",
    ),
    clientName: sanitizeHeaderValue(
      request.headers.get("x-client-name"),
      "Pecal",
    ),
    appVersion: request.headers.get("x-app-version")?.trim() || null,
    userAgent: request.headers.get("user-agent")?.trim() || null,
  };
}
