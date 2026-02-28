"use client";

import { ListTodo, Sparkles } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { DashboardShell, TaskList } from "@/components/dashboard";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { data: session } = useSession();
  const [overviewDate, setOverviewDate] = useState(new Date());

  return (
    <DashboardShell
      title={
        <div className="flex items-center gap-4">
          <span>
            {t("welcome", { name: session?.user?.nickname || "User" })}
          </span>
          <Sparkles className="h-8 w-8 text-foreground/70 animate-pulse" />
        </div>
      }
      subtitle={t("overview.subtitle")}
      main={
        <div className="dashboard-glass-card group p-8 premium-noise">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-muted p-3 transition-colors shadow-sm ring-1 ring-border group-hover:bg-hover">
                <ListTodo className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <div className="text-lg font-bold text-foreground">
                  Tasks Overview
                </div>
                <div className="text-sm font-medium text-muted-foreground">
                  Manage your daily workflow efficiently
                </div>
              </div>
            </div>
          </div>
          <div className="relative rounded-2xl border border-border/70 bg-background/60 p-1">
            <TaskList
              selectedDate={overviewDate}
              onSelectedDateChange={setOverviewDate}
            />
          </div>
        </div>
      }
    />
  );
}
