import type { NextRequest } from "next/server";

type OAuthProvider = "kakao" | "google" | "apple";

export function getOAuthRedirectUri(request: NextRequest, provider: OAuthProvider): string {
  const path = `/api/auth/${provider}/callback`;
  const configured =
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL;

  if (configured) {
    try {
      return new URL(path, configured).toString();
    } catch {
      // fall through to request origin
    }
  }

  return new URL(path, request.nextUrl.origin).toString();
}
