"use client";

import { useEffect, useState } from "react";

interface AdminMe {
  admin_id: number;
  username: string;
  role: string;
  requiresPasswordChange: boolean;
  twoFactorEnabled: boolean;
  passwordChangedAt: string | null;
}

export default function AdminSecurityPage() {
  const [admin, setAdmin] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [disableForm, setDisableForm] = useState({ password: "", code: "" });

  const loadAdmin = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/me");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "관리자 정보를 불러오지 못했습니다.");
      }
      setAdmin(data);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "관리자 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmin();
  }, []);

  const submitPasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const response = await fetch("/api/admin/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(passwordForm),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "비밀번호 변경에 실패했습니다.");
      return;
    }
    setMessage("비밀번호를 변경했습니다.");
    setPasswordForm({ currentPassword: "", newPassword: "" });
    await loadAdmin();
  };

  const startTotpSetup = async () => {
    setError(null);
    setMessage(null);
    const response = await fetch("/api/admin/security/2fa/setup", { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "2FA 설정을 시작하지 못했습니다.");
      return;
    }
    setSetup({ secret: data.secret, qrDataUrl: data.qrDataUrl });
  };

  const enableTotp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const response = await fetch("/api/admin/security/2fa/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: totpCode }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "2FA 활성화에 실패했습니다.");
      return;
    }
    setMessage("2FA를 활성화했습니다.");
    setSetup(null);
    setTotpCode("");
    await loadAdmin();
  };

  const disableTotp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const response = await fetch("/api/admin/security/2fa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(disableForm),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "2FA 해제에 실패했습니다.");
      return;
    }
    setMessage("2FA를 해제했습니다.");
    setDisableForm({ password: "", code: "" });
    await loadAdmin();
  };

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">보안 설정</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          관리자 2FA, 비밀번호 변경, 보안 정책 상태를 관리합니다.
        </p>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">현재 보안 상태</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/50">
            <p className="text-xs text-gray-500">역할</p>
            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{admin?.role}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/50">
            <p className="text-xs text-gray-500">2FA</p>
            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{admin?.twoFactorEnabled ? "활성" : "비활성"}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/50">
            <p className="text-xs text-gray-500">비밀번호 상태</p>
            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{admin?.requiresPasswordChange ? "변경 필요" : "정상"}</p>
            <p className="mt-1 text-xs text-gray-500">최근 변경: {admin?.passwordChangedAt ? new Date(admin.passwordChangedAt).toLocaleString() : "기록 없음"}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">비밀번호 변경</h2>
        <form className="mt-4 space-y-4" onSubmit={submitPasswordChange}>
          <input type="password" placeholder="현재 비밀번호" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-900" />
          <input type="password" placeholder="새 비밀번호 (8자 이상)" value={passwordForm.newPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-900" />
          <button type="submit" className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">비밀번호 변경</button>
        </form>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">관리자 2FA</h2>
        {!admin?.twoFactorEnabled ? (
          <div className="mt-4 space-y-4">
            {!setup ? (
              <button type="button" onClick={startTotpSetup} className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white dark:bg-white dark:text-gray-900">2FA 설정 시작</button>
            ) : (
              <>
                <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400">인증 앱으로 QR을 스캔한 뒤 6자리 코드를 입력하세요.</p>
                  <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
                    <img src={setup.qrDataUrl} alt="2FA QR" width={180} height={180} className="rounded-lg border border-gray-200 bg-white p-2" />
                    <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                      <p>복구용 시크릿</p>
                      <code className="block rounded-lg bg-gray-100 px-3 py-2 text-xs dark:bg-gray-900">{setup.secret}</code>
                    </div>
                  </div>
                </div>
                <form className="space-y-3" onSubmit={enableTotp}>
                  <input type="text" inputMode="numeric" placeholder="6자리 인증 코드" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-900" />
                  <button type="submit" className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">2FA 활성화</button>
                </form>
              </>
            )}
          </div>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={disableTotp}>
            <p className="text-sm text-gray-600 dark:text-gray-400">2FA를 해제하려면 현재 비밀번호와 인증 코드를 입력하세요.</p>
            <input type="password" placeholder="현재 비밀번호" value={disableForm.password} onChange={(e) => setDisableForm((prev) => ({ ...prev, password: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-900" />
            <input type="text" inputMode="numeric" placeholder="6자리 인증 코드" value={disableForm.code} onChange={(e) => setDisableForm((prev) => ({ ...prev, code: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-900" />
            <button type="submit" className="rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-700">2FA 해제</button>
          </form>
        )}
      </section>
    </div>
  );
}
