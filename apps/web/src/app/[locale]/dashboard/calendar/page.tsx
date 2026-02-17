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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {t("title")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          월별 태스크를 한눈에 확인하고 일정을 관리하세요
        </p>
      </div>

      <CalendarPanel />
    </div>
  );
}
