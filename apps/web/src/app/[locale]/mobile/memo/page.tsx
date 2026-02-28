"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RichTextEditor from "@/components/editor/RichTextEditor";

type MemoItem = {
  memo_id: number;
  title: string;
  content_json: string | null;
  updated_at: string;
  is_favorite?: number;
};

type OwnerType = "personal" | "team";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };
const PAGE_SIZE = 10;

function parseJsonDoc(raw: string | null | undefined) {
  if (!raw) return EMPTY_DOC;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return EMPTY_DOC;
  }
}

export default function MobileMemoPage() {
  const search = useMemo(
    () =>
      new URLSearchParams(
        typeof window === "undefined" ? "" : window.location.search,
      ),
    [],
  );
  const token = search.get("token") ?? "";
  const ownerType = (search.get("owner_type") ?? "") as OwnerType;
  const ownerId = Number(search.get("owner_id") ?? "0");
  const theme = search.get("theme") === "dark" ? "dark" : "light";

  const headers = useMemo<Record<string, string>>(() => {
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      baseHeaders.Authorization = `Bearer ${token}`;
    }
    return baseHeaders;
  }, [token]);

  const [memos, setMemos] = useState<MemoItem[]>([]);
  const [selectedMemoId, setSelectedMemoId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<Record<string, unknown>>(EMPTY_DOC);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const saveTimerRef = useRef<number | null>(null);

  const canRequest =
    !!token && !!ownerType && Number.isFinite(ownerId) && ownerId > 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const applyTheme = useCallback(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  const loadMemoDetail = useCallback(
    async (memoId: number) => {
      if (!canRequest) return;
      const res = await fetch(
        `/api/memos/${memoId}?owner_type=${ownerType}&owner_id=${ownerId}`,
        { headers },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { memo?: MemoItem };
      const memo = data.memo;
      if (!memo) return;
      setTitle(memo.title || "제목 없음");
      setContent(parseJsonDoc(memo.content_json));
    },
    [canRequest, headers, ownerId, ownerType],
  );

  const loadMemos = useCallback(async () => {
    if (!canRequest) return;
    setLoading(true);
    setMessage("");
    try {
      const qs = new URLSearchParams({
        owner_type: ownerType,
        owner_id: String(ownerId),
        page: String(page),
        page_size: String(PAGE_SIZE),
        sort: "latest",
      });
      const res = await fetch(`/api/memos?${qs.toString()}`, { headers });
      if (!res.ok) {
        setMessage("메모를 불러오지 못했습니다.");
        setMemos([]);
        setTotal(0);
        return;
      }
      const data = (await res.json()) as { memos?: MemoItem[]; total?: number };
      const next = data.memos ?? [];
      setMemos(next);
      setTotal(Number(data.total ?? 0));
      if (!next.length) {
        setSelectedMemoId(null);
        setViewMode("list");
        setTitle("");
        setContent(EMPTY_DOC);
        return;
      }

      const hasSelected =
        selectedMemoId !== null &&
        next.some((memo) => memo.memo_id === selectedMemoId);
      if (hasSelected) {
        await loadMemoDetail(selectedMemoId as number);
      } else {
        setSelectedMemoId(null);
        setViewMode("list");
        setTitle("");
        setContent(EMPTY_DOC);
      }
    } finally {
      setLoading(false);
    }
  }, [canRequest, headers, loadMemoDetail, ownerId, ownerType, page, selectedMemoId]);

  const saveMemo = useCallback(
    async (next: { title: string; content: Record<string, unknown> }) => {
      if (!canRequest || !selectedMemoId) return;
      setSaving(true);
      setMessage("");
      try {
        const res = await fetch(`/api/memos/${selectedMemoId}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            owner_type: ownerType,
            owner_id: ownerId,
            title: next.title.trim() || "제목 없음",
            content: next.content,
          }),
        });
        if (!res.ok) {
          setMessage("메모 저장에 실패했습니다.");
          return;
        }
        setMessage("저장됨");
      } finally {
        setSaving(false);
      }
    },
    [canRequest, headers, ownerId, ownerType, selectedMemoId],
  );

  const queueSave = useCallback(
    (next: { title: string; content: Record<string, unknown> }) => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        void saveMemo(next);
      }, 500);
    },
    [saveMemo],
  );

  const createMemo = useCallback(async () => {
    if (!canRequest) return;
    const res = await fetch("/api/memos", {
      method: "POST",
      headers,
      body: JSON.stringify({
        owner_type: ownerType,
        owner_id: ownerId,
        title: "새 메모",
        content: EMPTY_DOC,
      }),
    });
    if (!res.ok) {
      setMessage("새 메모 생성에 실패했습니다.");
      return;
    }
    const data = (await res.json()) as { memo_id?: number };
    const createdId = Number(data.memo_id ?? 0);
    if (page !== 1) {
      setPage(1);
    }
    await loadMemos();
    if (Number.isFinite(createdId) && createdId > 0) {
      setSelectedMemoId(createdId);
      await loadMemoDetail(createdId);
      setViewMode("detail");
    }
  }, [canRequest, headers, loadMemoDetail, loadMemos, ownerId, ownerType, page]);

  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  useEffect(() => {
    void loadMemos();
  }, [loadMemos]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  if (!canRequest) {
    return (
      <main className="min-h-screen p-4 text-sm text-red-500">
        인증 또는 워크스페이스 정보가 없습니다.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-3 text-foreground">
      <section className="mx-auto flex max-w-5xl flex-col gap-3">
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-bold">메모</h1>
            <button
              type="button"
              onClick={createMemo}
              className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
            >
              새 메모
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {saving ? "저장 중..." : message || "자동 저장"}
          </p>
        </div>

        {viewMode === "list" ? (
          <div className="rounded-2xl border border-border bg-card p-2">
            <div className="max-h-[62vh] space-y-1 overflow-auto">
              {loading ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  불러오는 중...
                </p>
              ) : null}
              {!loading && !memos.length ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  메모가 없습니다.
                </p>
              ) : null}
              {memos.map((memo) => (
                <button
                  key={memo.memo_id}
                  type="button"
                  onClick={async () => {
                    setSelectedMemoId(memo.memo_id);
                    await loadMemoDetail(memo.memo_id);
                    setViewMode("detail");
                  }}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-left text-sm"
                >
                  <p className="truncate font-semibold text-foreground">
                    {memo.title || "제목 없음"}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {new Date(memo.updated_at).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || loading}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                이전
              </button>
              <span className="text-xs text-muted-foreground">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages || loading}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                다음
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-3">
            {!selectedMemoId ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                목록에서 메모를 선택하면 상세가 열립니다.
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground"
                  >
                    목록
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {saving ? "저장 중..." : message || "자동 저장"}
                  </span>
                </div>
                <input
                  value={title}
                  onChange={(event) => {
                    const nextTitle = event.target.value;
                    setTitle(nextTitle);
                    queueSave({ title: nextTitle, content });
                  }}
                  placeholder="제목"
                  className="mb-3 w-full rounded-xl border border-border px-3 py-2 text-base font-semibold outline-none focus:border-primary"
                />
                <RichTextEditor
                  initialContent={content}
                  contentKey={selectedMemoId}
                  onChange={(nextContent) => {
                    const parsed = nextContent as Record<string, unknown>;
                    setContent(parsed);
                    queueSave({ title, content: parsed });
                  }}
                  placeholder="메모를 입력하세요."
                />
              </>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
