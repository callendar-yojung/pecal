"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSession, signOut } from "next-auth/react";
import { Link, usePathname } from "@/i18n/routing";

export default function UserMenu() {
  const t = useTranslations("dashboard.userMenu");
  const tNav = useTranslations("dashboard.nav");
  const [isOpen, setIsOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();
  const pathname = usePathname();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsLangOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const menuItems = [
    {
      key: "settings",
      href: "/dashboard/settings",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      key: "language",
      href: "#",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
      ),
      subMenu: true,
    },
    {
      key: "help",
      href: "#",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  const bottomItems = [
    {
      key: "upgrade",
      href: "/dashboard/settings/billing/plans",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
      highlight: true,
    },
    {
      key: "download",
      href: "/download",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      ),
    },
    {
      key: "learnMore",
      href: "#",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div ref={menuRef} className="relative">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted">
          {session?.user?.profileImageUrl && !avatarError ? (
            <img
              src={session.user.profileImageUrl}
              alt={session.user.nickname || "User"}
              className="h-full w-full object-cover"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <span className="text-sm font-medium text-muted-foreground">
              {session?.user?.nickname?.charAt(0) || "U"}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {session?.user?.nickname || "User"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {session?.user?.email || ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-lg p-2 text-muted-foreground hover:bg-hover hover:text-foreground"
        >
          <svg
            className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          {/* 상단 메뉴 */}
          <div className="p-1">
            {menuItems.map((item) => (
              item.subMenu ? (
                <div key={item.key}>
                  <button
                    type="button"
                    onClick={() => setIsLangOpen(!isLangOpen)}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-hover"
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      <span>{t(item.key)}</span>
                    </div>
                    <svg className={`h-4 w-4 transition-transform ${isLangOpen ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  {isLangOpen && (
                    <div className="ml-7 space-y-0.5 py-1">
                      <Link
                        href={pathname}
                        locale="ko"
                        className="block rounded-md px-3 py-1.5 text-sm text-popover-foreground hover:bg-hover"
                        onClick={() => { setIsOpen(false); setIsLangOpen(false); }}
                      >
                        한국어
                      </Link>
                      <Link
                        href={pathname}
                        locale="en"
                        className="block rounded-md px-3 py-1.5 text-sm text-popover-foreground hover:bg-hover"
                        onClick={() => { setIsOpen(false); setIsLangOpen(false); }}
                      >
                        English
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={item.key}
                  href={item.href}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-popover-foreground transition-colors hover:bg-hover"
                  onClick={() => setIsOpen(false)}
                >
                  {item.icon}
                  <span>{item.key === "settings" ? tNav("settings") : t(item.key)}</span>
                </Link>
              )
            ))}
          </div>

          <div className="border-t border-border" />

          {/* 하단 메뉴 */}
          <div className="p-1">
            {bottomItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  item.highlight
                    ? "text-blue-600 hover:bg-blue-50"
                    : "text-popover-foreground hover:bg-hover"
                }`}
                onClick={() => setIsOpen(false)}
              >
                {item.icon}
                <span>{t(item.key)}</span>
              </Link>
            ))}
          </div>

          <div className="border-t border-border" />

          {/* 로그아웃 */}
          <div className="p-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                signOut({ callbackUrl: "/" });
              }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>{tNav("logout")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
