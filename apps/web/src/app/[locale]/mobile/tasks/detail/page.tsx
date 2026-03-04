"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TaskViewPanel, {
  type TaskViewData,
} from "@/components/dashboard/TaskViewPanel";

type TagItem = {
  tag_id: number;
  name: string;
  color: string;
};

type TaskAttachment = {
  attachment_id: number;
  file_id: number;
  original_name: string;
  file_size_formatted?: string;
  file_path?: string;
};

type BridgeInbound =
  | {
      channel?: string;
      type?: "set-task";
      payload?: {
        task?: Partial<TaskViewData> & {
          is_all_day?: boolean;
          reminder_minutes?: number | null;
          rrule?: string | null;
          theme?: "light" | "dark";
        };
        auth_token?: string;
        tags?: TagItem[];
      };
    }
  | Record<string, unknown>;

type DetailBridgePayload = {
  task?: Partial<TaskViewData> & {
    is_all_day?: boolean;
    reminder_minutes?: number | null;
    rrule?: string | null;
    theme?: "light" | "dark";
  };
  auth_token?: string;
  tags?: TagItem[];
};

type BridgeOutbound =
  | { channel: "pecal-task-detail"; type: "ready" }
  | {
      channel: "pecal-task-detail";
      type: "height";
      payload: { height: number };
    }
  | {
      channel: "pecal-task-detail";
      type: "error";
      payload: { message: string };
    };

function postToNative(message: BridgeOutbound) {
  const serialized = JSON.stringify(message);
  if (
    typeof window !== "undefined" &&
    (window as any).ReactNativeWebView?.postMessage
  ) {
    (window as any).ReactNativeWebView.postMessage(serialized);
  }
}

function resolveFileUrl(filePath: string) {
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }
  if (filePath.startsWith("/uploads/")) {
    return filePath;
  }
  const bucket = process.env.NEXT_PUBLIC_AWS_S3_BUCKET || "";
  const region = process.env.NEXT_PUBLIC_AWS_REGION || "";
  if (bucket && region) {
    return `https://${bucket}.s3.${region}.amazonaws.com/${filePath}`;
  }
  return filePath;
}

function applyTheme(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);

  const palette =
    theme === "dark"
      ? {
          "--background": "#07090E",
          "--foreground": "#F8FAFF",
          "--card": "#10131B",
          "--card-foreground": "#F8FAFF",
          "--popover": "#10131B",
          "--popover-foreground": "#F8FAFF",
          "--primary": "#7B88FF",
          "--primary-foreground": "#07090E",
          "--secondary": "#171C28",
          "--secondary-foreground": "#F8FAFF",
          "--muted": "#171C28",
          "--muted-foreground": "#8D98AF",
          "--border": "#202637",
          "--input": "#202637",
          "--ring": "#4C5A78",
          "--page-background": "#07090E",
          "--dashboard-background": "#07090E",
          "--sidebar-background": "#0D111A",
          "--sidebar-foreground": "#F8FAFF",
          "--sidebar-border": "#202637",
          "--subtle": "#171C28",
          "--subtle-foreground": "#8D98AF",
          "--hover": "#1B2434",
          "--active": "#273247",
        }
      : {
          "--background": "#F2F4FB",
          "--foreground": "#0F172A",
          "--card": "#FFFFFF",
          "--card-foreground": "#0F172A",
          "--popover": "#FFFFFF",
          "--popover-foreground": "#0F172A",
          "--primary": "#5B6CFF",
          "--primary-foreground": "#FFFFFF",
          "--secondary": "#ECEFF7",
          "--secondary-foreground": "#0F172A",
          "--muted": "#ECEFF7",
          "--muted-foreground": "#7C8599",
          "--border": "#E5EAF5",
          "--input": "#E5EAF5",
          "--ring": "#AAB4CB",
          "--page-background": "#F2F4FB",
          "--dashboard-background": "#F2F4FB",
          "--sidebar-background": "#FFFFFF",
          "--sidebar-foreground": "#0F172A",
          "--sidebar-border": "#E5EAF5",
          "--subtle": "#ECEFF7",
          "--subtle-foreground": "#7C8599",
          "--hover": "#E8ECF8",
          "--active": "#DCE3F5",
        };
  Object.entries(palette).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export default function MobileTaskDetailPage() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [task, setTask] = useState<TaskViewData | null>(null);
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const [authToken, setAuthToken] = useState("");
  const [availableTags, setAvailableTags] = useState<TagItem[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  const handleOpenAttachment = useCallback((item: TaskAttachment) => {
    if (!item.file_path) {
      window.alert("파일 경로를 찾을 수 없습니다.");
      return;
    }
    const url = resolveFileUrl(item.file_path);
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const handleDownloadAttachment = useCallback((item: TaskAttachment) => {
    if (!item.file_path) {
      window.alert("파일 경로를 찾을 수 없습니다.");
      return;
    }
    const url = resolveFileUrl(item.file_path);
    const link = document.createElement("a");
    link.href = url;
    link.download = item.original_name || "attachment";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleInbound = useCallback((raw: unknown) => {
    try {
      const parsed =
        typeof raw === "string"
          ? (JSON.parse(raw) as BridgeInbound)
          : (raw as BridgeInbound);
      if (!parsed || (parsed as any).channel !== "pecal-task-detail") return;
      if ((parsed as any).type !== "set-task") return;

      const payload = (parsed as { payload?: DetailBridgePayload }).payload;
      if (!payload?.task) return;
      if (payload.task.theme === "dark" || payload.task.theme === "light") {
        setTheme(payload.task.theme);
      }
      setAuthToken(String(payload.auth_token ?? ""));
      setAvailableTags(
        Array.isArray(payload.tags)
          ? payload.tags.map((tag) => ({
              tag_id: Number(tag.tag_id),
              name: String(tag.name ?? ""),
              color: tag.color ?? "#3B82F6",
            }))
          : [],
      );
      setTask({
        id: payload.task.id,
        title: String(payload.task.title ?? ""),
        start_time: String(payload.task.start_time ?? ""),
        end_time: String(payload.task.end_time ?? ""),
        content: String(payload.task.content ?? ""),
        status: (payload.task.status as TaskViewData["status"]) ?? "TODO",
        color: payload.task.color,
        reminder_minutes: payload.task.reminder_minutes ?? null,
        rrule: payload.task.rrule ?? null,
        tag_ids: payload.task.tag_ids ?? [],
      });
    } catch (error) {
      postToNative({
        channel: "pecal-task-detail",
        type: "error",
        payload: {
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }, []);

  useEffect(() => {
    if (!task?.id || !authToken) {
      setAttachments([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingAttachments(true);
      try {
        const response = await fetch(`/api/tasks/attachments?task_id=${task.id}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!response.ok) {
          if (!cancelled) setAttachments([]);
          return;
        }
        const data = (await response.json()) as { attachments?: TaskAttachment[] };
        if (!cancelled) {
          setAttachments(Array.isArray(data.attachments) ? data.attachments : []);
        }
      } finally {
        if (!cancelled) setLoadingAttachments(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken, task?.id]);

  useEffect(() => {
    const rootTheme = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    setTheme(rootTheme);
  }, []);

  useEffect(() => {
    if (!theme) return;
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      if (!root.classList.contains(theme)) {
        applyTheme(theme);
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [theme]);

  useEffect(() => {
    const onWindowMessage = (event: MessageEvent) => handleInbound(event.data);
    const onDocumentMessage = (event: Event) => {
      const data = (event as unknown as { data?: unknown }).data;
      handleInbound(data);
    };

    window.addEventListener("message", onWindowMessage);
    document.addEventListener("message", onDocumentMessage);
    postToNative({ channel: "pecal-task-detail", type: "ready" });

    return () => {
      window.removeEventListener("message", onWindowMessage);
      document.removeEventListener("message", onDocumentMessage);
    };
  }, [handleInbound]);

  useEffect(() => {
    if (
      !rootRef.current ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    )
      return;

    const emitHeight = () => {
      const root = rootRef.current;
      if (!root) return;

      const rootRectHeight = Math.ceil(
        root.getBoundingClientRect().height || 0,
      );
      const rootScrollHeight = Math.ceil(root.scrollHeight || 0);
      const bodyScrollHeight = Math.ceil(document.body?.scrollHeight || 0);
      const docScrollHeight = Math.ceil(
        document.documentElement?.scrollHeight || 0,
      );
      const height = Math.max(
        300,
        rootRectHeight,
        rootScrollHeight,
        bodyScrollHeight,
        docScrollHeight,
      );
      postToNative({
        channel: "pecal-task-detail",
        type: "height",
        payload: { height },
      });
    };

    emitHeight();
    const rafId = window.requestAnimationFrame(emitHeight);
    const timeoutId = window.setTimeout(emitHeight, 180);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => emitHeight());
      observer.observe(rootRef.current);
      observer.observe(document.body);
      observer.observe(document.documentElement);
    }

    window.addEventListener("load", emitHeight);
    window.addEventListener("resize", emitHeight);

    return () => {
      if (observer) observer.disconnect();
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      window.removeEventListener("load", emitHeight);
      window.removeEventListener("resize", emitHeight);
    };
  }, []);

  if (!theme) return <div className="bg-transparent p-0" />;

  return (
    <div ref={rootRef} className="bg-background px-3 py-3">
      {task ? (
        <div className="mx-auto max-w-3xl space-y-3">
          <TaskViewPanel
            task={task}
            showActions={false}
            showTags
            availableTags={availableTags}
            showAttachments={false}
          />
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground">첨부파일</h3>
            {loadingAttachments ? (
              <p className="text-sm text-muted-foreground">불러오는 중...</p>
            ) : attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">첨부파일이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {attachments.map((item) => (
                  <div
                    key={item.attachment_id}
                    className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenAttachment(item)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.original_name}
                      </p>
                    </button>
                    <div className="ml-3 flex shrink-0 items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {item.file_size_formatted ?? ""}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleOpenAttachment(item)}
                        className="rounded-md border border-border px-2 py-1 text-xs text-foreground"
                      >
                        열기
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadAttachment(item)}
                        className="rounded-md border border-border px-2 py-1 text-xs text-foreground"
                      >
                        다운로드
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          일정 정보를 불러오는 중...
        </div>
      )}
    </div>
  );
}
