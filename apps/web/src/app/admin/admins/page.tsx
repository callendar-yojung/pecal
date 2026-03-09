"use client";

import { useEffect, useMemo, useState } from "react";

type AdminRole = "SUPER_ADMIN" | "OPS" | "BILLING";

interface Admin {
  admin_id: number;
  username: string;
  name: string;
  email: string;
  role: AdminRole;
  created_at: string;
  last_login: string | null;
  two_factor_enabled?: boolean;
  password_changed_at?: string | null;
  force_password_change?: boolean;
}

const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "SUPER_ADMIN",
  OPS: "OPS",
  BILLING: "BILLING",
};

export default function AdminAdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>(["SUPER_ADMIN", "OPS", "BILLING"]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({ username: "", password: "", name: "", email: "", role: "OPS" as AdminRole });
  const [savingId, setSavingId] = useState<number | null>(null);

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/admins");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "관리자 목록을 불러오지 못했습니다.");
      }
      setAdmins(data.admins ?? []);
      setRoles(data.roles ?? ["SUPER_ADMIN", "OPS", "BILLING"]);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "관리자 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const response = await fetch("/api/admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...createForm, force_password_change: true }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "관리자 생성에 실패했습니다.");
      return;
    }
    setMessage("관리자를 생성했습니다. 첫 로그인 시 비밀번호 변경이 필요합니다.");
    setCreateForm({ username: "", password: "", name: "", email: "", role: "OPS" });
    await loadAdmins();
  };

  const updateAdmin = async (admin: Admin, patch: Partial<Admin>) => {
    setSavingId(admin.admin_id);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/admin/admins", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_id: admin.admin_id, ...patch }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "관리자 수정에 실패했습니다.");
      setSavingId(null);
      return;
    }
    setMessage("관리자 설정을 저장했습니다.");
    await loadAdmins();
    setSavingId(null);
  };

  const stats = useMemo(() => ({
    total: admins.length,
    superAdmins: admins.filter((item) => item.role === "SUPER_ADMIN").length,
    ops: admins.filter((item) => item.role === "OPS").length,
    billing: admins.filter((item) => item.role === "BILLING").length,
  }), [admins]);

  if (loading) {
    return <div className="p-12 text-center text-muted-foreground">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">관리자 관리</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">관리자 역할과 비밀번호 변경 강제 정책을 관리합니다.</p>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">관리자 추가</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreate}>
          <input value={createForm.username} onChange={(e) => setCreateForm((prev) => ({ ...prev, username: e.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-900" placeholder="아이디" />
          <input value={createForm.password} onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))} type="password" className="rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-900" placeholder="초기 비밀번호" />
          <input value={createForm.name} onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-900" placeholder="이름" />
          <input value={createForm.email} onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-900" placeholder="이메일" />
          <select value={createForm.role} onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value as AdminRole }))} className="rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
            {roles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
          </select>
          <button type="submit" className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">관리자 생성</button>
        </form>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="전체 관리자" value={stats.total} />
        <StatCard label="SUPER_ADMIN" value={stats.superAdmins} />
        <StatCard label="OPS" value={stats.ops} />
        <StatCard label="BILLING" value={stats.billing} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px]">
            <thead className="bg-gray-50 dark:bg-gray-900/40">
              <tr>
                {['아이디','이름','이메일','역할','2FA','비밀번호 상태','마지막 로그인','작업'].map((label) => (
                  <th key={label} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {admins.map((admin) => (
                <tr key={admin.admin_id} className="align-top">
                  <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">
                    <div className="font-medium">{admin.username}</div>
                    <div className="text-xs text-gray-500">#{admin.admin_id}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">{admin.name}</td>
                  <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{admin.email}</td>
                  <td className="px-4 py-4">
                    <select defaultValue={admin.role} onChange={(e) => updateAdmin(admin, { role: e.target.value as AdminRole })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
                      {roles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">{admin.two_factor_enabled ? '활성' : '비활성'}</td>
                  <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">
                    <div>{admin.force_password_change ? '변경 강제' : '정상'}</div>
                    <div className="mt-2">
                      <button type="button" disabled={savingId === admin.admin_id} onClick={() => updateAdmin(admin, { force_password_change: !admin.force_password_change })} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium dark:border-gray-700">
                        {admin.force_password_change ? '강제 해제' : '변경 강제'}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{admin.last_login ? new Date(admin.last_login).toLocaleString() : '-'}</td>
                  <td className="px-4 py-4 text-xs text-gray-500">{admin.password_changed_at ? `최근 변경: ${new Date(admin.password_changed_at).toLocaleDateString()}` : '변경 기록 없음'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}
