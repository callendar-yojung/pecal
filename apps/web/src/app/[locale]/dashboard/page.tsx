"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { DashboardShell, MiniCalendar, TaskList } from "@/components/dashboard";

export default function DashboardPage() {
    const t = useTranslations("dashboard");
    const { data: session } = useSession();

    return (
        <DashboardShell
            title={t("welcome", { name: session?.user?.nickname || "User" })}
            subtitle={t("overview.subtitle")}
            main={
                <div className="dashboard-glass-card group p-8 transition hover:shadow-[0_16px_70px_rgba(15,23,42,0.08)]">
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Tasks</div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Today & upcoming</div>
                        </div>
                    </div>
                    <TaskList />
                </div>
            }
            side={
                <div className="dashboard-glass-card p-8">
                    <div className="mb-6">
                        <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Calendar</div>
                        <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Quick glance</div>
                    </div>
                    <MiniCalendar />
                </div>
            }
        />
    );
}
