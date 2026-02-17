"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import {
  StatsCard,
  TaskList,
  MiniCalendar,
} from "@/components/dashboard";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { data: session } = useSession();


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("welcome", { name: session?.user?.nickname || "User" })}
        </h1>
        <p className="mt-1 text-muted-foreground">{t("overview.subtitle")}</p>
      </div>

      {/*<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">*/}
      {/*  {stats.map((stat) => (*/}
      {/*    <StatsCard*/}
      {/*      key={stat.key}*/}
      {/*      title={t(`stats.${stat.key}`)}*/}
      {/*      value={stat.value}*/}
      {/*      change={stat.change}*/}
      {/*      changeType={stat.changeType}*/}
      {/*      icon={stat.icon}*/}
      {/*    />*/}
      {/*  ))}*/}
      {/*</div>*/}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <TaskList />

        </div>
        <div>
          <MiniCalendar />
        </div>
      </div>
    </div>
  );
}
