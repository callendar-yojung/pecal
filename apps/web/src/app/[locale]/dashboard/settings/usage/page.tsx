"use client";

import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useEffect, useState } from "react";

interface UsageData {
  workspace: {
    id: number;
    name: string;
    type: "personal" | "team";
  };
  plan: {
    name: string;
    max_storage_mb: number;
    max_file_size_mb: number;
    max_members: number;
  };
  storage: {
    used_bytes: number;
    limit_bytes: number;
    used_formatted: string;
    limit_formatted: string;
    percentage: number;
    file_count: number;
  };
  members: {
    current: number;
    max: number;
    percentage: number;
  };
  tasks: {
    total: number;
    thisMonth: {
      created: number;
      completed: number;
      todo: number;
      inProgress: number;
    };
  };
}

export default function UsagePage() {
  const t = useTranslations("dashboard.settings.usage");
  const { currentWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspace) return;

    const fetchUsageData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/me/usage?workspace_id=${currentWorkspace.workspace_id}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch usage data");
        }
        const data = await response.json();
        setUsageData(data);
      } catch (err) {
        console.error("Error fetching usage:", err);
        setError(t("loadError"));
      } finally {
        setLoading(false);
      }
    };

    fetchUsageData();
  }, [currentWorkspace, t]);

  if (workspaceLoading || loading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton */}
        <div className="animate-pulse space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-card p-6"
            >
              <div className="h-6 w-32 rounded bg-muted" />
              <div className="mt-2 h-4 w-48 rounded bg-muted" />
              <div className="mt-6 h-2 w-full rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-6 text-destructive">
        {error}
      </div>
    );
  }

  if (!usageData) {
    return null;
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-600";
    if (percentage >= 70) return "bg-yellow-600";
    return "bg-blue-600";
  };

  return (
    <div className="space-y-6">
      {/* 플랜 정보 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">
              {t("currentPlan")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {usageData.workspace.name}
            </p>
          </div>
          <div className="rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {usageData.plan.name}
          </div>
        </div>
      </div>

      {/* 스토리지 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-card-foreground">
          {t("storage")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("storageDesc")}
        </p>

        <div className="mt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {usageData.storage.used_formatted} / {usageData.storage.limit_formatted}
            </span>
            <span className="text-muted-foreground">
              {usageData.storage.percentage}%
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${getProgressColor(usageData.storage.percentage)}`}
              style={{ width: `${Math.min(usageData.storage.percentage, 100)}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">{t("files")}</p>
              <p className="font-medium text-card-foreground">
                {usageData.storage.file_count} {t("fileCount")}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("maxFileSize")}</p>
              <p className="font-medium text-card-foreground">
                {usageData.plan.max_file_size_mb} MB
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 팀 멤버 (팀 워크스페이스인 경우에만 표시) */}
      {usageData.workspace.type === "team" && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-card-foreground">
            {t("teamMembers")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("teamMembersDesc")}
          </p>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {usageData.members.current} / {usageData.members.max} {t("members")}
              </span>
              <span className="text-muted-foreground">
                {usageData.members.percentage}%
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${getProgressColor(usageData.members.percentage)}`}
                style={{ width: `${Math.min(usageData.members.percentage, 100)}%` }}
              />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm">
                <span className="text-2xl font-bold text-card-foreground">
                  {usageData.members.current}
                </span>
                <span className="ml-1 text-muted-foreground">
                  / {usageData.members.max} {t("members")}
                </span>
              </div>
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                {t("inviteMember")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 태스크 통계 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-card-foreground">
          {t("activity")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("activityDesc")}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-subtle p-4">
            <p className="text-sm text-muted-foreground">{t("tasksCreated")}</p>
            <p className="mt-1 text-2xl font-bold text-card-foreground">
              {usageData.tasks.thisMonth.created}
            </p>
            <p className="text-xs text-muted-foreground">{t("thisMonth")}</p>
          </div>
          <div className="rounded-lg bg-subtle p-4">
            <p className="text-sm text-muted-foreground">{t("tasksCompleted")}</p>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {usageData.tasks.thisMonth.completed}
            </p>
            <p className="text-xs text-muted-foreground">{t("thisMonth")}</p>
          </div>
          <div className="rounded-lg bg-subtle p-4">
            <p className="text-sm text-muted-foreground">{t("tasksTodo")}</p>
            <p className="mt-1 text-2xl font-bold text-yellow-600">
              {usageData.tasks.thisMonth.todo}
            </p>
            <p className="text-xs text-muted-foreground">{t("thisMonth")}</p>
          </div>
          <div className="rounded-lg bg-subtle p-4">
            <p className="text-sm text-muted-foreground">{t("tasksInProgress")}</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">
              {usageData.tasks.thisMonth.inProgress}
            </p>
            <p className="text-xs text-muted-foreground">{t("thisMonth")}</p>
          </div>
        </div>

        <div className="mt-6 rounded-lg bg-subtle p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{t("totalTasks")}</p>
            <p className="text-xl font-bold text-card-foreground">
              {usageData.tasks.total}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
