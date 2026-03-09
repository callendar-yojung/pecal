"use client";

import { useEffect, useMemo, useState } from "react";

type SubscriptionItem = {
  subscriptionId: number;
  ownerId: number;
  ownerType: "team" | "personal";
  ownerName: string;
  planId: number;
  planName: string | null;
  planPrice: number;
  status: string;
  startedAt: string;
  endedAt: string | null;
  nextPaymentDate: string | null;
  retryCount: number;
  billingKeyMemberId: number | null;
  latestPaymentStatus: string | null;
  latestPaymentAt: string | null;
  latestPaymentMessage: string | null;
};

type HistoryItem = {
  kind: string;
  referenceId: number;
  ownerName: string;
  planName: string | null;
  status: string;
  message: string | null;
  happenedAt: string;
};

type ImpactPreview = {
  ownerType: "team" | "personal";
  ownerId: number;
  currentPlanName: string;
  targetPlanName: string;
  storageUsedBytes: number;
  targetStorageLimitBytes: number;
  memberCount: number;
  targetMaxMembers: number;
  willExceedStorage: boolean;
  willExceedMembers: boolean;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR");
}

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)}${units[index]}`;
}

export default function AdminBillingOpsPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<number | null>(null);
  const [targetPlanId, setTargetPlanId] = useState<string>("");
  const [preview, setPreview] = useState<ImpactPreview | null>(null);

  const selectedSubscription = useMemo(
    () => subscriptions.find((item) => item.subscriptionId === selectedSubscriptionId) ?? null,
    [selectedSubscriptionId, subscriptions],
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/billing-ops");
      if (!response.ok) throw new Error("failed");
      const data = await response.json();
      setSubscriptions(data.subscriptions ?? []);
      setHistory(data.history ?? []);
      setSelectedSubscriptionId((current) => current ?? data.subscriptions?.[0]?.subscriptionId ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const callAction = async (action: "resync" | "retry") => {
    if (!selectedSubscription) return;
    setBusyId(selectedSubscription.subscriptionId);
    try {
      const response = await fetch("/api/admin/billing-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, subscription_id: selectedSubscription.subscriptionId }),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "처리에 실패했습니다.");
        return;
      }
      alert(action === "retry" ? "결제 재시도를 실행했습니다." : "구독 상태를 재동기화했습니다.");
      await fetchData();
    } finally {
      setBusyId(null);
    }
  };

  const loadPreview = async () => {
    if (!selectedSubscription || !targetPlanId) return;
    const response = await fetch("/api/admin/billing-ops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "preview_plan_change",
        owner_type: selectedSubscription.ownerType,
        owner_id: selectedSubscription.ownerId,
        target_plan_id: Number(targetPlanId),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      alert(data.error || "미리보기에 실패했습니다.");
      return;
    }
    setPreview(data.preview ?? null);
  };

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">결제 운영</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">구독 상태 재동기화, 실패 결제 재시도, 환불/해지 이력을 운영 관점에서 관리합니다.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr,0.9fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">구독 상태 재동기화 / 실패 결제 재시도</h2>
          <div className="space-y-3 lg:hidden">
            {subscriptions.map((item) => (
              <button
                key={item.subscriptionId}
                type="button"
                onClick={() => setSelectedSubscriptionId(item.subscriptionId)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  selectedSubscriptionId === item.subscriptionId
                    ? "border-blue-300 bg-blue-50/70 dark:border-blue-700 dark:bg-blue-950/20"
                    : "border-gray-200 hover:border-blue-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-blue-900 dark:hover:bg-gray-900/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{item.ownerName}</div>
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      {item.planName ?? "-"} · {item.status}
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                    <div>최근 결제</div>
                    <div className="mt-1 font-medium text-gray-700 dark:text-gray-200">
                      {item.latestPaymentStatus ?? "기록 없음"}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  다음 결제일 {formatDate(item.nextPaymentDate)}
                </div>
              </button>
            ))}
          </div>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400">
                  <th className="pb-3 pr-4">오너</th>
                  <th className="pb-3 pr-4">플랜</th>
                  <th className="pb-3 pr-4">상태</th>
                  <th className="pb-3 pr-4">최근 결제</th>
                  <th className="pb-3 pr-4">다음 결제일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {subscriptions.map((item) => (
                  <tr
                    key={item.subscriptionId}
                    className={`cursor-pointer ${selectedSubscriptionId === item.subscriptionId ? "bg-blue-50/70 dark:bg-blue-950/20" : ""}`}
                    onClick={() => setSelectedSubscriptionId(item.subscriptionId)}
                  >
                    <td className="py-3 pr-4 font-medium text-gray-900 dark:text-white">{item.ownerName}</td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{item.planName ?? "-"}</td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{item.status}</td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{item.latestPaymentStatus ?? "기록 없음"}</td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{formatDate(item.nextPaymentDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">선택 구독 운영</h2>
          {selectedSubscription ? (
            <div className="mt-4 space-y-4 text-sm">
              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <div className="font-semibold text-gray-900 dark:text-white">{selectedSubscription.ownerName}</div>
                <div className="mt-1 text-gray-600 dark:text-gray-300">{selectedSubscription.planName ?? "-"} · {selectedSubscription.status}</div>
                <div className="mt-1 text-gray-500 dark:text-gray-400">최근 결제: {selectedSubscription.latestPaymentStatus ?? "없음"}</div>
                {selectedSubscription.latestPaymentMessage ? (
                  <div className="mt-2 text-xs text-red-600 dark:text-red-300">{selectedSubscription.latestPaymentMessage}</div>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" disabled={busyId === selectedSubscription.subscriptionId} onClick={() => void callAction("resync")} className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">상태 재동기화</button>
                <button type="button" disabled={busyId === selectedSubscription.subscriptionId} onClick={() => void callAction("retry")} className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">실패 결제 재시도</button>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">플랜 변경 영향 미리보기</h3>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input value={targetPlanId} onChange={(event) => setTargetPlanId(event.target.value)} placeholder="대상 plan_id" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                  <button type="button" onClick={() => void loadPreview()} className="rounded-lg border border-blue-300 px-4 py-2 font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/30">미리보기</button>
                </div>
                {preview ? (
                  <div className="mt-3 grid gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                    <div>현재 플랜: {preview.currentPlanName}</div>
                    <div>대상 플랜: {preview.targetPlanName}</div>
                    <div>저장소: {formatBytes(preview.storageUsedBytes)} / {formatBytes(preview.targetStorageLimitBytes)}</div>
                    <div>멤버: {preview.memberCount} / {preview.targetMaxMembers}</div>
                    {preview.willExceedStorage ? <div className="text-red-600 dark:text-red-300">저장소 한도 초과 위험</div> : null}
                    {preview.willExceedMembers ? <div className="text-red-600 dark:text-red-300">멤버 수 한도 초과 위험</div> : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">구독을 선택하세요.</div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">환불 / 해지 이력</h2>
        <div className="space-y-3">
          {history.map((item) => (
            <div key={`${item.kind}-${item.referenceId}`} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{item.ownerName} · {item.kind === "refund" ? "환불" : "해지/만료"}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">{item.planName ?? "플랜 없음"} · {item.status}</div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{formatDate(item.happenedAt)}</div>
              </div>
              {item.message ? <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">{item.message}</div> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
