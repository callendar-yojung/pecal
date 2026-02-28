"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import RichTextEditor from "@/components/editor/RichTextEditor";

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
type OwnerType = "personal" | "team";
type TagItem = { tag_id: number; name: string; color?: string };
type PendingFile = {
  file_id: number;
  original_name: string;
  file_path: string;
  file_size: number;
  file_size_formatted: string;
  mime_type: string | null;
};
type TaskAttachment = {
  attachment_id: number;
  task_id: number;
  file_id: number;
  original_name: string;
  file_path: string;
  file_size: number;
  file_size_formatted: string;
  mime_type: string | null;
  created_at: string;
};

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };
const TASK_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#14B8A6",
  "#F43F5E",
  "#6B7280",
];

function defaultDateTime(offsetMinutes: number) {
  const date = new Date(Date.now() + offsetMinutes * 60_000);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function normalizeDateTimeLocal(raw: string | undefined) {
  if (!raw) return defaultDateTime(0);
  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (match) {
    const [, year, month, day, hour, minute] = match;
    return `${year}-${month}-${day}T${hour}:${minute}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return defaultDateTime(0);
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  const hh = String(parsed.getHours()).padStart(2, "0");
  const mm = String(parsed.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function buildDateTimeFromDateOnly(dateOnly: string, hour: number, minute: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return defaultDateTime(0);
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${dateOnly}T${hh}:${mm}`;
}

function parseTaskContent(raw: unknown) {
  if (typeof raw !== "string" || !raw.trim()) return EMPTY_DOC;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return EMPTY_DOC;
  }
}

function postToNative(message: { type: string; payload?: Record<string, unknown> }) {
  if (typeof window === "undefined") return;
  const bridge = (window as { ReactNativeWebView?: { postMessage?: (value: string) => void } }).ReactNativeWebView;
  if (!bridge?.postMessage) return;
  bridge.postMessage(JSON.stringify(message));
}

export default function MobileTaskEditorPage() {
  const search = useMemo(
    () =>
      new URLSearchParams(
        typeof window === "undefined" ? "" : window.location.search,
      ),
    [],
  );
  const token = search.get("token") ?? "";
  const mode = search.get("mode") === "edit" ? "edit" : "create";
  const taskId = Number(search.get("task_id") ?? "0");
  const workspaceId = Number(search.get("workspace_id") ?? "0");
  const ownerType = (search.get("owner_type") ?? "") as OwnerType;
  const ownerId = Number(search.get("owner_id") ?? "0");
  const theme = search.get("theme") === "dark" ? "dark" : "light";
  const initialDate = search.get("initial_date") ?? "";
  const alarmEnabledParam = search.get("alarm_enabled");
  const defaultReminderFromSettings = useMemo(
    () => (alarmEnabledParam === "0" || alarmEnabledParam === "false" ? null : 10),
    [alarmEnabledParam],
  );

  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState(defaultDateTime(0));
  const [endTime, setEndTime] = useState(defaultDateTime(30));
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [color, setColor] = useState("#3B82F6");
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(
    defaultReminderFromSettings,
  );
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [content, setContent] = useState<Record<string, unknown>>(EMPTY_DOC);
  const [editorKey, setEditorKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(mode === "edit");
  const [message, setMessage] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const canCreate = !!token && workspaceId > 0;
  const canLoadTags =
    !!token &&
    ownerId > 0 &&
    (ownerType === "team" || ownerType === "personal");
  const canEdit = !!token && mode === "edit" && taskId > 0;

  const fetchAttachments = async () => {
    if (!canEdit) return;
    setLoadingAttachments(true);
    try {
      const response = await fetch(`/api/tasks/attachments?task_id=${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const data = (await response.json()) as { attachments?: TaskAttachment[] };
      setAttachments(data.attachments ?? []);
    } finally {
      setLoadingAttachments(false);
    }
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    if (!canLoadTags) return;
    void (async () => {
      const res = await fetch(
        `/api/tags?owner_type=${ownerType}&owner_id=${ownerId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { tags?: TagItem[] };
      setTags(data.tags ?? []);
    })();
  }, [canLoadTags, ownerId, ownerType, token]);

  useEffect(() => {
    if (!canEdit) return;
    void (async () => {
      setLoading(true);
      setMessage("");
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setMessage(
            (data as { error?: string }).error ??
              "일정 정보를 불러오지 못했습니다.",
          );
          return;
        }
        const data = (await res.json()) as {
          task?: {
            title?: string;
            start_time?: string;
            end_time?: string;
            status?: TaskStatus;
            color?: string;
            reminder_minutes?: number | null;
            tag_ids?: number[];
            content?: string | null;
          };
        };
        const task = data.task;
        if (!task) {
          setMessage("일정을 찾을 수 없습니다.");
          return;
        }
        setTitle(task.title ?? "");
        setStartTime(normalizeDateTimeLocal(task.start_time));
        setEndTime(normalizeDateTimeLocal(task.end_time));
        setStatus(task.status ?? "TODO");
        setColor(task.color ?? "#3B82F6");
        setReminderMinutes(
          typeof task.reminder_minutes === "number"
            ? task.reminder_minutes
            : null,
        );
        setTagIds(Array.isArray(task.tag_ids) ? task.tag_ids : []);
        setContent(parseTaskContent(task.content));
        setEditorKey((prev) => prev + 1);
      } finally {
        setLoading(false);
      }
    })();
  }, [canEdit, taskId, token]);

  useEffect(() => {
    void fetchAttachments();
  }, [canEdit, taskId, token]);

  useEffect(() => {
    if (mode !== "create") return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(initialDate)) return;
    setStartTime(buildDateTimeFromDateOnly(initialDate, 9, 0));
    setEndTime(buildDateTimeFromDateOnly(initialDate, 9, 30));
  }, [initialDate, mode]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === "edit") {
      if (!canEdit) {
        setMessage("인증 또는 일정 정보가 없습니다.");
        return;
      }
    } else if (!canCreate) {
      setMessage("인증 또는 워크스페이스 정보가 없습니다.");
      return;
    }

    if (!title.trim()) {
      setMessage("제목을 입력하세요.");
      return;
    }
    if (new Date(startTime) >= new Date(endTime)) {
      setMessage("종료 시간이 시작 시간보다 늦어야 합니다.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      const isEdit = mode === "edit";
      const res = await fetch("/api/tasks", {
        method: isEdit ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          isEdit
            ? {
                task_id: taskId,
                title: title.trim(),
                start_time: startTime,
                end_time: endTime,
                status,
                color,
                reminder_minutes: reminderMinutes,
                tag_ids: tagIds,
                content: JSON.stringify(content),
              }
            : {
                workspace_id: workspaceId,
                title: title.trim(),
                start_time: startTime,
                end_time: endTime,
                status,
                color,
                reminder_minutes: reminderMinutes,
                tag_ids: tagIds,
                file_ids: pendingFiles.map((file) => file.file_id),
                content: JSON.stringify(content),
              },
        ),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(
          (data as { error?: string }).error ??
            (isEdit ? "수정에 실패했습니다." : "등록에 실패했습니다."),
        );
        return;
      }

      const responseData = (await res.json().catch(() => ({}))) as { taskId?: number };
      const savedTaskId = isEdit ? taskId : Number(responseData.taskId ?? 0);
      if (savedTaskId > 0 && isEdit && pendingFiles.length > 0) {
        await Promise.all(
          pendingFiles.map((file) =>
            fetch("/api/tasks/attachments", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                task_id: savedTaskId,
                file_id: file.file_id,
              }),
            }),
          ),
        );
        setPendingFiles([]);
        await fetchAttachments();
      }
      if (Number.isFinite(savedTaskId) && savedTaskId > 0) {
        postToNative({
          type: "task_saved",
          payload: {
            mode: isEdit ? "edit" : "create",
            taskId: savedTaskId,
          },
        });
      }

      if (isEdit) {
        setMessage("일정이 수정되었습니다.");
      } else {
        setMessage("일정이 등록되었습니다.");
        setTitle("");
        setStartTime(defaultDateTime(0));
        setEndTime(defaultDateTime(30));
        setStatus("TODO");
        setColor("#3B82F6");
        setReminderMinutes(defaultReminderFromSettings);
        setTagIds([]);
        setContent(EMPTY_DOC);
        setPendingFiles([]);
        setAttachments([]);
        setEditorKey((prev) => prev + 1);
      }
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !token || !ownerType || !ownerId) return;

    setUploadingFile(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("owner_type", ownerType);
      formData.append("owner_id", String(ownerId));

      const response = await fetch("/api/files/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = (await response.json()) as {
        file?: PendingFile;
        error?: string;
      };
      if (!response.ok || !data.file) {
        setUploadError(data.error ?? "파일 업로드에 실패했습니다.");
        return;
      }
      setPendingFiles((prev) => [data.file as PendingFile, ...prev]);
    } catch {
      setUploadError("파일 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploadingFile(false);
      event.target.value = "";
    }
  };

  const handleRemovePendingFile = async (fileId: number) => {
    try {
      await fetch(`/api/files?id=${fileId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setPendingFiles((prev) => prev.filter((f) => f.file_id !== fileId));
    } catch {
      setUploadError("파일 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    const ok = typeof window === "undefined" ? true : window.confirm("첨부파일을 삭제할까요?");
    if (!ok) return;
    try {
      const response = await fetch(
        `/api/tasks/attachments?attachment_id=${attachmentId}&delete_file=true`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) {
        setUploadError("첨부파일 삭제에 실패했습니다.");
        return;
      }
      setAttachments((prev) => prev.filter((a) => a.attachment_id !== attachmentId));
    } catch {
      setUploadError("첨부파일 삭제 중 오류가 발생했습니다.");
    }
  };

  const removeTask = async () => {
    if (!canEdit) {
      setMessage("삭제할 일정 정보를 찾을 수 없습니다.");
      return;
    }
    const ok = typeof window === "undefined" ? true : window.confirm("정말 삭제할까요?");
    if (!ok) return;

    try {
      setSaving(true);
      setMessage("");
      const res = await fetch(`/api/tasks?task_id=${taskId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage((data as { error?: string }).error ?? "삭제에 실패했습니다.");
        return;
      }

      postToNative({
        type: "task_deleted",
        payload: { taskId },
      });
      setMessage("일정이 삭제되었습니다.");
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-background p-4 text-foreground">
      <section className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h1 className="text-2xl font-bold">
          {mode === "edit" ? "일정 수정" : "새 일정 등록"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          모바일 WebView 전체 페이지 모드
        </p>
      </section>

      <form
        onSubmit={submit}
        className="mx-auto mt-4 max-w-3xl rounded-2xl border border-border bg-card p-4 shadow-sm"
      >
        {loading ? (
          <p className="mb-3 text-sm text-muted-foreground">불러오는 중...</p>
        ) : null}

        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목"
            className="w-full rounded-xl border border-border bg-background px-3 py-3 text-base outline-none focus:border-primary"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              시작
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 outline-none focus:border-primary"
              />
            </label>
            <label className="text-sm font-semibold">
              종료
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 outline-none focus:border-primary"
              />
            </label>
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            className="w-full rounded-xl border border-border bg-background px-3 py-3 outline-none focus:border-primary"
          >
            <option value="TODO">TODO</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="DONE">DONE</option>
          </select>

          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-sm font-semibold">색상</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {TASK_COLORS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  className={`h-8 w-8 rounded-full border-2 ${color === swatch ? "border-foreground" : "border-transparent"}`}
                  style={{ backgroundColor: swatch }}
                  aria-label={`color-${swatch}`}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border border-border bg-background"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-sm font-semibold">알림</p>
            <select
              value={reminderMinutes === null ? "" : String(reminderMinutes)}
              onChange={(e) =>
                setReminderMinutes(
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 outline-none focus:border-primary"
            >
              <option value="">알림 없음</option>
              <option value="0">정시</option>
              <option value="5">5분 전</option>
              <option value="10">10분 전</option>
              <option value="15">15분 전</option>
              <option value="30">30분 전</option>
              <option value="60">1시간 전</option>
              <option value="1440">1일 전</option>
            </select>
          </div>

          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-sm font-semibold">태그</p>
            {!tags.length ? (
              <p className="mt-2 text-sm text-muted-foreground">
                사용 가능한 태그가 없습니다.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const selected = tagIds.includes(tag.tag_id);
                  return (
                    <button
                      key={tag.tag_id}
                      type="button"
                      onClick={() =>
                        setTagIds((prev) =>
                          selected
                            ? prev.filter((id) => id !== tag.tag_id)
                            : [...prev, tag.tag_id],
                        )
                      }
                      className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                        selected
                          ? "border-primary bg-primary/15 text-foreground"
                          : "border-border bg-card text-muted-foreground"
                      }`}
                      style={
                        selected
                          ? { borderColor: tag.color ?? undefined }
                          : undefined
                      }
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-sm font-semibold">첨부파일</p>
            <input
              type="file"
              onChange={handleFileUpload}
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            {uploadingFile ? (
              <p className="mt-2 text-xs text-muted-foreground">업로드 중...</p>
            ) : null}
            {uploadError ? (
              <p className="mt-2 text-xs text-red-500">{uploadError}</p>
            ) : null}
            <div className="mt-2 space-y-2">
              {pendingFiles.map((file) => (
                <div
                  key={`pending-${file.file_id}`}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs"
                >
                  <span className="truncate">{file.original_name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemovePendingFile(file.file_id)}
                    className="text-red-500"
                  >
                    삭제
                  </button>
                </div>
              ))}
              {attachments.map((att) => (
                <div
                  key={att.attachment_id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs"
                >
                  <span className="truncate">{att.original_name}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteAttachment(att.attachment_id)}
                    className="text-red-500"
                  >
                    삭제
                  </button>
                </div>
              ))}
              {!uploadingFile &&
              pendingFiles.length === 0 &&
              attachments.length === 0 &&
              !loadingAttachments ? (
                <p className="text-xs text-muted-foreground">첨부된 파일이 없습니다.</p>
              ) : null}
              {loadingAttachments ? (
                <p className="text-xs text-muted-foreground">첨부파일 불러오는 중...</p>
              ) : null}
            </div>
          </div>

          <RichTextEditor
            initialContent={content}
            contentKey={editorKey}
            onChange={(next) => setContent(next as Record<string, unknown>)}
            placeholder="내용"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="submit"
            disabled={saving || loading}
            className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving
              ? mode === "edit"
                ? "저장 중..."
                : "등록 중..."
              : mode === "edit"
                ? "일정 저장"
                : "일정 등록"}
          </button>
          {mode === "edit" ? (
            <button
              type="button"
              disabled={saving || loading}
              onClick={removeTask}
              className="w-full rounded-xl border border-red-300 bg-red-50 px-4 py-3 font-semibold text-red-700 disabled:opacity-60"
            >
              삭제
            </button>
          ) : null}
        </div>

        {message ? (
          <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        ) : null}
      </form>
    </main>
  );
}
