"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import TaskFormPanel, {
  type TaskFormData,
} from "@/components/dashboard/TaskFormPanel";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function TaskCreatePage() {
  const t = useTranslations("dashboard.tasks");
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();

  const handleSave = async (taskData: TaskFormData) => {
    if (!currentWorkspace?.workspace_id) return;

    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: taskData.title,
        start_time: taskData.start_time,
        end_time: taskData.end_time,
        content: taskData.content,
        color: taskData.color,
        reminder_minutes: taskData.reminder_minutes ?? null,
        rrule: taskData.rrule ?? null,
        tag_ids: taskData.tag_ids,
        file_ids: taskData.file_ids,
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
    } else {
      const err = await response.json();
      alert(err.error || t("errorCreate") || "Failed to create task");
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="dashboard-glass-card premium-noise p-6 text-sm text-muted-foreground">
        {t("selectWorkspace") || "워크스페이스를 선택해주세요."}
      </div>
    );
  }

  return (
    <div className="dashboard-glass-card premium-noise p-3 md:p-5">
      <TaskFormPanel
        isOpen
        mode="create"
        variant="page"
        onClose={() => router.push("/dashboard/tasks")}
        onSave={handleSave}
        workspaceType={currentWorkspace.type}
        ownerId={currentWorkspace.owner_id}
      />
    </div>
  );
}
