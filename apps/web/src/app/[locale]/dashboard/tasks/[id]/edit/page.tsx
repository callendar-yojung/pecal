"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import TaskFormPanel, { type TaskFormData } from "@/components/dashboard/TaskFormPanel";

export default function TaskEditPage() {
  const t = useTranslations("dashboard.tasks");
  const router = useRouter();
  const params = useParams();
  const { currentWorkspace } = useWorkspace();
  const [task, setTask] = useState<TaskFormData | null>(null);
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

  const handleSave = async (taskData: TaskFormData) => {
    if (!currentWorkspace?.workspace_id || !taskId) return;

    const response = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_id: taskId,
        title: taskData.title,
        start_time: taskData.start_time,
        end_time: taskData.end_time,
        content: taskData.content,
        status: taskData.status,
        color: taskData.color,
        tag_ids: taskData.tag_ids,
      }),
    });

    if (response.ok) {
      router.push(`/dashboard/tasks/${taskId}`);
    } else {
      const err = await response.json();
      alert(err.error || t("errorUpdate") || "Failed to update task");
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
    <TaskFormPanel
      isOpen
      mode="edit"
      variant="page"
      initialData={task}
      onClose={() => router.push(`/dashboard/tasks/${taskId}`)}
      onSave={handleSave}
      workspaceType={currentWorkspace.type}
      ownerId={currentWorkspace.owner_id}
    />
  );
}
