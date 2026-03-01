"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export default function Hero() {
  const t = useTranslations("hero");

  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-32">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-muted via-background to-background" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-muted-foreground">{t("badge")}</span>
          </div>

          <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl">
            {t("title1")}
            <br />
            <span className="bg-gradient-to-r from-foreground via-muted-foreground to-foreground bg-clip-text text-transparent">
              {t("title2")}
            </span>
          </h1>

          <p className="mb-10 text-lg text-muted-foreground md:text-xl">
            {t("description")}
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/dashboard"
              className="w-full rounded-xl bg-primary px-8 py-4 text-base font-medium text-primary-foreground transition-all hover:opacity-90 hover:shadow-lg sm:w-auto"
            >
              {t("webCta")}
            </Link>
            <a
              href="https://apps.microsoft.com/detail/xpdm17p9fk4bjf?hl=ko-KR&gl=KR"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-8 py-4 text-base font-medium text-foreground transition-all hover:bg-hover hover:shadow-lg sm:w-auto"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              {t("windowsCta")}
            </a>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            {t("noCreditCard")}
          </p>
        </div>
      </div>
    </section>
  );
}
