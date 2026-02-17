"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import TaskViewPanel, { type TaskViewData } from "@/components/dashboard/TaskViewPanel";

type ExportError = "unauthorized" | "notFound" | "expired" | "unknown";

export default function TaskExportViewPage() {
  const t = useTranslations("dashboard.tasks.exportView");
  const params = useParams();
  const token = String(params?.token || "");
  const [task, setTask] = useState<TaskViewData | null>(null);
  const [workspaceInfo, setWorkspaceInfo] = useState<{ type: "team" | "personal"; owner_id: number } | null>(
    null
  );
  const [availableTags, setAvailableTags] = useState<Array<{ tag_id: number; name: string; color: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ExportError | null>(null);

  useEffect(() => {
    if (!token) return;
    const fetchExport = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/exports/tasks/${token}`);
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            setError("unauthorized");
          } else if (res.status === 410) {
            setError("expired");
          } else if (res.status === 404) {
            setError("notFound");
          } else {
            setError("unknown");
          }
          return;
        }
        const data = await res.json();
        setTask(data.task);
        setWorkspaceInfo(data.workspace || null);
        setAvailableTags(data.tags || []);
      } catch {
        setError("unknown");
      } finally {
        setLoading(false);
      }
    };
    fetchExport();
  }, [token]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 text-sm text-muted-foreground">
        {t("loading")}
      </div>
    );
  }

  if (error || !task) {
    const message =
      error === "unauthorized"
        ? t("unauthorized")
        : error === "expired"
          ? t("expired")
        : error === "notFound"
          ? t("notFound")
          : t("unknownError");
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 text-sm text-muted-foreground">
        {message}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <TaskViewPanel
        task={task}
        workspaceType={workspaceInfo?.type}
        ownerId={workspaceInfo?.owner_id}
        availableTags={availableTags}
        showActions={false}
        showTags
        showAttachments
        attachmentsEndpoint={`/api/exports/tasks/${token}/attachments`}
      />
    </div>
  );
}
