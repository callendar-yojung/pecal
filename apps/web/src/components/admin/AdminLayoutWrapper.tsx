"use client";

import {
  Bell,
  Building2,
  CreditCard,
  FileWarning,
  History,
  KeyRound,
  LayoutDashboard,
  Menu,
  Package,
  Smartphone,
  UserCog,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type AdminRole = "SUPER_ADMIN" | "OPS" | "BILLING";

interface Admin {
  admin_id: number;
  username: string;
  role: AdminRole;
  requiresPasswordChange?: boolean;
  twoFactorEnabled?: boolean;
}

interface HealthItem {
  component: "db" | "redis" | "push" | "billingWebhook" | "storage";
  status: "ok" | "warn" | "error";
  message: string;
  checkedAt: string;
}

const MENU_ITEMS: Array<{
  name: string;
  path: string;
  icon: typeof LayoutDashboard;
  roles: AdminRole[];
}> = [
  { name: "대시보드", path: "/admin/dashboard", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "OPS", "BILLING"] },
  { name: "회원 관리", path: "/admin/members", icon: Users, roles: ["SUPER_ADMIN", "OPS"] },
  { name: "팀 관리", path: "/admin/teams", icon: Building2, roles: ["SUPER_ADMIN", "OPS"] },
  { name: "구독 관리", path: "/admin/subscriptions", icon: CreditCard, roles: ["SUPER_ADMIN", "BILLING"] },
  { name: "플랜 관리", path: "/admin/plans", icon: Package, roles: ["SUPER_ADMIN", "BILLING"] },
  { name: "결제 운영", path: "/admin/billing-ops", icon: CreditCard, roles: ["SUPER_ADMIN", "BILLING"] },
  { name: "파일 운영", path: "/admin/file-ops", icon: FileWarning, roles: ["SUPER_ADMIN", "OPS"] },
  { name: "모바일 운영", path: "/admin/mobile-ops", icon: Smartphone, roles: ["SUPER_ADMIN", "OPS", "BILLING"] },
  { name: "알림 발송", path: "/admin/notifications", icon: Bell, roles: ["SUPER_ADMIN", "OPS"] },
  { name: "감사 로그", path: "/admin/audit-logs", icon: History, roles: ["SUPER_ADMIN", "OPS", "BILLING"] },
  { name: "보안 설정", path: "/admin/security", icon: KeyRound, roles: ["SUPER_ADMIN", "OPS", "BILLING"] },
  { name: "관리자 관리", path: "/admin/admins", icon: UserCog, roles: ["SUPER_ADMIN"] },
];

export default function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [health, setHealth] = useState<{ overallStatus: "ok" | "warn" | "error"; checkedAt: string | null; items: HealthItem[] } | null>(null);

  const fetchAdmin = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/admin/me");
      if (!response.ok) {
        router.push("/admin/login");
        return;
      }
      const data = await response.json();
      setAdmin(data);
      if (data.requiresPasswordChange && pathname !== "/admin/security") {
        router.push("/admin/security");
      }
    } catch (error) {
      console.error("Admin auth check error:", error);
      router.push("/admin/login");
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    fetchAdmin();
  }, [fetchAdmin]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!admin) return;
    const fetchHealth = async () => {
      try {
        const response = await fetch("/api/admin/health");
        if (!response.ok) return;
        const data = await response.json();
        setHealth({ overallStatus: data.overallStatus, checkedAt: data.checkedAt ?? null, items: data.items ?? [] });
      } catch (error) {
        console.error("Health check error:", error);
      }
    };
    fetchHealth();
  }, [admin, pathname]);

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.push("/admin/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const menuItems = useMemo(
    () => MENU_ITEMS.filter((item) => (admin ? item.roles.includes(admin.role) : false)),
    [admin],
  );

  useEffect(() => {
    if (!admin) return;
    const allowedPaths = new Set(menuItems.map((item) => item.path));
    if (pathname.startsWith("/admin") && pathname !== "/admin/security" && pathname !== "/admin/login") {
      const isAllowed = Array.from(allowedPaths).some(
        (path) => pathname === path || pathname.startsWith(`${path}/`),
      );
      if (!isAllowed) {
        const fallback = menuItems[0]?.path ?? "/admin/security";
        router.replace(fallback);
      }
    }
  }, [admin, menuItems, pathname, router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="text-muted-foreground">로딩 중...</div></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 lg:hidden">
        <div className="inline-flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
          <Wrench className="h-5 w-5" /> 관리자 페이지
        </div>
        <button type="button" onClick={() => setMenuOpen((current) => !current)} className="rounded-lg border border-gray-200 p-2 text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800" aria-label="관리자 메뉴 열기">
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {menuOpen ? <button type="button" aria-label="메뉴 닫기" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-20 bg-black/40 lg:hidden" /> : null}

      <aside className={`fixed left-0 top-0 z-30 flex h-full w-[82vw] max-w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 transition-transform lg:w-64 ${menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="border-b border-gray-200 p-6 dark:border-gray-700">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white"><span className="inline-flex items-center gap-2"><Wrench className="h-5 w-5" /> 관리자 페이지</span></h1>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {menuItems.map((item) => {
            const isActive =
              pathname === item.path ||
              pathname.startsWith(`${item.path}/`);
            const Icon = item.icon;
            return (
              <button key={item.path} type="button" onClick={() => { setMenuOpen(false); router.push(item.path); }} className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${isActive ? "bg-blue-50 font-medium text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"}`}>
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
              {admin?.username?.charAt(0)?.toUpperCase() ?? "A"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{admin?.username}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{admin?.role}</p>
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="w-full rounded-lg px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20">로그아웃</button>
        </div>
      </aside>

      <main className="min-h-screen lg:ml-64">
        <div className="p-4 sm:p-6 lg:p-8">
          {admin?.requiresPasswordChange ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              관리자 비밀번호를 변경해야 다른 운영 기능을 사용할 수 있습니다.
            </div>
          ) : null}
          {health ? (
            <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${health.overallStatus === "error" ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200" : health.overallStatus === "warn" ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200" : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"}`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold">시스템 상태 {health.overallStatus === "error" ? "오류" : health.overallStatus === "warn" ? "주의" : "정상"}</p>
                  <p className="mt-1 text-xs opacity-80">최근 확인: {health.checkedAt ? new Date(health.checkedAt).toLocaleString() : "없음"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {health.items.map((item) => (
                    <span key={item.component} className={`rounded-full px-3 py-1 text-xs font-medium ${item.status === "error" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200" : item.status === "warn" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"}`}>
                      {item.component.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          {children}
        </div>
      </main>
    </div>
  );
}
