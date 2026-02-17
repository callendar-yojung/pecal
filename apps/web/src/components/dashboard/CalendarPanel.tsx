"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from "lucide-react"; // 아이콘 라이브러리 추가 권장
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Tag {
  tag_id: number;
  name: string;
  color: string;
  owner_type: "team" | "personal";
  owner_id: number;
}

interface Task {
  id: number;
  title?: string;
  start_time: string;
  end_time?: string;
  content?: string;
  workspace_id: number;
  color?: string;
  tags?: Tag[];
}

export default function CalendarPanel() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { currentWorkspace } = useWorkspace();
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date()); // 기본값 오늘로 설정
  const [isLoading, setIsLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    if (!currentWorkspace) return;

    const fetchTasks = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
            `/api/tasks?workspace_id=${currentWorkspace.workspace_id}`
        );
        if (response.ok) {
          const data = await response.json();
          setTasks(data.tasks);
        }
      } catch (error) {
        console.error("Failed to fetch tasks:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTasks();
  }, [currentWorkspace?.workspace_id, currentDate]);

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDay = firstDayOfMonth.getDay();
  const totalDays = lastDayOfMonth.getDate();

  const days = [];
  for (let i = 0; i < startingDay; i++) days.push(null);
  for (let i = 1; i <= totalDays; i++) days.push(i);

  const weekDays = [
    t("calendar.weekDays.sun"), t("calendar.weekDays.mon"), t("calendar.weekDays.tue"),
    t("calendar.weekDays.wed"), t("calendar.weekDays.thu"), t("calendar.weekDays.fri"),
    t("calendar.weekDays.sat"),
  ];

  const formatLocalDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const isToday = (day: number | null) => {
    if (!day) return false;
    const today = new Date();
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  };

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const handleDateClick = (day: number) => setSelectedDate(new Date(year, month, day));

  const getTaskColor = (task: Task) => task.color || task.tags?.[0]?.color || "#3B82F6";

  const getReadableTextColor = (color: string) => {
    const hex = color.replace("#", "");
    if (hex.length !== 6) return "#fff";
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 180 ? "#0f172a" : "#ffffff";
  };

  const getContentText = (value?: string) => {
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

  const tasksByDay = useMemo(() => {
    const map = new Map<number, Task[]>();
    for (let day = 1; day <= totalDays; day++) map.set(day, []);

    tasks.forEach((task) => {
      const taskStartDate = formatLocalDate(new Date(task.start_time));
      const taskEndDate = formatLocalDate(new Date(task.end_time || task.start_time));
      for (let day = 1; day <= totalDays; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (dateStr >= taskStartDate && dateStr <= taskEndDate) {
          map.get(day)?.push(task);
        }
      }
    });
    return map;
  }, [tasks, totalDays, year, month]);

  const selectedDateTasks = selectedDate
      ? (tasksByDay.get(selectedDate.getDate()) || [])
      : [];

  if (isLoading) {
    return (
        <Card className="flex h-[600px] items-center justify-center rounded-3xl bg-card/50 backdrop-blur-md">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm font-medium text-muted-foreground">Loading your schedule...</p>
          </div>
        </Card>
    );
  }

  return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 animate-in fade-in duration-700">
        {/* 캘린더 메인 섹션 */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="overflow-hidden rounded-[2.5rem] border-border/60 shadow-2xl shadow-foreground/5">
            {/* 헤더: 글래스모피즘 스타일 */}
            <div className="flex flex-col gap-4 border-b border-border/40 bg-muted/10 px-6 py-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-7">
              <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight text-foreground">
                  {currentDate.toLocaleDateString(locale, { month: "long" })}
                  <span className="ml-3 font-light text-muted-foreground/60">{year}</span>
                </h2>
                <p className="text-sm font-medium text-primary/70 italic">
                  {currentWorkspace?.name || t("calendar.title")}
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-border/40 bg-background/50 p-1.5 shadow-inner">
                <Button size="sm" onClick={handlePrevMonth} className="rounded-xl px-2 py-2">
                  <ChevronLeft size={20} />
                </Button>
                <Button size="sm" variant="muted" onClick={() => setCurrentDate(new Date())} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider">
                  {t("calendar.today")}
                </Button>
                <Button size="sm" onClick={handleNextMonth} className="rounded-xl px-2 py-2">
                  <ChevronRight size={20} />
                </Button>
              </div>
            </div>

            {/* 캘린더 바디 */}
            <div className="p-5 sm:p-6">
              <div className="mb-4 grid grid-cols-7 gap-2 text-center sm:gap-4">
                {weekDays.map((day, i) => (
                    <div key={day} className={`text-xs font-black uppercase tracking-widest ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-muted-foreground/50"}`}>
                      {day}
                    </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2 sm:gap-4">
                {days.map((day, index) => {
                  const dayTasks = day ? tasksByDay.get(day) || [] : [];
                  const isSelected = selectedDate?.getDate() === day && selectedDate?.getMonth() === month;

                  return (
                      <button
                          key={index}
                          disabled={!day}
                          onClick={() => day && handleDateClick(day)}
                          className={`group relative flex min-h-[120px] flex-col rounded-[1.5rem] border p-3 transition-all duration-300
                      ${!day ? "border-transparent opacity-0" :
                              isSelected ? "border-primary bg-primary/5 shadow-xl shadow-primary/10 ring-2 ring-primary/20 scale-[1.03] z-10" :
                                  isToday(day) ? "border-primary/30 bg-secondary/30" : "border-border/50 bg-background hover:border-primary/40 hover:shadow-lg hover:shadow-foreground/5"}
                    `}
                      >
                        {day && (
                            <>
                        <span className={`text-sm font-bold ${isToday(day) ? "text-primary" : "text-foreground/70"}`}>
                          {day}
                        </span>
                              <div className="mt-3 space-y-1.5">
                                {dayTasks.slice(0, 2).map((task) => (
                                  <div
                                    key={task.id}
                                    className="truncate rounded-full px-2 py-1 text-[10px] font-semibold"
                                    style={{
                                      backgroundColor: getTaskColor(task),
                                      color: getReadableTextColor(getTaskColor(task)),
                                    }}
                                  >
                                    {task.title || getContentText(task.content) || "Task"}
                                  </div>
                                ))}
                                {dayTasks.length > 2 && (
                                  <p className="text-[10px] font-bold text-muted-foreground/60">
                                    + {dayTasks.length - 2} more
                                  </p>
                                )}
                              </div>
                            </>
                        )}
                      </button>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        {/* 우측 사이드바: 벤토 카드 스타일 */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="rounded-[2.5rem] border-border/60 p-6 shadow-xl sm:p-8">
            <div className="mb-6 flex items-center justify-between sm:mb-8">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
                  <CalendarIcon size={20} />
                </div>
                <h3 className="font-bold text-xl">
                  {selectedDate?.getDate()} <span className="text-sm font-medium text-muted-foreground">{currentDate.toLocaleDateString(locale, { month: 'short' })}</span>
                </h3>
              </div>
              <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push("/dashboard/tasks/new")}
                  className="h-10 w-10 rounded-2xl p-0 shadow-lg"
              >
                <Plus size={20} />
              </Button>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {selectedDateTasks.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="mx-auto h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground/30">
                      <Plus size={24} />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground/60">No plans for today</p>
                  </div>
              ) : (
                  selectedDateTasks.map((task) => (
                      <div
                          key={task.id}
                          className="group relative overflow-hidden rounded-3xl border border-border/50 bg-background p-5 transition-all hover:border-primary/30 hover:shadow-md"
                          onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                      >
                        <div
                            className="absolute left-0 top-0 h-full w-1.5"
                            style={{ backgroundColor: getTaskColor(task) }}
                        />
                        <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">
                          {task.title || getContentText(task.content) || "Untitled Task"}
                        </h4>
                        <div className="mt-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50">
                    <span className="rounded-lg bg-muted px-2 py-1">
                      {new Date(task.start_time).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                          <span>→</span>
                          <span>
                      {new Date(task.end_time || task.start_time).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                        </div>
                      </div>
                  ))
              )}
            </div>
          </Card>
        </div>

      </div>
  );
}
