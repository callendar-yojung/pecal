"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

interface AuditLogItem {
  auditId: number;
  adminId: number;
  action: string;
  targetType: string;
  targetId: number | null;
  payload: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const response = await fetch("/api/admin/audit-logs?limit=100");
        if (!response.ok) throw new Error("failed");
        const data = (await response.json()) as { logs?: AuditLogItem[] };
        setLogs(Array.isArray(data.logs) ? data.logs : []);
      } catch (error) {
        console.error("Failed to load admin audit logs:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadLogs();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        감사 로그 불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">감사 로그</h1>
        <p className="text-gray-600 dark:text-gray-400">
          관리자 로그인, 플랜 수정, 알림 발송, 구독 강제 변경 이력을 확인합니다.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:p-6">
        {logs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            아직 기록된 감사 로그가 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <article
                key={log.auditId}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <ShieldCheck className="h-4 w-4" />
                    {log.action}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDateTime(log.createdAt)}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-2">
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white">관리자 ID:</span> {log.adminId}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white">대상 타입:</span> {log.targetType}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white">대상 ID:</span> {log.targetId ?? "-"}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white">IP:</span> {log.ip ?? "-"}
                  </div>
                </div>

                {log.payload ? (
                  <pre className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
