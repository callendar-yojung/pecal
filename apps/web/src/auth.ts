import { cookies } from "next/headers";
import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import Apple from "next-auth/providers/apple";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";
import { createSessionId, storeBrowserSession } from "./lib/auth-token-store";
import { findOrCreateMember } from "./lib/member";
import { getRequiredEnv } from "./lib/required-env";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      memberId: number;
      email?: string | null;
      nickname?: string | null;
      profileImageUrl?: string | null;
      provider: string;
      sessionId?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    memberId?: number;
    nickname?: string;
    profileImageUrl?: string | null;
    provider?: string;
    sessionId?: string;
    email?: string | null;
  }
}

async function syncBrowserSession(token: JWT) {
  if (
    !token.sessionId ||
    typeof token.memberId !== "number" ||
    typeof token.provider !== "string" ||
    typeof token.nickname !== "string"
  ) {
    return;
  }

  await storeBrowserSession({
    sessionId: token.sessionId,
    memberId: token.memberId,
    provider: token.provider,
    nickname: token.nickname,
    email: typeof token.email === "string" ? token.email : null,
    clientPlatform: "web",
    clientName: "Pecal Web",
  });
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost:
    process.env.NODE_ENV !== "production" ||
    process.env.AUTH_TRUST_HOST === "true",
  providers: [
    Kakao({
      clientId: getRequiredEnv("AUTH_KAKAO_ID"),
      clientSecret: getRequiredEnv("AUTH_KAKAO_SECRET"),
    }),
    Google({
      clientId: getRequiredEnv("AUTH_GOOGLE_ID"),
      clientSecret: getRequiredEnv("AUTH_GOOGLE_SECRET"),
    }),
    ...(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET
      ? [
          Apple({
            clientId: process.env.AUTH_APPLE_ID,
            clientSecret: process.env.AUTH_APPLE_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!account) return false;

      try {
        let locale: "ko" | "en" = "en";
        try {
          const cookieStore = await cookies();
          const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
          if (cookieLocale === "ko" || cookieLocale === "en") {
            locale = cookieLocale;
          }
        } catch {
          // ignore if cookies not available
        }
        const member = await findOrCreateMember(
          account.provider,
          account.providerAccountId,
          user.email ?? null,
          user.image ?? null,
          locale,
        );

        (user as Record<string, unknown>).memberId = member.member_id;
        (user as Record<string, unknown>).nickname = member.nickname;
        (user as Record<string, unknown>).profileImageUrl =
          member.profile_image_url ?? user.image ?? null;
        (user as Record<string, unknown>).provider = account.provider;

        return true;
      } catch (error) {
        console.error("Sign in error:", error);
        return false;
      }
    },
    async jwt({ token, user, account, trigger, session }) {
      if (user && account) {
        token.memberId = (user as Record<string, unknown>).memberId as number;
        token.nickname = (user as Record<string, unknown>).nickname as string;
        token.profileImageUrl = (user as Record<string, unknown>)
          .profileImageUrl as string | null;
        token.provider = account.provider;
        token.email = user.email;
        token.sessionId =
          typeof token.sessionId === "string"
            ? token.sessionId
            : createSessionId();
      }
      if (trigger === "update" && session) {
        if (session.nickname) token.nickname = session.nickname;
        if (session.profileImageUrl !== undefined) {
          token.profileImageUrl = session.profileImageUrl as string | null;
        }
      }
      if (typeof token.sessionId !== "string") {
        token.sessionId = createSessionId();
      }
      await syncBrowserSession(token);
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub ?? String(token.memberId ?? "");
      session.user.memberId = token.memberId as number;
      session.user.nickname = token.nickname as string;
      session.user.profileImageUrl =
        (token.profileImageUrl as string | null) ?? null;
      session.user.provider = token.provider as string;
      session.user.sessionId = token.sessionId as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
