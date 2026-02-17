"use client";

import { useTranslations } from "next-intl";

const companies = [
  "Samsung",
  "Hyundai",
  "Naver",
  "Kakao",
  "LG",
  "SK",
  "Coupang",
  "Baemin",
];

export default function TrustedBy() {
  const t = useTranslations("trustedBy");

  return (
    <section className="border-y border-zinc-200 bg-zinc-50 py-12 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="mx-auto max-w-7xl px-6">
        <p className="mb-8 text-center text-sm text-zinc-500 dark:text-zinc-500">
          {t("title")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {companies.map((company) => (
            <span
              key={company}
              className="text-lg font-medium text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
            >
              {company}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}