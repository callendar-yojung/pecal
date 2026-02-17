import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {t("title")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          모든 태스크를 관리하고 진행 상황을 추적하세요
        </p>
      </div>

      <TasksPanel />
    </div>
  );
}
