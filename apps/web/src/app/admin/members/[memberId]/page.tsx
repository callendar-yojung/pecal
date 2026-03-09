"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AdminMemberSupportPanel } from "@/components/admin/AdminMemberSupportPanel";
import type { AdminMemberSupportSnapshot } from "@/lib/admin-member-support";

export default function AdminMemberDetailPage() {
  const params = useParams<{ memberId: string }>();
  const memberId = Number(params.memberId);
  const [support, setSupport] = useState<AdminMemberSupportSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  useEffect(() => {
    const fetchSupport = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/members/${memberId}/support`);
        const data = await response.json();
        if (!response.ok) {
          setError(data.error || "회원 지원 정보를 불러오지 못했습니다.");
          setSupport(null);
          return;
        }
        setSupport(data);
      } catch (fetchError) {
        console.error("Failed to load member support page:", fetchError);
        setError("회원 지원 정보를 불러오지 못했습니다.");
        setSupport(null);
      } finally {
        setLoading(false);
      }
    };

    if (Number.isInteger(memberId) && memberId > 0) {
      void fetchSupport();
    } else {
      setError("잘못된 회원 ID입니다.");
      setLoading(false);
    }
  }, [memberId]);

  const handleForceLogout = async (sessionId: string) => {
    setRevokingSessionId(sessionId);
    try {
      const response = await fetch(`/api/admin/members/${memberId}/sessions/${sessionId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "세션 종료에 실패했습니다.");
        return;
      }
      setSupport((current) =>
        current
          ? {
              ...current,
              sessions: current.sessions.filter(
                (session) => session.sessionId !== sessionId,
              ),
            }
          : current,
      );
    } catch (revokeError) {
      console.error("Failed to revoke session from detail page:", revokeError);
      alert("세션 종료 중 오류가 발생했습니다.");
    } finally {
      setRevokingSessionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            회원 지원 상세
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            회원별 세션, 알림, 푸시 토큰, 플랜 사용량과 알림 진단 정보를 확인합니다.
          </p>
        </div>
        <Link
          href="/admin/members"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          회원 목록으로
        </Link>
      </div>

      <AdminMemberSupportPanel
        support={support}
        loading={loading}
        error={error}
        selectedMemberId={Number.isInteger(memberId) ? memberId : null}
        revokingSessionId={revokingSessionId}
        onForceLogout={handleForceLogout}
      />
    </div>
  );
}
