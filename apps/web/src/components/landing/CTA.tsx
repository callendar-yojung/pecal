"use client";

import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";

export default function CTA() {
  const t = useTranslations("cta");

  return (
    <section className="py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative overflow-hidden rounded-3xl bg-foreground px-8 py-16 text-center md:px-16 md:py-24">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-muted via-foreground to-foreground" />

          <h2 className="mb-4 text-3xl font-bold text-background md:text-4xl lg:text-5xl">
            {t("title")}
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground">
            {t("description")}
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/dashboard"
              className="w-full rounded-xl bg-background px-8 py-4 text-base font-medium text-foreground transition-all hover:bg-muted sm:w-auto"
            >
              {t("getStarted")}
            </Link>
            <Link
              href="#demo"
              className="w-full rounded-xl border border-border px-8 py-4 text-base font-medium text-background transition-all hover:bg-muted sm:w-auto"
            >
              {t("contact")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
