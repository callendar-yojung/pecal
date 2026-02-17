"use client";

import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";

const planKeys = ["free", "team", "enterprise"] as const;

export default function Pricing() {
  const t = useTranslations("pricing");

  return (
    <section id="pricing" className="bg-muted py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {t("title")}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t("description")}
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {planKeys.map((planKey) => {
            const highlighted = planKey === "team";
            const features = t.raw(`${planKey}.features`) as string[];

            return (
              <article
                key={planKey}
                className={`relative rounded-2xl border p-8 ${
                  highlighted
                    ? "border-border bg-background shadow-xl"
                    : "border-border bg-background"
                }`}
              >
                {highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-4 py-1 text-sm font-medium text-background">
                    {t("popular")}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="mb-2 text-xl font-semibold text-foreground">
                    {t(`${planKey}.name`)}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">
                      {t(`${planKey}.price`)}
                    </span>
                    <span className="text-muted-foreground">{t(`${planKey}.period`)}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t(`${planKey}.description`)}
                  </p>
                </div>

                <ul className="mb-8 space-y-3">
                  {features.map((feature: string) => (
                    <li
                      key={feature}
                      className="flex items-start gap-3 text-sm text-muted-foreground"
                    >
                      <svg
                        className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/login"
                  className={`block w-full rounded-xl px-6 py-3 text-center text-sm font-medium transition-colors ${
                    highlighted
                      ? "bg-foreground text-background hover:opacity-95"
                      : "border border-border text-foreground hover:bg-muted"
                  }`}
                >
                  {t(`${planKey}.cta`)}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
