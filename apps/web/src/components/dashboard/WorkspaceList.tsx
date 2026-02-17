"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Plus, UserCircle2, UsersRound, Check, X } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useRouter } from "next/navigation";

export interface Workspace {
  workspace_id: number;
  type: "personal" | "team";
  owner_id: number;
  name: string;
  created_at: Date;
  created_by: number;
  memberCount?: number;
}

export default function WorkspaceList() {
  const t = useTranslations("dashboard");
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Fetch workspaces based on current workspace type
  const fetchWorkspaces = useCallback(async () => {
    if (!currentWorkspace) return;

    try {
      setLoading(true);

      // Different API endpoint based on workspace type
      const endpoint =
        currentWorkspace.type === "personal"
          ? `/api/workspaces/member/${currentWorkspace.owner_id}`
          : `/api/workspaces/team/${currentWorkspace.owner_id}`;

      const res = await fetch(endpoint);
      const data = await res.json();

      setWorkspaces(data.workspaces ?? []);
    } catch (e) {
      console.error("Failed to fetch workspaces", e);
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.type, currentWorkspace?.owner_id]);

  // Fetch workspaces when current workspace changes
  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Focus input when adding mode is enabled
  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  // Handle save new workspace
  const handleSaveWorkspace = async () => {
    if (!newWorkspaceName.trim() || !currentWorkspace) return;

    try {
      setIsSaving(true);

      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWorkspaceName.trim(),
          type: currentWorkspace.type,
          owner_id: currentWorkspace.owner_id,
        }),
      });

      if (response.ok) {
        setNewWorkspaceName("");
        setIsAdding(false);
        await fetchWorkspaces();
      } else {
        const data = await response.json();
        if (response.status === 403) {
          alert(t("workspace.permissionDenied"));
        } else {
          alert(data.error || t("workspace.createWorkSpaceError"));
        }
      }
    } catch (e) {
      console.error("Failed to create workspace", e);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel adding
  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewWorkspaceName("");
  };

  // Focus rename input
  useEffect(() => {
    if (editingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingId]);

  // Handle rename workspace
  const handleStartRename = (ws: Workspace) => {
    setEditingId(ws.workspace_id);
    setEditingName(ws.name);
  };

  const handleRename = async () => {
    if (!editingId || !editingName.trim() || isRenaming) return;

    try {
      setIsRenaming(true);
      const res = await fetch(`/api/workspaces/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      });

      if (res.ok) {
        await fetchWorkspaces();
      } else {
        const data = await res.json();
        if (res.status === 403) {
          alert(t("workspace.permissionDenied"));
        } else {
          alert(data.error || "Failed to rename workspace");
        }
      }
    } catch (e) {
      console.error("Failed to rename workspace", e);
    } finally {
      setIsRenaming(false);
      setEditingId(null);
      setEditingName("");
    }
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditingName("");
  };

  // Handle delete workspace
  const handleDeleteWorkspace = async () => {
    if (!deleteTargetId) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/workspaces/${deleteTargetId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        // 삭제한 워크스페이스가 현재 선택된 것이면 다른 워크스페이스로 전환
        if (currentWorkspace?.workspace_id === deleteTargetId) {
          const remaining = workspaces.filter(
            (w) => w.workspace_id !== deleteTargetId
          );
          if (remaining.length > 0) {
            setCurrentWorkspace(remaining[0]);
          }
        }
        await fetchWorkspaces();
      } else {
        const data = await res.json();
        if (res.status === 403) {
          alert(t("workspace.permissionDenied"));
        } else {
          alert(data.error || "Failed to delete workspace");
        }
      }
    } catch (e) {
      console.error("Failed to delete workspace", e);
    } finally {
      setIsDeleting(false);
      setDeleteTargetId(null);
    }
  };

  // Handle key press in input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveWorkspace();
    } else if (e.key === "Escape") {
      handleCancelAdd();
    }
  };

  if (!currentWorkspace) return null;

  return (
    <div className="space-y-3">
      {/* Workspace List */}
      <div className="space-y-1">
        <div className="flex items-center justify-between px-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {currentWorkspace.type === "personal"
              ? t("workspace.workspaces")
              : t("workspace.teamWorkspaces")}
          </p>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
            title={t("workspace.createTeam")}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Add New Workspace Input */}
        {isAdding && (
          <div className="rounded-md border border-border bg-card p-2">
            <input
              ref={inputRef}
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("workspace.enterWorkspaceName")}
              disabled={isSaving}
              className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleSaveWorkspace}
                disabled={isSaving || !newWorkspaceName.trim()}
                className="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? (
                  <span className="flex items-center justify-center gap-1">
                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {t("workspace.creating")}
                  </span>
                ) : (
                  t("workspace.create")
                )}
              </button>
              <button
                type="button"
                onClick={handleCancelAdd}
                disabled={isSaving}
                className="flex-1 rounded border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("workspace.cancel")}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="px-2 py-4 text-center">
            <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <p className="mt-1 text-xs text-muted-foreground">Loading...</p>
          </div>
        ) : workspaces.length === 0 && !isAdding ? (
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-sm text-muted-foreground">
              {currentWorkspace.type === "personal"
                ? t("workspace.noTeams")
                : t("workspace.noTeams")}
            </p>
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="mt-2 text-xs text-primary hover:underline"
            >
              + {t("workspace.createTeam")}
            </button>
          </div>
        ) : (
          workspaces.map((ws) => {
            const isActive = ws.workspace_id === currentWorkspace.workspace_id;
            const isEditing = editingId === ws.workspace_id;

            return (
              <div
                key={ws.workspace_id}
                className={`group flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-active text-foreground"
                    : "text-muted-foreground hover:bg-hover hover:text-foreground"
                }`}
              >
                {isEditing ? (
                  /* 인라인 수정 모드 */
                  <div className="flex flex-1 items-center gap-2 min-w-0">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded flex-shrink-0 ${
                        ws.type === "personal"
                          ? "bg-gradient-to-br from-violet-500 to-purple-600"
                          : "bg-gradient-to-br from-blue-500 to-cyan-600"
                      }`}
                    >
                      {ws.type === "personal" ? (
                        <UserCircle2 className="h-3.5 w-3.5 text-white" />
                      ) : (
                        <UsersRound className="h-3.5 w-3.5 text-white" />
                      )}
                    </div>
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename();
                        else if (e.key === "Escape") handleCancelRename();
                      }}
                      onBlur={handleRename}
                      disabled={isRenaming}
                      className="flex-1 min-w-0 rounded border border-primary bg-background px-1.5 py-0.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                ) : (
                  /* 일반 모드 */
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentWorkspace(ws);
                        router.push("/dashboard");
                      }}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        handleStartRename(ws);
                      }}
                      className="flex flex-1 items-center gap-2 min-w-0"
                    >
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded flex-shrink-0 ${
                          ws.type === "personal"
                            ? "bg-gradient-to-br from-violet-500 to-purple-600"
                            : "bg-gradient-to-br from-blue-500 to-cyan-600"
                        }`}
                      >
                        {ws.type === "personal" ? (
                          <UserCircle2 className="h-3.5 w-3.5 text-white" />
                        ) : (
                          <UsersRound className="h-3.5 w-3.5 text-white" />
                        )}
                      </div>

                      <span className="truncate flex-1 text-left">{ws.name}</span>

                      {isActive && <Check className="h-4 w-4 flex-shrink-0 text-primary" />}
                    </button>

                    {/* 삭제 버튼 (hover 시 표시) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTargetId(ws.workspace_id);
                      }}
                      className="flex-shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 group-hover:opacity-100"
                      title={t("workspace.delete") || "Delete"}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 삭제 확인 모달 */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {t("workspace.deleteConfirmTitle") || "워크스페이스 삭제"}
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {t("workspace.deleteConfirmMessage") ||
                "정말 이 워크스페이스를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."}
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                disabled={isDeleting}
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {t("workspace.cancel") || "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleDeleteWorkspace}
                disabled={isDeleting}
                className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors"
              >
                {isDeleting ? (
                  <span className="flex items-center justify-center gap-1">
                    <svg
                      className="h-3.5 w-3.5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {t("workspace.deleting") || "삭제 중..."}
                  </span>
                ) : (
                  t("workspace.delete") || "삭제"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
