import NextAuth from "next-auth";
import Kakao from "next-auth/providers/kakao";
import Google from "next-auth/providers/google";
import { findOrCreateMember } from "./lib/member";
import { cookies } from "next/headers";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      memberId: number;
      email?: string | null;
      nickname?: string | null;
      profileImageUrl?: string | null;
      provider: string;
    };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true, // ⭐ 추가!
  providers: [
    Kakao({
      clientId: process.env.AUTH_KAKAO_ID!,
      clientSecret: process.env.AUTH_KAKAO_SECRET!,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
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
          locale
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
        token.profileImageUrl = (user as Record<string, unknown>).profileImageUrl as string | null;
        token.provider = account.provider;
      }
      if (trigger === "update" && session) {
        if (session.nickname) token.nickname = session.nickname;
        if (session.profileImageUrl !== undefined) {
          token.profileImageUrl = session.profileImageUrl as string | null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub!;
      session.user.memberId = token.memberId as number;
      session.user.nickname = token.nickname as string;
      session.user.profileImageUrl = (token.profileImageUrl as string | null) ?? null;
      session.user.provider = token.provider as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
