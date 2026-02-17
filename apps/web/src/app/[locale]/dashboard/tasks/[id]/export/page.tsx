"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import TaskViewPanel, { type TaskViewData } from "@/components/dashboard/TaskViewPanel";

type Visibility = "public" | "restricted";

type AccessMember = {
  member_id: number;
  nickname: string | null;
  email: string | null;
  profile_image_url: string | null;
};

type ExportItem = {
  export_id: number;
  token: string;
  visibility: Visibility;
  created_at: string;
  revoked_at?: string | null;
  expires_at?: string | null;
  access_members: AccessMember[];
};

type SearchResult = AccessMember;

const toDateTimeLocal = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

const toMysqlDatetime = (value: string) => {
  if (!value) return null;
  if (value.includes("T")) {
    return `${value.replace("T", " ")}:00`;
  }
  return value;
};

export default function TaskExportPage() {
  const t = useTranslations("dashboard.tasks.exportPage");
  const tTasks = useTranslations("dashboard.tasks");
  const params = useParams();
  const { currentWorkspace } = useWorkspace();
  const [task, setTask] = useState<TaskViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [creating, setCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [error, setError] = useState<string | null>(null);
  const [exportsList, setExportsList] = useState<ExportItem[]>([]);
  const [exportsLoading, setExportsLoading] = useState(false);
  const [selectedExportId, setSelectedExportId] = useState<number | null>(null);
  const [newExpiresAt, setNewExpiresAt] = useState("");
  const [expiryDrafts, setExpiryDrafts] = useState<Record<number, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedMember, setSelectedMember] = useState<SearchResult | null>(null);
  const [origin, setOrigin] = useState("");

  const taskId = Number(params?.id);
  const locale = typeof params?.locale === "string" ? params.locale : "en";

  const selectedExport = useMemo(
    () => exportsList.find((item) => item.export_id === selectedExportId) || null,
    [exportsList, selectedExportId]
  );

  useEffect(() => {
    setSearchQuery("");
    setSelectedMember(null);
    setSearchResults([]);
    setShowSearch(false);
  }, [selectedExportId]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

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
          setError(data.error || t("loadError"));
        }
      } catch {
        setError(t("loadError"));
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [currentWorkspace?.workspace_id, taskId, t]);

  const fetchExports = async () => {
    if (!taskId || Number.isNaN(taskId)) return;
    setExportsLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/exports`);
      const data = await res.json();
      if (res.ok) {
        setExportsList(data.exports || []);
        const firstExportId = data.exports?.[0]?.export_id ?? null;
        setSelectedExportId((prev) => prev ?? firstExportId);
        setExpiryDrafts((prev) => {
          const next = { ...prev };
          (data.exports || []).forEach((item: ExportItem) => {
            if (next[item.export_id] === undefined) {
              next[item.export_id] = toDateTimeLocal(item.expires_at);
            }
          });
          return next;
        });
      }
    } finally {
      setExportsLoading(false);
    }
  };

  useEffect(() => {
    if (!currentWorkspace?.workspace_id || Number.isNaN(taskId)) return;
    fetchExports();
  }, [currentWorkspace?.workspace_id, taskId]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (selectedMember && trimmed !== (selectedMember.nickname || selectedMember.email || "")) {
      setSelectedMember(null);
    }
    if (!trimmed || trimmed.length < 2 || !selectedExportId) {
      setSearchResults([]);
      return;
    }
    const isEmail = trimmed.includes("@");
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/members/search?q=${encodeURIComponent(trimmed)}&type=${isEmail ? "email" : "nickname"}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (res.ok) {
          setSearchResults(data.results || []);
          setShowSearch(true);
        } else {
          setSearchResults([]);
        }
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
  }, [searchQuery, selectedExportId, selectedMember]);

  const handleCreateExport = async () => {
    if (!taskId || Number.isNaN(taskId)) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibility,
          expires_at: newExpiresAt ? toMysqlDatetime(newExpiresAt) : null,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.url) {
        setShareUrl(data.url);
        setNewExpiresAt("");
        await fetchExports();
      } else {
        setError(data.error || t("createError"));
      }
    } catch {
      setError(t("createError"));
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("idle");
    }
  };

  const handleRevoke = async (exportId: number) => {
    setActionLoading((prev) => ({ ...prev, [exportId]: true }));
    await fetch(`/api/exports/tasks/id/${exportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revoke: true }),
    });
    await fetchExports();
    setActionLoading((prev) => ({ ...prev, [exportId]: false }));
  };

  const handleVisibilityChange = async (exportId: number, next: Visibility) => {
    setActionLoading((prev) => ({ ...prev, [exportId]: true }));
    await fetch(`/api/exports/tasks/id/${exportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: next }),
    });
    await fetchExports();
    setActionLoading((prev) => ({ ...prev, [exportId]: false }));
  };

  const handleExpirySave = async (exportId: number) => {
    setActionLoading((prev) => ({ ...prev, [exportId]: true }));
    const value = expiryDrafts[exportId] || "";
    await fetch(`/api/exports/tasks/id/${exportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expires_at: value ? toMysqlDatetime(value) : null,
      }),
    });
    await fetchExports();
    setActionLoading((prev) => ({ ...prev, [exportId]: false }));
  };

  const handleAddAccess = async () => {
    if (!selectedExportId || !selectedMember) return;
    setActionLoading((prev) => ({ ...prev, [selectedExportId]: true }));
    await fetch(`/api/exports/tasks/id/${selectedExportId}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: selectedMember.member_id }),
    });
    setSearchQuery("");
    setSelectedMember(null);
    setSearchResults([]);
    setShowSearch(false);
    await fetchExports();
    setActionLoading((prev) => ({ ...prev, [selectedExportId]: false }));
  };

  const handleRemoveAccess = async (memberId: number) => {
    if (!selectedExportId) return;
    setActionLoading((prev) => ({ ...prev, [selectedExportId]: true }));
    await fetch(
      `/api/exports/tasks/id/${selectedExportId}/access?member_id=${memberId}`,
      { method: "DELETE" }
    );
    await fetchExports();
    setActionLoading((prev) => ({ ...prev, [selectedExportId]: false }));
  };

  if (!currentWorkspace) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {tTasks("selectWorkspace") || "워크스페이스를 선택해주세요."}
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
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-foreground">{t("visibilityLabel")}</p>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={visibility === "public"}
                  onChange={() => setVisibility("public")}
                />
                {t("visibilityPublic")}
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name="visibility"
                  value="restricted"
                  checked={visibility === "restricted"}
                  onChange={() => setVisibility("restricted")}
                />
                {t("visibilityRestricted")}
              </label>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">{t("expiresLabel")}</label>
            <input
              type="datetime-local"
              value={newExpiresAt}
              onChange={(e) => setNewExpiresAt(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("expiresHint")}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleCreateExport}
            disabled={creating}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? t("creating") : t("createLink")}
          </button>

          {shareUrl && (
            <button
              type="button"
              onClick={() => handleCopy(shareUrl)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {copyState === "copied" ? t("copied") : t("copy")}
            </button>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {shareUrl && (
          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-sm font-medium text-foreground">{t("linkLabel")}</p>
            <div className="mt-2">
              <input
                readOnly
                value={shareUrl}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t("linkHint")}</p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">{t("exportListTitle")}</h2>
        {exportsLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("loading")}</p>
        ) : exportsList.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("noExports")}</p>
        ) : (
          <div className="mt-4 space-y-4">
            {exportsList.map((item) => {
              const url = origin
                ? `${origin}/${locale}/export/tasks/${item.token}`
                : `/${locale}/export/tasks/${item.token}`;
              const isExpired =
                !!item.expires_at && new Date(item.expires_at) < new Date();
              const isRevoked = !!item.revoked_at;
              return (
                <div key={item.export_id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {t("exportItemTitle", { id: item.export_id })}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t("createdAt")}: {new Date(item.created_at).toLocaleString()}
                      </div>
                      {isRevoked && (
                        <div className="mt-1 text-xs font-medium text-red-600">
                          {t("revoked")}
                        </div>
                      )}
                      {!isRevoked && isExpired && (
                        <div className="mt-1 text-xs font-medium text-amber-600">
                          {t("expired")}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={item.visibility}
                        onChange={(e) =>
                          handleVisibilityChange(
                            item.export_id,
                            e.target.value as Visibility
                          )
                        }
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      >
                        <option value="public">{t("visibilityPublicShort")}</option>
                        <option value="restricted">{t("visibilityRestrictedShort")}</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleCopy(url)}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                      >
                        {t("copy")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevoke(item.export_id)}
                        disabled={actionLoading[item.export_id]}
                        className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-60"
                      >
                        {t("revoke")}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        {t("expiresLabel")}
                      </label>
                      <div className="mt-1 flex gap-2">
                        <input
                          type="datetime-local"
                          value={expiryDrafts[item.export_id] || ""}
                          onChange={(e) =>
                            setExpiryDrafts((prev) => ({
                              ...prev,
                              [item.export_id]: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleExpirySave(item.export_id)}
                          className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                        >
                          {t("save")}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        {t("shareLink")}
                      </label>
                      <input
                        readOnly
                        value={url}
                        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">{t("accessTitle")}</h2>
        {exportsList.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("noExports")}</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">{t("selectExport")}</label>
              <select
                value={selectedExportId ?? ""}
                onChange={(e) => setSelectedExportId(Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {exportsList.map((item) => (
                  <option key={item.export_id} value={item.export_id}>
                    {t("exportItemTitle", { id: item.export_id })}
                  </option>
                ))}
              </select>
            </div>

            {selectedExport?.visibility !== "restricted" ? (
              <p className="text-sm text-muted-foreground">{t("accessPublicHint")}</p>
            ) : (
              <>
                <div className="relative">
                  <label className="text-sm font-medium text-foreground">
                    {t("addMemberLabel")}
                  </label>
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("memberPlaceholder")}
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    onFocus={() => {
                      if (searchResults.length > 0) setShowSearch(true);
                    }}
                  />
                  {selectedMember && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2 py-1 text-xs">
                      <span className="text-muted-foreground">{t("selectedMember")}</span>
                      <span className="truncate font-medium text-foreground">
                        {selectedMember.nickname || selectedMember.email}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMember(null);
                          setSearchQuery("");
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  {showSearch && (searchResults.length > 0 || searchLoading) && (
                    <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg">
                      {searchLoading ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          {t("searching")}
                        </div>
                      ) : (
                        searchResults.map((item) => (
                          <button
                            key={item.member_id}
                            type="button"
                            onClick={() => {
                              const useEmail = searchQuery.includes("@");
                              setSelectedMember(item);
                              setSearchQuery(
                                useEmail
                                  ? item.email || item.nickname || ""
                                  : item.nickname || item.email || ""
                              );
                              setShowSearch(false);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                          >
                            <div className="h-7 w-7 overflow-hidden rounded-full bg-muted">
                              {item.profile_image_url ? (
                                <img
                                  src={item.profile_image_url}
                                  alt={item.nickname || "User"}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                                  {(item.nickname || item.email || "U").charAt(0)}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-medium text-foreground">
                                {item.nickname || item.email || `#${item.member_id}`}
                              </div>
                              {item.email && (
                                <div className="truncate text-xs text-muted-foreground">
                                  {item.email}
                                </div>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleAddAccess}
                  disabled={!selectedMember || !selectedExportId}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {t("addMember")}
                </button>

                <div>
                  <p className="text-sm font-medium text-foreground">{t("allowedMembers")}</p>
                  {selectedExport?.access_members?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedExport.access_members.map((member) => (
                        <span
                          key={member.member_id}
                          className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs"
                        >
                          {member.nickname || member.email || `#${member.member_id}`}
                          <button
                            type="button"
                            onClick={() => handleRemoveAccess(member.member_id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">{t("noAllowedMembers")}</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <TaskViewPanel
        task={task}
        showActions={false}
        workspaceType={currentWorkspace.type}
        ownerId={currentWorkspace.owner_id}
        showTags
        showAttachments
      />
    </div>
  );
}
