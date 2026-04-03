"use client";

import { useEffect, useState } from "react";

type Policy = {
  platform: "ios" | "android";
  minSupportedVersion: string | null;
  recommendedVersion: string | null;
  forceUpdateEnabled: boolean;
  updateMessage: string | null;
  updatedByAdminId: number | null;
  updatedAt: string;
};

type VersionDistribution = {
  platform: "ios" | "android";
  appVersion: string;
  userCount: number;
  belowMin: boolean;
  belowRecommended: boolean;
};

type WidgetFailure = {
  eventId: number;
  memberId: number | null;
  platform: string;
  appVersion: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

type MobileOpsData = {
  policies: Policy[];
  widgetFailures24h: number;
  widgetFailures: WidgetFailure[];
  versionDistribution: VersionDistribution[];
  oldVersionWarnings: Array<{ platform: string; belowMinCount: number; belowRecommendedCount: number }>;
};

export default function AdminMobileOpsPage() {
  const [data, setData] = useState<MobileOpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/mobile-ops");
      if (!response.ok) throw new Error("failed");
      const payload = await response.json();
      setData(payload);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const savePolicy = async (policy: Policy) => {
    setSavingPlatform(policy.platform);
    try {
      const response = await fetch("/api/admin/mobile-ops", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: policy.platform,
          min_supported_version: policy.minSupportedVersion,
          recommended_version: policy.recommendedVersion,
          force_update_enabled: policy.forceUpdateEnabled,
          update_message: policy.updateMessage,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        alert(result.error || "정책 저장에 실패했습니다.");
        return;
      }
      await fetchData();
    } finally {
      setSavingPlatform(null);
    }
  };

  if (loading || !data) return <div className="p-8 text-sm text-muted-foreground">로딩 중...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">위젯 / 모바일 운영</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">위젯 갱신 실패, 모바일 버전 분포, 오래된 앱 경고와 강제 업데이트 정책을 관리합니다.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-sm text-gray-500 dark:text-gray-400">위젯 갱신 실패 (24시간)</div><div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{data.widgetFailures24h}</div></div>
        {data.oldVersionWarnings.map((warning) => (
          <div key={warning.platform} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="text-sm text-gray-500 dark:text-gray-400">{warning.platform.toUpperCase()} 오래된 앱</div>
            <div className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">최소 버전 미만 {warning.belowMinCount}명</div>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">권장 버전 미만 {warning.belowRecommendedCount}명</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">강제 업데이트 정책</h2>
          <div className="space-y-4">
            {data.policies.map((policy) => (
              <PolicyEditor key={policy.platform} policy={policy} saving={savingPlatform === policy.platform} onSave={savePolicy} />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">모바일 버전별 사용자 수</h2>
          <div className="space-y-3 text-sm">
            {data.versionDistribution.map((item) => (
              <div key={`${item.platform}-${item.appVersion}`} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{item.platform.toUpperCase()} · {item.appVersion}</div>
                    <div className="mt-1 text-gray-600 dark:text-gray-300">사용자 {item.userCount}명</div>
                  </div>
                  <div className="space-y-1 text-right text-xs">
                    {item.belowMin ? <div className="text-red-600 dark:text-red-300">최소 버전 미만</div> : null}
                    {item.belowRecommended ? <div className="text-amber-600 dark:text-amber-300">권장 버전 미만</div> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">위젯 데이터 갱신 실패 로그</h2>
        <div className="space-y-3 text-sm">
          {data.widgetFailures.map((item) => (
            <div key={item.eventId} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{item.platform.toUpperCase()} · {item.appVersion ?? "unknown"}</div>
                  <div className="mt-1 text-gray-600 dark:text-gray-300">member_id: {item.memberId ?? "-"}</div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(item.createdAt).toLocaleString("ko-KR")}</div>
              </div>
              {item.payload ? <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300">{JSON.stringify(item.payload, null, 2)}</pre> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PolicyEditor({ policy, saving, onSave }: { policy: Policy; saving: boolean; onSave: (policy: Policy) => Promise<void> }) {
  const [form, setForm] = useState(policy);

  useEffect(() => {
    setForm(policy);
  }, [policy]);

  return (
    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
      <div className="mb-3 font-semibold text-gray-900 dark:text-white">{policy.platform.toUpperCase()}</div>
      <div className="grid gap-3 md:grid-cols-2">
        <input value={form.minSupportedVersion ?? ""} onChange={(event) => setForm((current) => ({ ...current, minSupportedVersion: event.target.value || null }))} placeholder="최소 지원 버전" className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
        <input value={form.recommendedVersion ?? ""} onChange={(event) => setForm((current) => ({ ...current, recommendedVersion: event.target.value || null }))} placeholder="권장 버전" className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
      </div>
      <textarea value={form.updateMessage ?? ""} onChange={(event) => setForm((current) => ({ ...current, updateMessage: event.target.value || null }))} placeholder="업데이트 안내 문구" className="mt-3 min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
      <label className="mt-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={form.forceUpdateEnabled} onChange={(event) => setForm((current) => ({ ...current, forceUpdateEnabled: event.target.checked }))} /> 강제 업데이트 사용
      </label>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs text-gray-500 dark:text-gray-400">최근 수정: {new Date(policy.updatedAt).toLocaleString("ko-KR")}</div>
        <button type="button" disabled={saving} onClick={() => void onSave(form)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">정책 저장</button>
      </div>
    </div>
  );
}
