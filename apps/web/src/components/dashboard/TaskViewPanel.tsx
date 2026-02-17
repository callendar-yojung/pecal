"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import RichTextEditor from "@/components/editor/RichTextEditor";
import {
  CalendarClock,
  Clock,
  FileText,
  PencilLine,
  Tag as TagIcon,
  Trash2,
} from "lucide-react";

export interface TaskViewData {
  id?: number;
  title: string;
  start_time: string;
  end_time: string;
  content: string;
  status?: "TODO" | "IN_PROGRESS" | "DONE";
  color?: string;
  tag_ids?: number[];
  created_at?: string;
  updated_at?: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
}

interface Tag {
  tag_id: number;
  name: string;
  color: string;
  owner_type?: "team" | "personal";
  owner_id?: number;
}

interface TaskAttachment {
  attachment_id: number;
  task_id: number;
  file_id: number;
  original_name: string;
  file_path: string;
  file_size_formatted: string;
  mime_type: string | null;
}

interface TaskViewPanelProps {
  task: TaskViewData;
  workspaceType?: "team" | "personal";
  ownerId?: number;
  onEdit?: () => void;
  onDelete?: (taskId: number) => void;
  onStatusChange?: (status: TaskViewData["status"]) => void;
  onExport?: () => void;
  showActions?: boolean;
  showTags?: boolean;
  showAttachments?: boolean;
  availableTags?: Tag[];
  attachmentsEndpoint?: string;
}

export default function TaskViewPanel({
  task,
  workspaceType,
  ownerId,
  onEdit,
  onDelete,
  onStatusChange,
  onExport,
  showActions = true,
  showTags = true,
  showAttachments = true,
  availableTags: availableTagsOverride,
  attachmentsEndpoint,
}: TaskViewPanelProps) {
  const t = useTranslations("dashboard.tasks.modal");
  const tStatus = useTranslations("dashboard.tasks.status");
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  useEffect(() => {
    if (availableTagsOverride) {
      setAvailableTags(availableTagsOverride);
      return;
    }
    if (!showTags || !workspaceType || !ownerId) return;
    const fetchTags = async () => {
      const res = await fetch(`/api/tags?owner_type=${workspaceType}&owner_id=${ownerId}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableTags(data.tags || []);
      }
    };
    fetchTags();
  }, [availableTagsOverride, showTags, workspaceType, ownerId]);

  useEffect(() => {
    if (!showAttachments || !task.id) return;
    const fetchAttachments = async () => {
      setLoadingAttachments(true);
      try {
        const endpoint = attachmentsEndpoint || `/api/tasks/attachments?task_id=${task.id}`;
        const response = await fetch(endpoint);
        if (response.ok) {
          const data = await response.json();
          setAttachments(data.attachments || []);
        }
      } finally {
        setLoadingAttachments(false);
      }
    };
    fetchAttachments();
  }, [attachmentsEndpoint, showAttachments, task.id]);

  const statusLabels: Record<NonNullable<TaskViewData["status"]>, string> = {
    TODO: tStatus("pending"),
    IN_PROGRESS: tStatus("in_progress"),
    DONE: tStatus("completed"),
  };

  const statusColors: Record<NonNullable<TaskViewData["status"]>, string> = {
    TODO: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    IN_PROGRESS: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    DONE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  };

  const statusOptions: Array<NonNullable<TaskViewData["status"]>> = ["TODO", "IN_PROGRESS", "DONE"];

  const formatDateTimeDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const parseContentJson = (value: string) => {
    if (!value) {
      return { type: "doc", content: [{ type: "paragraph" }] };
    }
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: value }] }] };
      }
    }
    return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: value }] }] };
  };

  return (
    <div className="w-full rounded-xl border border-border bg-popover p-6 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold text-popover-foreground">
              {task.title}
            </h2>
            {task.color && (
              <div
                className="w-4 h-4 rounded-full border border-border"
                style={{ backgroundColor: task.color }}
                title="태스크 색상"
              />
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {task.status && (
              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusColors[task.status]}`}>
                {statusLabels[task.status]}
              </span>
            )}
            {onStatusChange && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                {t("statusChange")}
                <select
                  value={task.status || "TODO"}
                  onChange={(e) => onStatusChange(e.target.value as TaskViewData["status"])}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      </div>

      {/* 상세 정보 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>
            {formatDateTimeDisplay(task.start_time)} - {formatDateTimeDisplay(task.end_time)}
          </span>
        </div>

        {task.created_by_name && (
          <div className="text-xs text-muted-foreground">
            {t("createdBy")}: {task.created_by_name}
            {task.created_at ? ` · ${formatDateTimeDisplay(task.created_at)}` : ""}
          </div>
        )}
        {task.updated_by_name &&
          task.updated_at &&
          task.created_at &&
          task.updated_at !== task.created_at && (
            <div className="text-xs text-muted-foreground">
              {t("updatedBy")}: {task.updated_by_name}
              {task.updated_at ? ` · ${formatDateTimeDisplay(task.updated_at)}` : ""}
            </div>
          )}

        {showTags && task.tag_ids && task.tag_ids.length > 0 && (
          <div>
          <h3 className="text-sm font-medium text-subtle-foreground mb-2 flex items-center gap-2">
            <TagIcon className="h-4 w-4" />
            {t("tags")}
          </h3>
            <div className="flex flex-wrap gap-2">
              {task.tag_ids.map(tagId => {
                const tag = availableTags.find(t => t.tag_id === tagId);
                if (!tag) return null;
                return (
                  <span
                    key={tag.tag_id}
                    className="rounded-lg px-3 py-1 text-xs font-medium"
                    style={{ backgroundColor: tag.color, color: "white" }}
                  >
                    {tag.name}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4">
          <h3 className="text-sm font-medium text-subtle-foreground mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t("content")}
          </h3>
          {task.content ? (
            <RichTextEditor
              initialContent={parseContentJson(task.content)}
              contentKey={`task-view-${task.id ?? "new"}`}
              readOnly
              showToolbar={false}
            />
          ) : (
            <div className="text-sm text-muted-foreground italic">
              {t("noContent")}
            </div>
          )}
        </div>

        {showAttachments && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-subtle-foreground mb-2">
            {t("attachments")}
          </h3>
          {loadingAttachments ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : attachments.length > 0 ? (
            <div className="space-y-2">
              {attachments.map((att) => (
                <div
                  key={att.attachment_id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                >
                  <a
                    href={att.file_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-foreground hover:text-blue-600 truncate flex-1"
                  >
                    <span className="truncate">{att.original_name}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      ({att.file_size_formatted})
                    </span>
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {t("noAttachments")}
            </p>
          )}
        </div>
        )}
      </div>

      {showActions && (
        <div className="flex justify-between mt-6 pt-4 border-t border-border">
          <div>
            {onDelete && task.id && (
              <button
                type="button"
                onClick={() => onDelete(task.id!)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors inline-flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {t("delete")}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {onExport && (
              <button
                type="button"
                onClick={onExport}
                className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted inline-flex items-center gap-2"
              >
                {t("export")}
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 inline-flex items-center gap-2"
              >
                <PencilLine className="h-4 w-4" />
                {t("edit")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
