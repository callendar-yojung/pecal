"use client";

import { useState, useEffect } from "react";
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
          console.log('[MiniCalendar] Received data:', data);
          console.log('[MiniCalendar] tasksByDate:', data.tasksByDate);
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

  const getTasksForDay = (day: number | null) => {
    if (!day) return [];
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dateTask = tasksByDate.find((t) => t.date === dateStr);
    return dateTask?.tasks || [];
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
          <span className="text-sm font-medium text-foreground">
            {currentDate.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "long" })}
          </span>
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
