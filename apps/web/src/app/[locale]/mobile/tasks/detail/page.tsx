"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import TaskViewPanel, { type TaskViewData } from "@/components/dashboard/TaskViewPanel";

type BridgeInbound =
  | {
      channel?: string;
      type?: "set-task";
      payload?: {
        task?: (Partial<TaskViewData> & {
          is_all_day?: boolean;
          reminder_minutes?: number | null;
          rrule?: string | null;
          theme?: "light" | "dark";
        });
      };
    }
  | Record<string, unknown>;

type BridgeOutbound =
  | { channel: "pecal-task-detail"; type: "ready" }
  | { channel: "pecal-task-detail"; type: "height"; payload: { height: number } }
  | { channel: "pecal-task-detail"; type: "error"; payload: { message: string } };

function postToNative(message: BridgeOutbound) {
  const serialized = JSON.stringify(message);
  if (typeof window !== "undefined" && (window as any).ReactNativeWebView?.postMessage) {
    (window as any).ReactNativeWebView.postMessage(serialized);
  }
}

function applyTheme(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
}

export default function MobileTaskDetailPage() {
  const searchParams = useSearchParams();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [task, setTask] = useState<TaskViewData | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const handleInbound = useCallback((raw: unknown) => {
    try {
      const parsed = typeof raw === "string" ? (JSON.parse(raw) as BridgeInbound) : (raw as BridgeInbound);
      if (!parsed || (parsed as any).channel !== "pecal-task-detail") return;
      if ((parsed as any).type !== "set-task") return;

      const payload = (parsed as any).payload as
        | {
            task?: Partial<TaskViewData> & {
              is_all_day?: boolean;
              reminder_minutes?: number | null;
              rrule?: string | null;
              theme?: "light" | "dark";
            };
          }
        | undefined;
      if (!payload?.task) return;
      if (payload.task.theme === "dark" || payload.task.theme === "light") {
        setTheme(payload.task.theme);
      }
      setTask({
        id: payload.task.id,
        title: String(payload.task.title ?? ""),
        start_time: String(payload.task.start_time ?? ""),
        end_time: String(payload.task.end_time ?? ""),
        content: String(payload.task.content ?? ""),
        status: (payload.task.status as TaskViewData["status"]) ?? "TODO",
        color: payload.task.color,
        tag_ids: payload.task.tag_ids ?? [],
      });
    } catch (error) {
      postToNative({
        channel: "pecal-task-detail",
        type: "error",
        payload: { message: error instanceof Error ? error.message : String(error) },
      });
    }
  }, []);

  useEffect(() => {
    const queryTheme = searchParams.get("mobile_theme");
    if (queryTheme === "dark" || queryTheme === "light") {
      setTheme(queryTheme);
    }
  }, [searchParams]);

  useEffect(() => {
    applyTheme(theme);
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
    if (!rootRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const height = Math.ceil(entries[0]?.contentRect?.height ?? 300);
      postToNative({ channel: "pecal-task-detail", type: "height", payload: { height } });
    });
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="min-h-screen bg-transparent p-0">
      {task ? (
        <TaskViewPanel
          task={task}
          showActions={false}
          showTags={false}
          showAttachments={false}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Loading...
        </div>
      )}
    </div>
  );
}
