"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import RichTextEditor from "@/components/editor/RichTextEditor";

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

function defaultDateTime(offsetMinutes: number) {
  const date = new Date(Date.now() + offsetMinutes * 60_000);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export default function MobileTaskNewPage() {
  const search = useMemo(
    () => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search),
    []
  );
  const token = search.get("token") ?? "";
  const workspaceId = Number(search.get("workspace_id") ?? "0");
  const theme = search.get("theme") === "dark" ? "dark" : "light";

  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState(defaultDateTime(0));
  const [endTime, setEndTime] = useState(defaultDateTime(30));
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [content, setContent] = useState<Record<string, unknown>>(EMPTY_DOC);
  const [editorKey, setEditorKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !workspaceId) {
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
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          title: title.trim(),
          start_time: startTime,
          end_time: endTime,
          status,
          color: "#3B82F6",
          content: JSON.stringify(content),
          tag_ids: [],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error ?? "등록에 실패했습니다.");
        return;
      }
      setMessage("일정이 등록되었습니다.");
      setTitle("");
      setContent(EMPTY_DOC);
      setEditorKey((prev) => prev + 1);
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  return (
    <main className="min-h-screen bg-background p-4 text-foreground">
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-bold">새 일정 등록</h1>
        <p className="mt-1 text-sm text-muted-foreground">모바일 WebView 전체 페이지 모드</p>
      </section>

      <form onSubmit={submit} className="mx-auto mt-4 max-w-3xl rounded-2xl border border-border bg-card p-4 shadow-sm">
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

          <RichTextEditor
            initialContent={content}
            contentKey={editorKey}
            onChange={(next) => setContent(next as Record<string, unknown>)}
            placeholder="내용"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving ? "등록 중..." : "일정 등록"}
        </button>

        {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
      </form>
    </main>
  );
}
