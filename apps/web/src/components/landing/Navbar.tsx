"use client";

import { Link } from "@/i18n/routing";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Navbar() {
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const t = useTranslations("nav");

  return (
    <header className="fixed top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">
                Pc
              </span>
            </div>
            <span className="text-lg font-semibold text-foreground">
              Pecal
            </span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <Link
              href="#features"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("features")}
            </Link>
            <Link
              href="#pricing"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("pricing")}
            </Link>
            <Link
              href="#customers"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("customers")}
            </Link>
          </div>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <LanguageSwitcher />
          {session ? (
            <>
              <span className="text-sm text-muted-foreground">
                {session.user.nickname}
              </span>
              <button
                type="button"
                onClick={() => signOut()}
                className="rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("logout")}
              </button>
              <Link
                href="/dashboard"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
              >
                {t("dashboard")}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("login")}
              </Link>
              <Link
                href="/dashboard"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
              >
                {t("getStarted")}
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="메뉴 열기"
        >
          <svg
            className="h-6 w-6 text-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {mobileMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="border-t border-border bg-background px-6 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            <Link href="#features" className="text-sm text-muted-foreground">
              {t("features")}
            </Link>
            <Link href="#pricing" className="text-sm text-muted-foreground">
              {t("pricing")}
            </Link>
            <Link href="#customers" className="text-sm text-muted-foreground">
              {t("customers")}
            </Link>
            <LanguageSwitcher />
            <hr className="border-border" />
            {session ? (
              <>
                <span className="text-sm text-muted-foreground">
                  {session.user.nickname}
                </span>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="text-left text-sm text-muted-foreground"
                >
                  {t("logout")}
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-muted-foreground">
                  {t("login")}
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground"
                >
                  {t("getStarted")}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
