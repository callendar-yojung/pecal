"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import Button from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface TaskWithTitle {
  id: number;
  title: string;
  start_time: Date;
  end_time: Date;
  color?: string | null;
}

interface CalendarDateTask {
  date: string;
  tasks: TaskWithTitle[];
}

export default function MiniCalendar() {
  const t = useTranslations("dashboard.calendar");
  const locale = useLocale();
  const { currentWorkspace } = useWorkspace();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasksByDate, setTasksByDate] = useState<CalendarDateTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 태스크 데이터 가져오기
  useEffect(() => {
    if (!currentWorkspace) return;

    const fetchTasksByDate = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/calendar?workspace_id=${currentWorkspace.workspace_id}&year=${year}&month=${month + 1}`
        );
        if (response.ok) {
          const data = await response.json();
          setTasksByDate(data.tasksByDate || []);
        } else {
        }
      } catch (error) {
        console.error("Failed to fetch calendar data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTasksByDate();
  }, [currentWorkspace?.workspace_id, year, month]);

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDay = firstDayOfMonth.getDay();
  const totalDays = lastDayOfMonth.getDate();

  const days = [];
  for (let i = 0; i < startingDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= totalDays; i++) {
    days.push(i);
  }

  const tasksByDateMap = useMemo(() => {
    const map = new Map<string, TaskWithTitle[]>();
    tasksByDate.forEach((entry) => map.set(entry.date, entry.tasks || []));
    return map;
  }, [tasksByDate]);

  const getTasksForDay = (day: number | null) => {
    if (!day) return [];
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return tasksByDateMap.get(dateStr) || [];
  };

  const isToday = (day: number | null) => {
    if (!day) return false;
    const today = new Date();
    return (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day
    );
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthLabels = useMemo(
    () =>
      Array.from({ length: 12 }, (_, idx) =>
        new Date(2000, idx, 1).toLocaleDateString(
          locale === "ko" ? "ko-KR" : "en-US",
          { month: "long" }
        )
      ),
    [locale]
  );

  const yearOptions = useMemo(
    () => Array.from({ length: 31 }, (_, idx) => year - 15 + idx),
    [year]
  );

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!pickerRef.current) return;
      if (!pickerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
    };

    if (isPickerOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isPickerOpen]);

  // 요일 다국어 지원
  const weekDays = locale === "ko"
    ? ["일", "월", "화", "수", "목", "금", "토"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // 다가오는 일정 (오늘 이후 태스크가 있는 날짜)
  const upcomingDates = tasksByDate
    .filter((dateTask) => new Date(dateTask.date) >= new Date(new Date().setHours(0, 0, 0, 0)))
    .slice(0, 5);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handlePrevMonth} aria-label="Previous month">
            <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setIsPickerOpen((prev) => !prev)}
              className="rounded-full border border-border bg-muted/40 px-3 py-1 text-sm font-medium text-foreground transition hover:bg-muted"
              aria-label="Change year and month"
            >
              {currentDate.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "long" })}
            </button>

            {isPickerOpen && (
              <div className="absolute left-0 top-10 z-30 w-64 rounded-xl border border-border bg-card p-3 shadow-xl">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="text-xs font-semibold tracking-wide text-muted-foreground">
                    {locale === "ko" ? "연/월 선택" : "Pick Year / Month"}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPickerOpen(false)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    {locale === "ko" ? "닫기" : "Close"}
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 text-[11px] font-semibold text-muted-foreground">
                      {locale === "ko" ? "연도" : "Year"}
                    </div>
                    <div className="grid max-h-28 grid-cols-4 gap-1 overflow-y-auto pr-1">
                      {yearOptions.map((y) => (
                        <button
                          key={y}
                          type="button"
                          onClick={() => setCurrentDate(new Date(y, month, 1))}
                          className={`rounded-md px-1.5 py-1 text-xs transition ${
                            y === year
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/40 text-foreground hover:bg-muted"
                          }`}
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 text-[11px] font-semibold text-muted-foreground">
                      {locale === "ko" ? "월" : "Month"}
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {monthLabels.map((label, idx) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => {
                            setCurrentDate(new Date(year, idx, 1));
                            setIsPickerOpen(false);
                          }}
                          className={`rounded-md px-2 py-1 text-xs transition ${
                            idx === month
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/40 text-foreground hover:bg-muted"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <Button size="sm" onClick={handleNextMonth} aria-label="Next month">
            <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>
      </div>

      {/* 캘린더 그리드 */}
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => (
            <div
              key={day}
              className="py-1 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            const tasks = getTasksForDay(day);
            const hasTask = tasks.length > 0;
            return (
              <div
                key={index}
                className={`relative aspect-square p-1 text-center text-sm ${
                  !day
                    ? ""
                    : isToday(day)
                      ? "rounded-lg bg-primary text-primary-foreground font-semibold"
                      : hasTask
                        ? "rounded-lg bg-muted text-foreground font-medium cursor-pointer hover:bg-muted/80"
                        : "text-muted-foreground"
                }`}
                title={hasTask && day ? tasks.map(t => t.title).join(", ") : undefined}
              >
                <div className="flex flex-col h-full items-center justify-start">
                  <div className="mb-0.5">{day}</div>
                  {hasTask && day && (
                    <div className="flex flex-col gap-0.5 w-full px-0.5">
                      {tasks.slice(0, 2).map((task, idx) => (
                        <div
                          key={task.id}
                          className={`text-[8px] leading-tight truncate w-full px-0.5 rounded ${
                            isToday(day) 
                              ? "bg-primary-foreground/20 text-primary-foreground" 
                              : "text-primary"
                          }`}
                          style={
                            !isToday(day) && task.color
                              ? { backgroundColor: task.color, color: "#fff" }
                              : undefined
                          }
                          title={task.title}
                        >
                          {task.title}
                        </div>
                      ))}
                      {tasks.length > 2 && (
                        <div className={`text-[7px] text-center ${
                          isToday(day) ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}>
                          +{tasks.length - 2}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 다가오는 일정 */}
      <div className="mt-6 space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          {t("upcoming")}
        </h3>
        {upcomingDates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("noTasksOnDate")}
          </p>
        ) : (
          <div className="space-y-2">
            {upcomingDates.map((dateTask) => (
              <div
                key={dateTask.date}
                className="ui-card p-3 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {new Date(dateTask.date).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {dateTask.tasks.length}개
                  </span>
                </div>
                <div className="space-y-1">
                  {dateTask.tasks.slice(0, 2).map((task) => (
                    <div
                      key={task.id}
                      className="text-xs text-card-foreground truncate"
                    >
                      • {task.title}
                    </div>
                  ))}
                  {dateTask.tasks.length > 2 && (
                    <div className="text-xs text-muted-foreground">
                      +{dateTask.tasks.length - 2}개 더
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
