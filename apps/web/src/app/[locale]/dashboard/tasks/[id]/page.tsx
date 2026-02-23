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
      <TaskViewPanel
        task={task}
        workspaceType={currentWorkspace.type}
        ownerId={currentWorkspace.owner_id}
        onEdit={() => router.push(`/dashboard/tasks/${taskId}/edit`)}
        onExport={() => router.push(`/dashboard/tasks/${taskId}/export`)}
      />
    </div>
  );
}
