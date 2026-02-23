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

interface MiniCalendarProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
}

export default function MiniCalendar({ selectedDate, onDateSelect }: MiniCalendarProps) {
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

  useEffect(() => {
    if (!selectedDate) return;
    setCurrentDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [selectedDate]);

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

  const isSelectedDay = (day: number | null) => {
    if (!day || !selectedDate) return false;
    return (
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === day
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
      <div className="flex items-center justify-center py-12">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setIsPickerOpen((prev) => !prev)}
            className="group flex items-center gap-2 rounded-xl border border-border bg-background/80 px-4 py-2 text-sm font-bold text-foreground transition-all hover:bg-background hover:shadow-md hover:-translate-y-0.5"
            aria-label="Change year and month"
          >
            {currentDate.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "long" })}
            <svg className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${isPickerOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isPickerOpen && (
            <div className="absolute left-0 top-12 z-50 w-72 animate-in zoom-in-95 rounded-2xl border border-border bg-popover p-4 shadow-2xl fade-in duration-200">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  {locale === "ko" ? "연/월 선택" : "Pick Date"}
                </div>
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(false)}
                  className="rounded-lg bg-muted p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {locale === "ko" ? "연도" : "Year"}
                  </div>
                  <div className="grid max-h-32 grid-cols-4 gap-1.5 overflow-y-auto pr-1 custom-scrollbar">
                    {yearOptions.map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => setCurrentDate(new Date(y, month, 1))}
                        className={`rounded-lg py-2 text-xs font-bold transition-all ${
                          y === year
                            ? "bg-primary text-white shadow-lg shadow-primary/25 scale-105"
                            : "bg-muted text-muted-foreground hover:bg-hover"
                        }`}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {locale === "ko" ? "월" : "Month"}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {monthLabels.map((label, idx) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          setCurrentDate(new Date(year, idx, 1));
                          setIsPickerOpen(false);
                        }}
                        className={`rounded-lg py-2 text-xs font-bold transition-all ${
                          idx === month
                            ? "bg-primary text-white shadow-lg shadow-primary/25 scale-105"
                            : "bg-muted text-muted-foreground hover:bg-hover"
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
        
        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePrevMonth}
            className="rounded-xl border border-border bg-background/80 p-2 shadow-sm transition-all hover:bg-background active:scale-95"
          >
            <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={handleNextMonth}
            className="rounded-xl border border-border bg-background/80 p-2 shadow-sm transition-all hover:bg-background active:scale-95"
          >
            <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* 캘린더 그리드 */}
      <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-inner-glow">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="py-1 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((day, index) => {
            const tasks = getTasksForDay(day);
            const hasTask = tasks.length > 0;
            const today = isToday(day);
            const selected = isSelectedDay(day);
            return (
              <button
                type="button"
                key={index}
                className={`group relative aspect-square flex items-center justify-center text-xs transition-all duration-300 ${
                  !day
                    ? ""
                    : selected
                      ? "rounded-xl border border-primary/60 bg-primary/12 text-primary font-bold shadow-md shadow-primary/20"
                    : today
                      ? "rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/30 scale-105 z-10"
                      : hasTask
                        ? "cursor-pointer rounded-xl border border-border bg-background text-foreground font-bold shadow-sm hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30"
                        : "rounded-xl text-muted-foreground hover:bg-muted/50"
                }`}
                title={hasTask && day ? tasks.map(t => t.title).join(", ") : undefined}
                disabled={!day}
                onClick={() => {
                  if (!day) return;
                  onDateSelect?.(new Date(year, month, day));
                }}
              >
                <div className="relative z-10">{day}</div>
                {hasTask && !today && (
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    {tasks.length > 1 && <div className="h-1 w-1 rounded-full bg-primary/50" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 다가오는 일정 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
            {t("upcoming")}
          </h3>
          <div className="mx-4 h-px flex-1 bg-border" />
        </div>
        
        {upcomingDates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 py-8 text-center">
             <p className="text-xs font-bold text-muted-foreground">
              {t("noTasksOnDate")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingDates.map((dateTask) => (
              <div
                key={dateTask.date}
                className="group relative flex items-start gap-4 overflow-hidden rounded-2xl border border-border bg-card/90 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex min-w-[48px] flex-col items-center justify-center rounded-xl border border-border bg-muted py-1">
                  <span className="text-[10px] font-black uppercase text-muted-foreground">
                    {new Date(dateTask.date).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { month: "short" })}
                  </span>
                  <span className="text-base font-black text-foreground">
                    {new Date(dateTask.date).getDate()}
                  </span>
                </div>
                
                <div className="flex-1 min-w-0 space-y-1.5">
                  {dateTask.tasks.slice(0, 2).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 text-xs font-bold text-foreground/80 transition-colors group-hover:text-primary"
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                      <span className="truncate">{task.title}</span>
                    </div>
                  ))}
                  {dateTask.tasks.length > 2 && (
                    <div className="ml-3.5 text-[10px] font-black text-muted-foreground">
                      + {dateTask.tasks.length - 2} {locale === "ko" ? "개 더" : "more"}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
