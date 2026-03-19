"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type { TaskViewData } from "@/components/dashboard/TaskViewPanel";

function normalizeDateTime(value: string) {
  if (!value) return new Date(NaN);
  const normalized = value.includes(" ") ? value.replace(" ", "T") : value;
  return new Date(normalized);
}

function formatDateInput(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toMysqlDatetime(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export default function TaskDuplicatePage() {
  const t = useTranslations("dashboard.tasks");
  const tModal = useTranslations("dashboard.tasks.modal");
  const router = useRouter();
  const params = useParams();
  const { currentWorkspace } = useWorkspace();

  const [task, setTask] = useState<TaskViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());

  const taskId = Number(params?.id);

  useEffect(() => {
    if (!currentWorkspace?.workspace_id || Number.isNaN(taskId)) return;

    const fetchTask = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/tasks/${taskId}`);
        const data = await res.json();
        if (res.ok && data?.task) {
          setTask(data.task);
          const sourceStart = normalizeDateTime(data.task.start_time);
          const sourceEnd = normalizeDateTime(data.task.end_time);
          if (!Number.isNaN(sourceStart.getTime())) setStartDate(sourceStart);
          if (!Number.isNaN(sourceEnd.getTime())) setEndDate(sourceEnd);
        } else {
          alert(data.error || "Task not found");
          router.push("/dashboard/tasks");
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchTask();
  }, [currentWorkspace?.workspace_id, taskId, router]);

  const sourceStart = useMemo(() => normalizeDateTime(task?.start_time ?? ""), [task?.start_time]);
  const sourceEnd = useMemo(() => normalizeDateTime(task?.end_time ?? ""), [task?.end_time]);

  const onStartDateChange = (value: string) => {
    const next = normalizeDateTime(`${value}T00:00:00`);
    if (Number.isNaN(next.getTime())) return;
    setStartDate(next);
    if (next > endDate) setEndDate(next);
  };

  const onEndDateChange = (value: string) => {
    const next = normalizeDateTime(`${value}T00:00:00`);
    if (Number.isNaN(next.getTime())) return;
    setEndDate(next);
    if (next < startDate) setStartDate(next);
  };

  const duplicateTask = async () => {
    if (!task || !currentWorkspace?.workspace_id || saving) return;
    if (Number.isNaN(sourceStart.getTime()) || Number.isNaN(sourceEnd.getTime())) {
      alert(t("errorCreate") || "Failed to create task");
      return;
    }

    const clonedStart = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      sourceStart.getHours(),
      sourceStart.getMinutes(),
      sourceStart.getSeconds(),
    );

    const clonedEnd = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate(),
      sourceEnd.getHours(),
      sourceEnd.getMinutes(),
      sourceEnd.getSeconds(),
    );

    if (clonedEnd <= clonedStart) {
      alert(tModal("endTimeBeforeStart"));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: task.title,
          start_time: toMysqlDatetime(clonedStart),
          end_time: toMysqlDatetime(clonedEnd),
          content: task.content || "",
          color: task.color || "#3B82F6",
          reminder_minutes: task.reminder_minutes ?? null,
          tag_ids: task.tag_ids ?? [],
          status: task.status ?? "TODO",
          workspace_id: currentWorkspace.workspace_id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.taskId) {
          router.push(`/dashboard/tasks/${data.taskId}`);
          return;
        }
        router.push("/dashboard/tasks");
        return;
      }

      const err = await response.json();
      alert(err.error || t("errorCreate") || "Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="dashboard-glass-card premium-noise p-6 text-sm text-muted-foreground">
        {t("selectWorkspace") || "워크스페이스를 선택해주세요."}
      </div>
    );
  }

  if (loading || !task) {
    return (
      <div className="dashboard-glass-card premium-noise p-6 text-sm text-muted-foreground">
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="dashboard-glass-card premium-noise p-3 md:p-5">
      <div className="mx-auto max-w-2xl space-y-4 rounded-xl border border-border bg-popover p-5">
        <h2 className="text-xl font-semibold text-popover-foreground">{tModal("duplicateTitle")}</h2>
        <p className="text-sm text-muted-foreground">{tModal("duplicateDescription")}</p>

        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-sm font-medium text-foreground">{task.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {task.start_time} - {task.end_time}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-subtle-foreground">{tModal("duplicateStartDate")}</span>
            <input
              type="date"
              value={formatDateInput(startDate)}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="h-10 rounded-lg border border-input bg-background px-3 text-foreground outline-none ring-offset-background focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-subtle-foreground">{tModal("duplicateEndDate")}</span>
            <input
              type="date"
              value={formatDateInput(endDate)}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="h-10 rounded-lg border border-input bg-background px-3 text-foreground outline-none ring-offset-background focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/tasks/${taskId}`)}
            className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {tModal("cancel")}
          </button>
          <button
            type="button"
            onClick={() => void duplicateTask()}
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? t("loading") : tModal("duplicateCreate")}
          </button>
        </div>
      </div>
    </div>
  );
}

