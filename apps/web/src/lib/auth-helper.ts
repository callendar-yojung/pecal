import { NextRequest } from "next/server";
import { verifyToken, type TokenPayload } from "./jwt";
import { auth } from "@/auth";

export interface AuthUser {
  memberId: number;
  nickname: string;
  provider: string;
  email?: string | null;
}

/**
 * 요청에서 인증된 사용자 정보를 가져옵니다.
 * 1. Authorization 헤더의 Bearer 토큰 (JWT) 확인
 * 2. 없으면 NextAuth 세션 확인 (웹 브라우저용)
 */
export async function getAuthUser(request?: NextRequest): Promise<AuthUser | null> {
  // 1. Authorization 헤더에서 JWT 확인
  if (request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const payload = await verifyToken(token);

      if (payload && payload.type === "access") {
        return {
          memberId: payload.memberId,
          nickname: payload.nickname,
          provider: payload.provider,
          email: payload.email,
        };
      }
    }
  }

  // 2. NextAuth 세션 확인 (웹 브라우저용 폴백)
  const session = await auth();
  if (session?.user?.memberId) {
    return {
      memberId: session.user.memberId,
      nickname: session.user.nickname || "",
      provider: session.user.provider,
      email: session.user.email,
    };
  }

  return null;
}

/**
 * 인증 필수 API용 헬퍼
 * 인증되지 않으면 null 반환
 */
export async function requireAuth(request?: NextRequest): Promise<AuthUser | null> {
  return getAuthUser(request);
}