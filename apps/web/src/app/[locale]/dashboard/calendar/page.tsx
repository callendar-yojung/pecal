import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { CalendarPanel } from "@/components/dashboard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.calendar" });

  return {
    title: `${t("title")} - Kelindor`,
  };
}

export default async function CalendarPage() {
  const t = await getTranslations("dashboard.calendar");

  return (
    <div className="space-y-8">
      <div className="dashboard-hero-shell">
        <div className="dashboard-hero-orb dashboard-hero-orb-right" />
        <div className="dashboard-hero-orb dashboard-hero-orb-left" />
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-foreground lg:text-4xl">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground">
            월별 태스크를 한눈에 확인하고 일정을 관리하세요
          </p>
        </div>
      </div>

      <div className="dashboard-glass-card premium-noise p-4 md:p-6">
        <CalendarPanel />
      </div>
    </div>
  );
}
