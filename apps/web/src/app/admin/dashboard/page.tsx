"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Building2,
  CreditCard,
  ClipboardList,
  UserPlus,
  ChartBar,
  Settings,
} from "lucide-react";

interface DashboardStats {
  totalMembers: number;
  totalTeams: number;
  activeSubscriptions: number;
  totalTasks: number;
  recentMembers: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/admin/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          대시보드
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          시스템 전체 현황을 한눈에 확인하세요
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 ${card.color} rounded-lg`}>
                <card.icon className="h-5 w-5 text-white" />
              </div>
              {card.change && (
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                  {card.change}
                </span>
              )}
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              {card.title}
            </h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {card.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* 최근 활동 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 시스템 상태 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            시스템 상태
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                데이터베이스
              </span>
              <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs font-medium rounded">
                정상
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                API 서버
              </span>
              <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs font-medium rounded">
                정상
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                스토리지
              </span>
              <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs font-medium rounded">
                정상
              </span>
            </div>
          </div>
        </div>

        {/* 빠른 작업 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            빠른 작업
          </h2>
          <div className="space-y-2">
            <button className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <UserPlus className="h-4 w-4" />
              새 관리자 추가
            </button>
            <button className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <ChartBar className="h-4 w-4" />
              상세 리포트 보기
            </button>
            <button className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <Settings className="h-4 w-4" />
              시스템 설정
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
