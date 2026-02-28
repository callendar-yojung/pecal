"use client";

import { ListTodo } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface Task {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  content: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  color?: string;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  workspace_id: number;
  tags?: Array<{ tag_id: number; name: string; color: string }>;
}

type ViewMode = "timeline" | "list";

interface TaskListProps {
  selectedDate?: Date;
  onSelectedDateChange?: (date: Date) => void;
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function TaskList({
  selectedDate,
  onSelectedDateChange,
}: TaskListProps) {
  const t = useTranslations("dashboard.tasks");
  const { currentWorkspace } = useWorkspace();
  const router = useRouter();

  // 공통 상태
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [internalSelectedDate, setInternalSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const activeDate = selectedDate ?? internalSelectedDate;

  // 타임라인 전용
  const timelineRef = useRef<HTMLDivElement>(null);

  // 날짜 기반 태스크 불러오기 (양쪽 뷰 공유)
  const fetchTasks = useCallback(async () => {
    if (!currentWorkspace) return;
    try {
      setIsLoading(true);
      // Use local date, not UTC date
      const dateStr = formatLocalDate(activeDate);
      // Send timezone offset so server can query correctly
      const timezoneOffset = new Date().getTimezoneOffset();
      const response = await fetch(
        `/api/tasks/date?workspace_id=${currentWorkspace.workspace_id}&date=${dateStr}&tz_offset=${timezoneOffset}`,
      );
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace, activeDate]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // 시간 포맷팅
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  };

  const getMinutesFromMidnight = (date: Date) => {
    return date.getHours() * 60 + date.getMinutes();
  };

  const getCurrentTimePosition = () => {
    const now = new Date();
    const isToday = activeDate.toDateString() === now.toDateString();
    if (!isToday) return null;
    return getMinutesFromMidnight(now);
  };

  const currentTimeMinutes = getCurrentTimePosition();

  useEffect(() => {
    if (!isLoading && timelineRef.current && currentTimeMinutes !== null) {
      const scrollPosition = Math.max(0, currentTimeMinutes - 120);
      timelineRef.current.scrollTop = scrollPosition;
    }
  }, [isLoading, currentTimeMinutes]);

  const updateDate = (date: Date) => {
    if (onSelectedDateChange) {
      onSelectedDateChange(date);
      return;
    }
    setInternalSelectedDate(date);
  };

  // 날짜 이동
  const handlePrevDay = () => {
    const newDate = new Date(activeDate);
    newDate.setDate(newDate.getDate() - 1);
    updateDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(activeDate);
    newDate.setDate(newDate.getDate() + 1);
    updateDate(newDate);
  };

  const handleToday = () => {
    updateDate(new Date());
  };

  // 네비게이션 핸들러
  const handleOpenCreateModal = () => {
    router.push("/dashboard/tasks/new");
  };

  const handleTaskClick = (task: Task) => {
    router.push(`/dashboard/tasks/${task.id}`);
  };

  // 태스크 위치 계산 (타임라인)
  const getTaskPosition = (task: Task) => {
    const startTime = new Date(task.start_time);
    const endTime = new Date(task.end_time);
    const startMinutes = getMinutesFromMidnight(startTime);
    const endMinutes = getMinutesFromMidnight(endTime);
    const durationMinutes = endMinutes - startMinutes;
    const top = startMinutes;
    const height = Math.max(durationMinutes, 30);
    return { top, height };
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusColors = {
    TODO: "bg-status-todo text-status-todo-foreground shadow-sm backdrop-blur-sm",
    IN_PROGRESS:
      "bg-status-progress text-status-progress-foreground shadow-sm backdrop-blur-sm",
    DONE: "bg-status-done text-status-done-foreground shadow-sm backdrop-blur-sm",
  };

  const statusBadgeColors = {
    TODO: "bg-status-todo text-status-todo-foreground ring-1 ring-border shadow-sm",
    IN_PROGRESS:
      "bg-status-progress text-status-progress-foreground ring-1 ring-border shadow-sm",
    DONE: "bg-status-done text-status-done-foreground ring-1 ring-border shadow-sm",
  };

  return (
    <div className="rounded-2xl border-none bg-transparent overflow-hidden">
      {/* 헤더 */}
      <div className="px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-foreground tracking-tight">
            {t("title")}
          </h2>
          <div className="flex items-center gap-3">
            {/* 뷰 모드 토글 */}
            <div className="flex rounded-xl border border-border bg-muted/70 p-1 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 ${
                  viewMode === "list"
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("viewList")}
              </button>
              <button
                type="button"
                onClick={() => setViewMode("timeline")}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 ${
                  viewMode === "timeline"
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("viewTimeline")}
              </button>
            </div>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="group relative inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground transition-all hover:translate-y-[-2px] hover:shadow-lg active:translate-y-0"
            >
              <span className="relative z-10 flex items-center gap-2">
                <span className="text-lg">+</span> {t("addTask")}
              </span>
              <div className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </div>

        {/* 날짜 네비게이션 */}
        <div className="mt-6 flex items-center justify-between rounded-2xl border border-border bg-muted/40 p-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevDay}
              className="rounded-xl border border-border bg-background p-2.5 shadow-sm transition-all hover:scale-105 hover:bg-hover active:scale-95"
              aria-label="Previous day"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <div className="min-w-[180px] rounded-xl border border-border bg-background px-4 py-1.5 text-center text-sm font-bold text-foreground shadow-sm">
              {formatDate(activeDate)}
            </div>
            <button
              type="button"
              onClick={handleNextDay}
              className="rounded-xl border border-border bg-background p-2.5 shadow-sm transition-all hover:scale-105 hover:bg-hover active:scale-95"
              aria-label="Next day"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
          <button
            type="button"
            onClick={handleToday}
            className="rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-bold text-foreground shadow-sm transition-all hover:scale-105 hover:bg-hover active:scale-95"
          >
            {t("today")}
          </button>
        </div>
      </div>

      {/* 로딩 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      )}

      {/* 타임라인 뷰 */}
      {!isLoading && viewMode === "timeline" && (
        <>
          <div
            className="relative max-h-[600px] overflow-y-auto"
            ref={timelineRef}
          >
            <div className="flex">
              <div className="w-16 flex-shrink-0 border-r border-border">
                {Array.from({ length: 24 }, (_, idx) => idx).map((hour) => (
                  <div
                    key={`hour-${hour}`}
                    className="h-[60px] border-b border-border px-3 py-2 text-center"
                  >
                    <div className="text-xs font-medium text-muted-foreground">
                      {String(hour).padStart(2, "0")}:00
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex-1 relative" style={{ height: "1440px" }}>
                {Array.from({ length: 24 }, (_, idx) => idx).map((hour) => (
                  <div
                    key={`line-${hour}`}
                    className="absolute w-full border-b border-border pointer-events-none"
                    style={{ top: `${hour * 60}px` }}
                  />
                ))}
                {tasks.map((task) => {
                  const { top, height } = getTaskPosition(task);
                  return (
                    <button
                      type="button"
                      key={task.id}
                      onClick={() => handleTaskClick(task)}
                      className={`absolute left-2 right-2 rounded-lg border-l-4 border px-3 py-2 ${statusColors[task.status]} cursor-pointer hover:shadow-lg transition-shadow overflow-hidden`}
                      style={{ top: `${top}px`, height: `${height}px` }}
                    >
                      <div className="flex items-center gap-2 h-full">
                        <div className="text-xs font-medium">
                          {formatTime(task.start_time)} -{" "}
                          {formatTime(task.end_time)}
                        </div>
                        <div className="text-sm font-semibold truncate">
                          {task.title}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {tasks.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-sm text-muted-foreground">
                      {t("filter.noTasks")}
                    </div>
                  </div>
                )}
                {currentTimeMinutes !== null && (
                  <div
                    className="absolute left-2 right-2 h-px bg-destructive"
                    style={{ top: `${currentTimeMinutes}px` }}
                    aria-hidden="true"
                  />
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-border px-6 py-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">
              {t("totalTasks")}: {tasks.length}
            </div>
          </div>
        </>
      )}

      {/* 리스트 뷰 */}
      {!isLoading && viewMode === "list" && (
        <div className="px-6 pb-6">
          <div className="flex flex-col gap-3">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border bg-muted/30 py-20">
                <div className="mb-4 rounded-full bg-background p-4 shadow-sm">
                  <ListTodo className="h-8 w-8 text-muted-foreground/60" />
                </div>
                <div className="text-sm font-bold text-muted-foreground">
                  {t("filter.noTasks")}
                </div>
              </div>
            ) : (
              tasks.map((task) => (
                <button
                  type="button"
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className="group relative flex w-full cursor-pointer flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-5 text-left shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] sm:flex-row sm:items-center"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary/10 group-hover:bg-primary transition-colors" />

                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="truncate text-base font-bold text-foreground transition-colors group-hover:text-primary">
                      {task.title}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">
                        <svg
                          aria-hidden="true"
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {formatTime(task.start_time)} -{" "}
                        {formatTime(task.end_time)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <span
                      className={`inline-flex items-center rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${statusBadgeColors[task.status]}`}
                    >
                      {t(
                        `status.${task.status === "TODO" ? "pending" : task.status === "IN_PROGRESS" ? "in_progress" : "completed"}`,
                      )}
                    </span>
                    <div className="rounded-xl bg-muted p-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <svg
                        aria-hidden="true"
                        className="h-4 w-4 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* 하단 요약 */}
          {tasks.length > 0 && (
            <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
              <div className="text-xs font-bold text-muted-foreground">
                {t("totalTasks")}:{" "}
                <span className="text-foreground">{tasks.length}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
