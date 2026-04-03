"use client";

import { Bell, CalendarClock, CheckCircle2, Loader2, Send, Smartphone, Users, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface Member {
  member_id: number;
  email: string;
  nickname: string;
  provider: string;
}

interface AudiencePreview {
  requestedMemberCount: number;
  eligibleMemberCount: number;
  excludedMarketingCount: number;
  previewRecipients: Array<{
    memberId: number;
    nickname: string;
    email: string;
    provider: string;
  }>;
}

interface BroadcastHistoryItem {
  broadcastId: number;
  adminId: number;
  adminUsername: string;
  title: string;
  message: string;
  targetMode: "all" | "members";
  sendPush: boolean;
  status: "scheduled" | "processing" | "sent" | "failed";
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  requestedMemberCount: number;
  eligibleMemberCount: number;
  excludedMarketingCount: number;
  appNotificationCount: number;
  pushSentCount: number;
  invalidTokenCount: number;
  previewRecipients: Array<{
    memberId: number;
    nickname: string;
    email: string;
    provider: string;
  }>;
  errorMessage: string | null;
}

type TargetMode = "all" | "members";

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function historyStatusClass(status: BroadcastHistoryItem["status"]) {
  if (status === "sent") {
    return "border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-900/10 dark:text-green-300";
  }
  if (status === "failed") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300";
  }
  if (status === "processing") {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/10 dark:text-blue-300";
  }
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300";
}

export default function AdminNotificationsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [history, setHistory] = useState<BroadcastHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<TargetMode>("all");
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [sendPush, setSendPush] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [error, setError] = useState("");

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/admin/notifications");
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as { history?: BroadcastHistoryItem[] };
      setHistory(Array.isArray(data.history) ? data.history : []);
    } catch (loadError) {
      console.error("Failed to load notification history:", loadError);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const response = await fetch("/api/admin/members");
        if (!response.ok) throw new Error("failed");
        const data = (await response.json()) as Member[];
        setMembers(Array.isArray(data) ? data : []);
      } catch (loadError) {
        console.error("Failed to load members for admin notifications:", loadError);
        setError("회원 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void Promise.all([loadMembers(), loadHistory()]);
  }, []);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) =>
      `${member.nickname} ${member.email} ${member.provider}`.toLowerCase().includes(query),
    );
  }, [members, search]);

  const toggleMember = (memberId: number) => {
    setSelectedMemberIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    );
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/notifications/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          memberIds: selectedMemberIds,
        }),
      });
      const data = (await response.json()) as AudiencePreview & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "발송 대상 미리보기를 불러오지 못했습니다.");
      }
      setPreview({
        requestedMemberCount: data.requestedMemberCount,
        eligibleMemberCount: data.eligibleMemberCount,
        excludedMarketingCount: data.excludedMarketingCount,
        previewRecipients: Array.isArray(data.previewRecipients) ? data.previewRecipients : [],
      });
    } catch (previewError) {
      console.error("Failed to preview admin notification audience:", previewError);
      setError(
        previewError instanceof Error
          ? previewError.message
          : "발송 대상 미리보기를 불러오지 못했습니다.",
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !message.trim()) {
      setError("제목과 내용을 입력해주세요.");
      return;
    }
    if (target === "members" && selectedMemberIds.length === 0) {
      setError("최소 1명의 회원을 선택해주세요.");
      return;
    }

    setSubmitting(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          target,
          memberIds: selectedMemberIds,
          sendPush,
          scheduledAt: scheduledAt || null,
        }),
      });

      const data = (await response.json()) as Record<string, unknown> & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "알림 발송에 실패했습니다.");
      }

      setResult(data);
      setTitle("");
      setMessage("");
      setScheduledAt("");
      setSelectedMemberIds([]);
      setPreview(null);
      await loadHistory();
    } catch (submitError) {
      console.error("Failed to send admin notification:", submitError);
      setError(
        submitError instanceof Error ? submitError.message : "알림 발송에 실패했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">알림 발송</h1>
        <p className="text-gray-600 dark:text-gray-400">
          마케팅 수신 동의한 회원만 대상으로 공지 알림을 발송합니다. 즉시 발송, 예약 발송, 결과 집계를 한 화면에서 관리합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">발송 내용</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                앱 알림 생성, 푸시 발송, 예약 시간을 함께 설정합니다.
              </p>
            </div>
            <div className="rounded-full bg-blue-50 p-3 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
              <Bell className="h-5 w-5" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">제목</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="예: 시스템 점검 안내"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">내용</label>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="회원에게 보여줄 메시지를 입력하세요."
                rows={5}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setTarget("all")}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  target === "all"
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300"
                    : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4" />
                  <div>
                    <p className="text-sm font-semibold">전체 발송</p>
                    <p className="text-xs opacity-80">마케팅 동의 회원 전체</p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setTarget("members")}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  target === "members"
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300"
                    : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Bell className="h-4 w-4" />
                  <div>
                    <p className="text-sm font-semibold">선택 발송</p>
                    <p className="text-xs opacity-80">선택 회원 중 동의자만</p>
                  </div>
                </div>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">푸시도 발송</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Expo 토큰이 있는 기기만</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={sendPush}
                  onChange={(event) => setSendPush(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <CalendarClock className="h-4 w-4 text-gray-500" />
                  예약 발송
                </div>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                />
              </label>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
                {error}
              </div>
            ) : null}

            {result ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/40 dark:bg-green-900/10 dark:text-green-300">
                {result.scheduled
                  ? `예약 발송 등록 완료 · 대상 ${Number(result.eligibleMemberCount ?? 0).toLocaleString()}명`
                  : `앱 알림 ${Number(result.appNotificationCount ?? 0).toLocaleString()}건 · 푸시 ${Number(result.pushSentCount ?? 0).toLocaleString()}건 · 제외 ${Number(result.excludedMarketingCount ?? 0).toLocaleString()}명`}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void handlePreview()}
                disabled={previewLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
              >
                {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                발송 대상 미리보기
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {submitting ? "처리 중..." : scheduledAt ? "예약 발송 등록" : "즉시 발송"}
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">발송 대상 선택</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {target === "all" ? "전체 발송은 회원 선택 없이 진행됩니다." : "닉네임/이메일로 검색 후 선택하세요."}
                </p>
              </div>
              <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                {target === "all" ? `전체 ${members.length.toLocaleString()}명` : `선택 ${selectedMemberIds.length.toLocaleString()}명`}
              </div>
            </div>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="닉네임 또는 이메일로 검색"
              disabled={target === "all"}
              className="mb-3 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:disabled:bg-gray-800"
            />

            <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {(target === "all" ? members.slice(0, 20) : filteredMembers).map((member) => {
                const checked = selectedMemberIds.includes(member.member_id);
                return (
                  <label
                    key={member.member_id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                      target === "all"
                        ? "border-gray-200 bg-gray-50 opacity-70 dark:border-gray-700 dark:bg-gray-900"
                        : checked
                          ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
                          : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={target === "all" ? true : checked}
                      disabled={target === "all"}
                      onChange={() => toggleMember(member.member_id)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {member.nickname || member.email}
                      </div>
                      <div className="truncate text-xs text-gray-500 dark:text-gray-400">{member.email}</div>
                    </div>
                    <div className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {member.provider}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">발송 대상 미리보기</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  실제 발송 수와 마케팅 비동의 제외 수를 먼저 확인합니다.
                </p>
              </div>
              {previewLoading ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : null}
            </div>

            {preview ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                    <div className="text-xs text-gray-500 dark:text-gray-400">실제 발송 대상</div>
                    <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                      {preview.eligibleMemberCount.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                    <div className="text-xs text-gray-500 dark:text-gray-400">비동의 제외</div>
                    <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                      {preview.excludedMarketingCount.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="text-sm text-gray-500 dark:text-gray-400">
                  요청 대상 {preview.requestedMemberCount.toLocaleString()}명 중 발송 가능 {preview.eligibleMemberCount.toLocaleString()}명
                </div>

                <div className="flex flex-wrap gap-2">
                  {preview.previewRecipients.map((member) => (
                    <div
                      key={member.memberId}
                      className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                    >
                      {member.nickname || member.email}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                발송 대상 미리보기 버튼을 눌러 실제 대상 수를 확인하세요.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">발송 이력</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              누가, 언제, 누구에게, 몇 건 보냈는지와 결과 집계를 확인합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadHistory()}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-900"
          >
            새로고침
          </button>
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center p-8 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            이력 불러오는 중...
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            아직 발송 이력이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <article
                key={item.broadcastId}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900"
              >
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                        {item.title}
                      </h3>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${historyStatusClass(item.status)}`}>
                        {item.status === "scheduled"
                          ? "예약"
                          : item.status === "processing"
                            ? "처리 중"
                            : item.status === "sent"
                              ? "발송 완료"
                              : "실패"}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">{item.message}</p>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    #{item.broadcastId}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">앱 알림 생성</div>
                    <div className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{item.appNotificationCount.toLocaleString()}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">푸시 성공</div>
                    <div className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{item.pushSentCount.toLocaleString()}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">토큰 무효</div>
                    <div className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{item.invalidTokenCount.toLocaleString()}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">비동의 제외</div>
                    <div className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{item.excludedMarketingCount.toLocaleString()}</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-gray-600 dark:text-gray-300 lg:grid-cols-2">
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white">발송자:</span> {item.adminUsername || `#${item.adminId}`}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white">대상:</span>{" "}
                    {item.targetMode === "all" ? "전체 발송" : "선택 발송"} / 실제 {item.eligibleMemberCount.toLocaleString()}명
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white">생성 시각:</span> {formatDateTime(item.createdAt)}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white">예약 시각:</span> {formatDateTime(item.scheduledAt)}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white">발송 시각:</span> {formatDateTime(item.sentAt)}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white">푸시 사용:</span> {item.sendPush ? "예" : "아니오"}
                  </div>
                </div>

                {item.previewRecipients.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.previewRecipients.map((member) => (
                      <div
                        key={`${item.broadcastId}-${member.memberId}`}
                        className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      >
                        {member.nickname || member.email}
                      </div>
                    ))}
                  </div>
                ) : null}

                {item.errorMessage ? (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
                    <XCircle className="h-4 w-4" />
                    {item.errorMessage}
                  </div>
                ) : item.status === "sent" ? (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900/40 dark:bg-green-900/10 dark:text-green-300">
                    <CheckCircle2 className="h-4 w-4" />
                    발송 집계 완료
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
