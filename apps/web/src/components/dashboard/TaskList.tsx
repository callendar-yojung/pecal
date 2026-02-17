"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useRouter } from "next/navigation";

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

export default function TaskList() {
  const t = useTranslations("dashboard.tasks");
  const { currentWorkspace } = useWorkspace();
  const router = useRouter();

  // 공통 상태
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 타임라인 전용
  const timelineRef = useRef<HTMLDivElement>(null);

  // Helper to format date as YYYY-MM-DD in local timezone
  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 날짜 기반 태스크 불러오기 (양쪽 뷰 공유)
  const fetchTasks = useCallback(async () => {
    if (!currentWorkspace) return;
    try {
      setIsLoading(true);
      // Use local date, not UTC date
      const dateStr = formatLocalDate(selectedDate);
      // Send timezone offset so server can query correctly
      const timezoneOffset = new Date().getTimezoneOffset();
      const response = await fetch(
        `/api/tasks/date?workspace_id=${currentWorkspace.workspace_id}&date=${dateStr}&tz_offset=${timezoneOffset}`
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
  }, [currentWorkspace, selectedDate]);

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
    const isToday = selectedDate.toDateString() === now.toDateString();
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

  // 날짜 이동
  const handlePrevDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const handleToday = () => {
    setSelectedDate(new Date());
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
    TODO: "bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-100",
    IN_PROGRESS: "bg-yellow-100 border-yellow-300 text-yellow-900 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-100",
    DONE: "bg-green-100 border-green-300 text-green-900 dark:bg-green-900/30 dark:border-green-700 dark:text-green-100",
  };

  const statusBadgeColors = {
    TODO: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
    IN_PROGRESS: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
    DONE: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card">
        {/* 헤더 */}
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-card-foreground">
              {t("title")}
            </h2>
            <div className="flex items-center gap-2">
              {/* 뷰 모드 토글 */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewMode === "list"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t("viewList")}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("timeline")}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewMode === "timeline"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t("viewTimeline")}
                </button>
              </div>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
              >
                + {t("addTask")}
              </button>
            </div>
          </div>

          {/* 날짜 네비게이션 (양쪽 뷰 공통) */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevDay}
                className="rounded-lg p-2 hover:bg-muted transition-colors"
                aria-label="Previous day"
              >
                <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="text-sm font-medium text-card-foreground min-w-[200px] text-center">
                {formatDate(selectedDate)}
              </div>
              <button
                type="button"
                onClick={handleNextDay}
                className="rounded-lg p-2 hover:bg-muted transition-colors"
                aria-label="Next day"
              >
                <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              onClick={handleToday}
              className="rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-muted/80 transition-colors"
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
            <div className="relative max-h-[600px] overflow-y-auto" ref={timelineRef}>
              <div className="flex">
                <div className="w-16 flex-shrink-0 border-r border-border">
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div key={hour} className="h-[60px] border-b border-border px-3 py-2 text-center">
                      <div className="text-xs font-medium text-muted-foreground">
                        {String(hour).padStart(2, "0")}:00
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex-1 relative" style={{ height: "1440px" }}>
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div
                      key={hour}
                      className="absolute w-full border-b border-border pointer-events-none"
                      style={{ top: `${hour * 60}px` }}
                    />
                  ))}
                  {tasks.map((task) => {
                    const { top, height } = getTaskPosition(task);
                    return (
                      <div
                        key={task.id}
                        onClick={() => handleTaskClick(task)}
                        className={`absolute left-2 right-2 rounded-lg border-l-4 border px-3 py-2 ${statusColors[task.status]} cursor-pointer hover:shadow-lg transition-shadow overflow-hidden`}
                        style={{ top: `${top}px`, height: `${height}px` }}
                      >
                        <div className="flex items-center gap-2 h-full">
                          <div className="text-xs font-medium">
                            {formatTime(task.start_time)} - {formatTime(task.end_time)}
                          </div>
                          <div className="text-sm font-semibold truncate">{task.title}</div>
                        </div>
                      </div>
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
                      className="absolute left-2 right-2 h-px bg-red-500"
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
          <>
            {/* 테이블 헤더 */}
            <div className="hidden sm:grid grid-cols-[1fr_120px_120px_100px] gap-4 px-6 py-3 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div className="text-left">{t("modal.taskTitle")}</div>
              <div className="text-left">{t("modal.startTime")}</div>
              <div className="text-left">{t("modal.endTime")}</div>
              <div className="text-left">{t("filter.sortByStatus")}</div>
            </div>

            {/* 태스크 리스트 */}
            <div className="divide-y divide-border">
              {tasks.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-sm text-muted-foreground">
                    {t("filter.noTasks")}
                  </div>
                </div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px_100px] gap-2 sm:gap-4 px-6 py-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="font-medium text-sm text-card-foreground truncate">
                      {task.title}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatTime(task.start_time)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatTime(task.end_time)}
                    </div>
                    <div>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeColors[task.status]}`}>
                        {t(`status.${task.status === "TODO" ? "pending" : task.status === "IN_PROGRESS" ? "in_progress" : "completed"}`)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 하단 요약 */}
            {tasks.length > 0 && (
              <div className="border-t border-border px-6 py-3 bg-muted/30">
                <div className="text-xs text-muted-foreground">
                  {t("totalTasks")}: {tasks.length}
                </div>
              </div>
            )}
          </>
        )}
      </div>

    </>
  );
}
