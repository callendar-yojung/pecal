"use client";

import { useEffect, useState } from "react";

type UploadPolicy = { planId: number; name: string; planType: string; maxStorageMb: number; maxFileSizeMb: number };
type PreviewSupport = { label: string; extensions: readonly string[]; mode: string };
type FileRow = { fileId: number; name: string; sizeBytes: number; createdAt: string; mimeType?: string | null; path?: string };

type FileOpsData = {
  uploadFailures24h: number;
  previewPending24h: number;
  previewFailed24h: number;
  orphanFileCount: number;
  orphanFiles: FileRow[];
  largeFiles: FileRow[];
  mimeDistribution: Array<{ mimeType: string; count: number }>;
  uploadPolicies: UploadPolicy[];
  previewSupport: PreviewSupport[];
};

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)}${units[index]}`;
}

export default function AdminFileOpsPage() {
  const [data, setData] = useState<FileOpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/file-ops");
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

  const runAction = async (action: "cleanup_orphan_files" | "recalculate_storage", dryRun = true) => {
    setBusy(action);
    try {
      const response = await fetch("/api/admin/file-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, dry_run: dryRun }),
      });
      const result = await response.json();
      if (!response.ok) {
        alert(result.error || "작업에 실패했습니다.");
        return;
      }
      alert(JSON.stringify(result.result));
      await fetchData();
    } finally {
      setBusy(null);
    }
  };

  if (loading || !data) return <div className="p-8 text-sm text-muted-foreground">로딩 중...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">파일 / 문서 운영</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">업로드 제한 정책, 미리보기 지원 현황, orphan 파일 및 저장소 운영 도구를 관리합니다.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-sm text-gray-500 dark:text-gray-400">업로드 실패 (24시간)</div><div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{data.uploadFailures24h}</div></div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-sm text-gray-500 dark:text-gray-400">문서 변환 대기 (24시간)</div><div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{data.previewPending24h}</div></div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-sm text-gray-500 dark:text-gray-400">orphan 파일</div><div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{data.orphanFileCount}</div></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">업로드 제한 정책</h2>
          <div className="space-y-3 text-sm">
            {data.uploadPolicies.map((policy) => (
              <div key={policy.planId} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <div className="font-medium text-gray-900 dark:text-white">{policy.name} <span className="text-xs text-gray-500">({policy.planType})</span></div>
                <div className="mt-1 text-gray-600 dark:text-gray-300">최대 저장소 {policy.maxStorageMb}MB · 최대 파일 {policy.maxFileSizeMb}MB</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">파일 타입별 미리보기 지원</h2>
          <div className="space-y-3 text-sm">
            {data.previewSupport.map((item) => (
              <div key={item.label} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <div className="font-medium text-gray-900 dark:text-white">{item.label}</div>
                <div className="mt-1 text-gray-600 dark:text-gray-300">{item.extensions.join(", ")}</div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.mode}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">대용량 파일</h2>
            <button type="button" disabled={busy === "recalculate_storage"} onClick={() => void runAction("recalculate_storage", false)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">저장소 재계산</button>
          </div>
          <div className="space-y-3 text-sm">
            {data.largeFiles.map((file) => (
              <div key={file.fileId} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <div className="font-medium text-gray-900 dark:text-white">{file.name}</div>
                <div className="mt-1 text-gray-600 dark:text-gray-300">{formatBytes(file.sizeBytes)} · {file.mimeType ?? "unknown"}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">orphan 파일 정리 도구</h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" disabled={busy === "cleanup_orphan_files"} onClick={() => void runAction("cleanup_orphan_files", true)} className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/30">Dry run</button>
              <button type="button" disabled={busy === "cleanup_orphan_files"} onClick={() => void runAction("cleanup_orphan_files", false)} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">실제 삭제</button>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            {data.orphanFiles.map((file) => (
              <div key={file.fileId} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <div className="font-medium text-gray-900 dark:text-white">{file.name}</div>
                <div className="mt-1 text-gray-600 dark:text-gray-300">{formatBytes(file.sizeBytes)} · {new Date(file.createdAt).toLocaleString("ko-KR")}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
