// typescript
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import Button from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Tag {
  tag_id: number;
  name: string;
  color?: string;
  tag_scope?: "PERSONAL" | "TEAM";
  owner_id?: number;
  created_at?: string;
}

interface Task {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  content: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority?: "low" | "medium" | "high";
  color?: string;
  tags?: Tag[];
  team?: string;
}

type FilterStatus = "all" | "TODO" | "IN_PROGRESS" | "DONE";
type SortBy = "date" | "priority" | "status";

// 헬퍼: 16진 색상 기준으로 밝은지 판단 (간단한 루미넌스 계산)
const isLightColor = (hex?: string) => {
  if (!hex) return false;
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6;
};

const getContentText = (value?: string | null) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    const json = JSON.parse(trimmed);
    const texts: string[] = [];
    const walk = (node: any) => {
      if (!node) return;
      if (node.type === "text" && typeof node.text === "string") {
        texts.push(node.text);
      }
      if (Array.isArray(node.content)) {
        node.content.forEach(walk);
      }
    };
    walk(json);
    return texts.join(" ").trim();
  } catch {
    return value;
  }
};

export default function TasksPanel() {
  const t = useTranslations("dashboard.tasks");
  const locale = useLocale();
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // 페이징 상태
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // 전체 카운트 (필터 무관)
  const [allCount, setAllCount] = useState(0);
  const [todoCount, setTodoCount] = useState(0);
  const [inProgressCount, setInProgressCount] = useState(0);
  const [doneCount, setDoneCount] = useState(0);

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 상태별 카운트 조회
  const fetchStatusCounts = useCallback(async () => {
    if (!currentWorkspace?.workspace_id) return;
    try {
      const base = `/api/tasks?workspace_id=${currentWorkspace.workspace_id}&limit=1&page=1`;
      const [allRes, todoRes, ipRes, doneRes] = await Promise.all([
        fetch(base),
        fetch(`${base}&status=TODO`),
        fetch(`${base}&status=IN_PROGRESS`),
        fetch(`${base}&status=DONE`),
      ]);
      if (allRes.ok) setAllCount((await allRes.json()).total || 0);
      if (todoRes.ok) setTodoCount((await todoRes.json()).total || 0);
      if (ipRes.ok) setInProgressCount((await ipRes.json()).total || 0);
      if (doneRes.ok) setDoneCount((await doneRes.json()).total || 0);
    } catch (error) {
      console.error("Error fetching counts:", error);
    }
  }, [currentWorkspace?.workspace_id]);

  // 태스크 데이터 로드 (페이징)
  const fetchTasks = useCallback(async () => {
    if (!currentWorkspace?.workspace_id) return;

    try {
      setLoading(true);

      const sortMap: Record<SortBy, string> = {
        date: "start_time",
        priority: "start_time",
        status: "status",
      };

      const params = new URLSearchParams({
        workspace_id: String(currentWorkspace.workspace_id),
        page: String(page),
        limit: String(limit),
        sort_by: sortMap[sortBy],
        sort_order: "DESC",
      });

      if (filterStatus !== "all") params.set("status", filterStatus);
      if (searchQuery) params.set("search", searchQuery);

      const response = await fetch(`/api/tasks?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 0);
      } else {
        console.error("Failed to fetch tasks:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.workspace_id, page, limit, sortBy, filterStatus, searchQuery]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    fetchStatusCounts();
  }, [fetchStatusCounts]);

  // 검색 디바운스
  const handleSearchInputChange = (value: string) => {
    setSearchInput(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchQuery(value);
      setPage(1);
    }, 300);
  };

  // 필터 변경 시 페이지 초기화
  const handleFilterStatusChange = (status: FilterStatus) => {
    setFilterStatus(status);
    setPage(1);
  };

  const handleSortChange = (newSort: SortBy) => {
    setSortBy(newSort);
    setPage(1);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  // 날짜 범위 필터 (클라이언트 사이드 - API에 날짜 범위 필터가 없으므로)
  const filteredTasks = tasks.filter((task) => {
    const taskDate = new Date(task.start_time);
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (taskDate < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (taskDate > end) return false;
    }
    return true;
  });

  const statusStyles = {
    TODO: "bg-status-todo text-status-todo-foreground",
    IN_PROGRESS: "bg-status-progress text-status-progress-foreground",
    DONE: "bg-status-done text-status-done-foreground",
  };

  const priorityStyles = {
    low: "border-muted-foreground",
    medium: "border-primary",
    high: "border-destructive",
  };

  const statusLabels = {
    TODO: t("status.pending"),
    IN_PROGRESS: t("status.in_progress"),
    DONE: t("status.completed"),
  };

  const clearDateFilter = () => {
    setStartDate("");
    setEndDate("");
  };

  const handleOpenCreateModal = () => {
    router.push("/dashboard/tasks/new");
  };

  const handleTaskClick = (task: Task) => {
    router.push(`/dashboard/tasks/${task.id}`);
  };

  const handleStatusChange = async (taskId: number, newStatus: "TODO" | "IN_PROGRESS" | "DONE") => {
    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId,
          status: newStatus,
        }),
      });

      if (response.ok) {
        setTasks(tasks.map(task => (task.id === taskId ? { ...task, status: newStatus } : task)));
        await fetchStatusCounts();
      } else {
        console.error("Failed to update task:", response.statusText);
      }
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString(locale === "ko" ? "ko-KR" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">{t("loading")}</div>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">{t("noWorkspace") || "No workspace selected"}</div>
      </div>
    );
  }

  return (
      <div className="space-y-6">
        {/* 상단 통계 카드 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <button
              onClick={() => handleFilterStatusChange("all")}
              className={`ui-card p-4 text-left transition-colors ${
                  filterStatus === "all"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:bg-hover"
              }`}
          >
            <p className="text-sm text-muted-foreground">{t("filter.all")}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{allCount}</p>
          </button>
          <button
              onClick={() => handleFilterStatusChange("TODO")}
              className={`ui-card p-4 text-left transition-colors ${
                  filterStatus === "TODO"
                      ? "border-status-todo-foreground bg-status-todo"
                      : "border-border bg-card hover:bg-hover"
              }`}
          >
            <p className="text-sm text-muted-foreground">{statusLabels.TODO}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{todoCount}</p>
          </button>
          <button
              onClick={() => handleFilterStatusChange("IN_PROGRESS")}
              className={`ui-card p-4 text-left transition-colors ${
                  filterStatus === "IN_PROGRESS"
                      ? "border-status-progress-foreground bg-status-progress"
                      : "border-border bg-card hover:bg-hover"
              }`}
          >
            <p className="text-sm text-muted-foreground">{statusLabels.IN_PROGRESS}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{inProgressCount}</p>
          </button>
          <button
              onClick={() => handleFilterStatusChange("DONE")}
              className={`ui-card p-4 text-left transition-colors ${
                  filterStatus === "DONE"
                      ? "border-status-done-foreground bg-status-done"
                      : "border-border bg-card hover:bg-hover"
              }`}
          >
            <p className="text-sm text-muted-foreground">{statusLabels.DONE}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{doneCount}</p>
          </button>
        </div>

        {/* 필터 및 검색 바 */}
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <input
                  type="text"
                  placeholder={t("filter.search")}
                  value={searchInput}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  className="rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value as SortBy)}
                  className="rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="date">{t("filter.sortByDate")}</option>
                <option value="priority">{t("filter.sortByPriority")}</option>
                <option value="status">{t("filter.sortByStatus")}</option>
              </select>
            </div>
            <Button variant="primary" size="lg" onClick={handleOpenCreateModal}>
              + {t("addTask")}
            </Button>
          </div>

          {/* 날짜 범위 필터 */}
          <div className="ui-card flex flex-wrap items-center gap-3 p-3">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-card-foreground">{t("filter.dateRange")}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-lg border border-input bg-muted px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-muted-foreground">~</span>
              <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-lg border border-input bg-muted px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {(startDate || endDate) && (
                <Button size="sm" onClick={clearDateFilter} className="flex items-center gap-1">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {t("filter.reset")}
                </Button>
            )}
            {(startDate || endDate) && (
                <span className="ml-auto text-sm text-muted-foreground">
              {t("filter.tasksCount", { count: filteredTasks.length })}
            </span>
            )}
          </div>
        </div>

        {/* 태스크 목록 */}
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">{t("filter.noTasks")}</p>
              </Card>
          ) : (
              filteredTasks.map((task) => {
                const taskPriority = task.priority || "medium";
                return (
                  <Card
                      key={task.id}
                      onClick={() => handleTaskClick(task)}
                      className={`border-l-4 p-4 transition-shadow hover:shadow-md cursor-pointer ${priorityStyles[taskPriority]}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3
                              className={`text-lg font-semibold ${
                                  task.status === "DONE"
                                      ? "text-muted-foreground line-through"
                                      : "text-foreground"
                              }`}
                          >
                            {task.title}
                          </h3>

                          {task.tags?.length ? (
                              <div className="flex gap-2">
                                {task.tags.map((tag) => {
                                  const textColor = tag.color ? (isLightColor(tag.color) ? "#000" : "#fff") : undefined;
                                  return (
                                      <span
                                          key={tag.tag_id}
                                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                                          style={{ backgroundColor: tag.color ?? undefined, color: textColor }}
                                      >
                              {tag.name.toLowerCase() === "high" ? t("filter.urgent") : tag.name}
                            </span>
                                  );
                                })}
                              </div>
                          ) : null}
                        </div>
                        {task.content && (
                            <p className="mt-1 text-sm text-card-foreground">
                              {getContentText(task.content)}
                            </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">{task.title}</span>
                      <span className="mx-1">•</span>
                      {formatDateTime(task.start_time)} - {formatDateTime(task.end_time)}
                    </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                            value={task.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleStatusChange(task.id, e.target.value as Task["status"])}
                            className={`rounded-full px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring ${statusStyles[task.status]}`}
                        >
                          <option value="TODO">{statusLabels.TODO}</option>
                          <option value="IN_PROGRESS">{statusLabels.IN_PROGRESS}</option>
                          <option value="DONE">{statusLabels.DONE}</option>
                        </select>
                      </div>
                    </div>
                  </Card>
                );
              })
          )}
        </div>

        {/* 하단: 페이지 크기 + 페이지네이션 */}
        {total > 0 && (
          <Card className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-xs text-muted-foreground">
                {t("filter.tasksCount", { count: total })}
              </div>
              <select
                value={limit}
                onChange={(e) => handleLimitChange(Number(e.target.value))}
                className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option value={10}>{t("filter.perPage", { count: 10 })}</option>
                <option value={20}>{t("filter.perPage", { count: 20 })}</option>
                <option value={50}>{t("filter.perPage", { count: 50 })}</option>
                <option value={100}>{t("filter.perPage", { count: 100 })}</option>
              </select>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button size="sm" onClick={() => setPage(1)} disabled={page === 1}>
                  «
                </Button>
                <Button size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
                  ‹
                </Button>
                {(() => {
                  const pages: number[] = [];
                  const start = Math.max(1, page - 2);
                  const end = Math.min(totalPages, page + 2);
                  for (let i = start; i <= end; i++) pages.push(i);
                  return pages.map((p) => (
                    <Button
                      key={p}
                      onClick={() => setPage(p)}
                      variant={p === page ? "primary" : "muted"}
                      size="sm"
                    >
                      {p}
                    </Button>
                  ));
                })()}
                <Button size="sm" onClick={() => setPage(page + 1)} disabled={page === totalPages}>
                  ›
                </Button>
                <Button size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
                  »
                </Button>
              </div>
            )}
          </Card>
        )}

      </div>
  );
}
