import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TasksPanel } from "@/components/dashboard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.tasks" });

  return {
    title: `${t("title")} - Kelindor`,
  };
}

export default async function TasksPage() {
  const t = await getTranslations("dashboard.tasks");

  return (
    <div className="space-y-8">
      <div className="dashboard-hero-shell">
        <div className="dashboard-hero-orb dashboard-hero-orb-right" />
        <div className="dashboard-hero-orb dashboard-hero-orb-left" />
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-foreground lg:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            모든 태스크를 관리하고 진행 상황을 추적하세요
          </p>
        </div>
      </div>

      <div className="dashboard-glass-card premium-noise p-4 md:p-6">
        <TasksPanel />
      </div>
    </div>
  );
}
