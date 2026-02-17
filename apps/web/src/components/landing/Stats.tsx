"use client";

import { useTranslations } from "next-intl";

const stats = [
  { value: "10M+", key: "users" },
  { value: "50K+", key: "teams" },
  { value: "99.9%", key: "uptime" },
  { value: "4.9/5", key: "satisfaction" },
];

export default function Stats() {
  const t = useTranslations("stats");

  return (
    <section className="bg-zinc-900 py-20 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.key} className="text-center">
              <div className="mb-2 text-4xl font-bold text-white md:text-5xl">
                {stat.value}
              </div>
              <div className="text-zinc-400">{t(stat.key)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}