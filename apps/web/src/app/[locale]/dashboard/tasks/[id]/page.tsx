"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import TaskViewPanel, { type TaskViewData } from "@/components/dashboard/TaskViewPanel";

export default function TaskDetailPage() {
  const t = useTranslations("dashboard.tasks");
  const router = useRouter();
  const params = useParams();
  const { currentWorkspace } = useWorkspace();
  const [task, setTask] = useState<TaskViewData | null>(null);
  const [loading, setLoading] = useState(true);

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
        } else {
          alert(data.error || "Task not found");
          router.push("/dashboard/tasks");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [currentWorkspace?.workspace_id, taskId]);

  const handleDelete = async (id: number) => {
    const response = await fetch(`/api/tasks?task_id=${id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      router.push("/dashboard/tasks");
    } else {
      const err = await response.json();
      alert(err.error || t("errorDelete") || "Failed to delete task");
    }
  };

  const handleStatusChange = async (status: TaskViewData["status"]) => {
    if (!task) return;
    setTask((prev) => (prev ? { ...prev, status } : prev));

    const response = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_id: taskId,
        status,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      alert(err.error || t("errorUpdate") || "Failed to update task");
      setTask((prev) => (prev ? { ...prev, status: task.status } : prev));
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {t("selectWorkspace") || "워크스페이스를 선택해주세요."}
      </div>
    );
  }

  if (loading || !task) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {t("loading")}
      </div>
    );
  }

  return (
    <TaskViewPanel
      task={task}
      workspaceType={currentWorkspace.type}
      ownerId={currentWorkspace.owner_id}
      onEdit={() => router.push(`/dashboard/tasks/${taskId}/edit`)}
      onExport={() => router.push(`/dashboard/tasks/${taskId}/export`)}
      onDelete={handleDelete}
      onStatusChange={handleStatusChange}
    />
  );
}
