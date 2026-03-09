"use client";

import {
  Activity,
  AlertTriangle,
  BellRing,
  Building2,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileWarning,
  KeyRound,
  RefreshCcw,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface DashboardStats {
  totalMembers: number;
  totalTeams: number;
  activeSubscriptions: number;
  totalTasks: number;
  recentMembers: number;
  ops: {
    cron: {
      lastSuccessAt: string | null;
      failureCount: number;
    };
    push: {
      sent24h: number;
      failed24h: number;
    };
    files: {
      uploadFailed24h: number;
      previewPending24h: number;
      previewFailed24h: number;
    };
    auth: {
      refreshFailed24h: number;
      forceLogout24h: number;
    };
  };
  recentEvents: Array<{
    eventId: number;
    eventType: string;
    status: "success" | "failure" | "info";
    createdAt: string;
    payload: Record<string, unknown> | null;
  }>;
}

function formatDateTime(value: string | null) {
  if (!value) return "기록 없음";
  return new Date(value).toLocaleString("ko-KR");
}

function formatEventType(type: string) {
  switch (type) {
    case "TASK_REMINDER_CRON_SUCCESS":
      return "리마인더 cron 성공";
    case "TASK_REMINDER_CRON_FAILURE":
      return "리마인더 cron 실패";
    case "PUSH_BATCH":
      return "푸시 발송 배치";
    case "FILE_UPLOAD_FAILURE":
      return "파일 업로드 실패";
    case "FILE_PREVIEW_PENDING":
      return "문서 변환 대기";
    case "FILE_PREVIEW_FAILURE":
      return "문서 변환 실패";
    case "AUTH_REFRESH_FAILURE":
      return "리프레시 실패";
    case "SESSION_FORCE_LOGOUT":
      return "강제 로그아웃";
    default:
      return type;
  }
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/admin/stats");
        if (response.ok) {
          const data = (await response.json()) as DashboardStats;
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  const statCards = [
    {
      title: "총 회원 수",
      value: stats?.totalMembers || 0,
      icon: Users,
      color: "bg-blue-500",
      change: `+${stats?.recentMembers || 0} (7일)`,
    },
    {
      title: "총 팀 수",
      value: stats?.totalTeams || 0,
      icon: Building2,
      color: "bg-green-500",
    },
    {
      title: "활성 구독",
      value: stats?.activeSubscriptions || 0,
      icon: CreditCard,
      color: "bg-purple-500",
    },
    {
      title: "총 태스크",
      value: stats?.totalTasks || 0,
      icon: ClipboardList,
      color: "bg-orange-500",
    },
  ];

  const opsCards = [
    {
      title: "cron 상태",
      icon: RefreshCcw,
      rows: [
        ["최근 성공", formatDateTime(stats?.ops.cron.lastSuccessAt ?? null)],
        ["실패 횟수", `${stats?.ops.cron.failureCount ?? 0}회`],
      ],
    },
    {
      title: "푸시 상태 (24시간)",
      icon: BellRing,
      rows: [
        ["발송 수", `${stats?.ops.push.sent24h ?? 0}건`],
        ["실패 수", `${stats?.ops.push.failed24h ?? 0}건`],
      ],
    },
    {
      title: "문서/파일 상태 (24시간)",
      icon: FileWarning,
      rows: [
        ["업로드 실패", `${stats?.ops.files.uploadFailed24h ?? 0}건`],
        ["변환 대기", `${stats?.ops.files.previewPending24h ?? 0}건`],
        ["변환 실패", `${stats?.ops.files.previewFailed24h ?? 0}건`],
      ],
    },
    {
      title: "로그인 상태 (24시간)",
      icon: KeyRound,
      rows: [
        ["refresh 실패", `${stats?.ops.auth.refreshFailed24h ?? 0}건`],
        ["강제 로그아웃", `${stats?.ops.auth.forceLogout24h ?? 0}건`],
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">대시보드</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          핵심 지표와 운영 상태를 한 화면에서 확인합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.title}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className={`rounded-lg p-3 ${card.color}`}>
                <card.icon className="h-5 w-5 text-white" />
              </div>
              {card.change ? (
                <span className="text-xs font-medium text-green-600 dark:text-green-400">{card.change}</span>
              ) : null}
            </div>
            <h3 className="mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">{card.title}</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{card.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">운영 상태</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {opsCards.map((card) => (
              <div key={card.title} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <div className="mb-3 flex items-center gap-2">
                  <card.icon className="h-4 w-4 text-gray-500" />
                  <h3 className="font-medium text-gray-900 dark:text-white">{card.title}</h3>
                </div>
                <div className="space-y-2 text-sm">
                  {card.rows.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3">
                      <span className="text-gray-600 dark:text-gray-400">{label}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">최근 운영 이벤트</h2>
          </div>
          <div className="space-y-3">
            {(stats?.recentEvents ?? []).length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                아직 기록된 운영 이벤트가 없습니다.
              </div>
            ) : (
              stats?.recentEvents.map((event) => {
                const StatusIcon = event.status === "failure" ? AlertTriangle : CheckCircle2;
                const statusClass =
                  event.status === "failure"
                    ? "text-red-600"
                    : event.status === "success"
                      ? "text-green-600"
                      : "text-gray-500";
                return (
                  <div
                    key={event.eventId}
                    className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`h-4 w-4 ${statusClass}`} />
                          <p className="font-medium text-gray-900 dark:text-white">{formatEventType(event.eventType)}</p>
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {formatDateTime(event.createdAt)}
                        </p>
                      </div>
                      <span className={`text-xs font-medium ${statusClass}`}>{event.status}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">운영 바로가기</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href="/admin/billing-ops"
            className="rounded-xl border border-gray-200 p-4 transition hover:border-blue-300 hover:bg-blue-50/40 dark:border-gray-700 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
          >
            <div className="font-medium text-gray-900 dark:text-white">결제 운영</div>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">구독 재동기화, 실패 결제 재시도, 환불/해지 이력</div>
          </Link>
          <Link
            href="/admin/file-ops"
            className="rounded-xl border border-gray-200 p-4 transition hover:border-blue-300 hover:bg-blue-50/40 dark:border-gray-700 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
          >
            <div className="font-medium text-gray-900 dark:text-white">파일 / 문서 운영</div>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">업로드 정책, 미리보기 지원, orphan 정리</div>
          </Link>
          <Link
            href="/admin/mobile-ops"
            className="rounded-xl border border-gray-200 p-4 transition hover:border-blue-300 hover:bg-blue-50/40 dark:border-gray-700 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
          >
            <div className="font-medium text-gray-900 dark:text-white">위젯 / 모바일 운영</div>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">위젯 실패 로그, 버전 분포, 강제 업데이트 정책</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
