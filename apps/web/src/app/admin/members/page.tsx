"use client";

import { useEffect, useState } from "react";
import { AdminMemberSupportPanel } from "@/components/admin/AdminMemberSupportPanel";
import type { AdminMemberSupportSnapshot } from "@/lib/admin-member-support";

interface Member {
  member_id: number;
  email: string;
  nickname: string;
  provider: string;
  created_at: string;
  lasted_at: string;
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [support, setSupport] = useState<AdminMemberSupportSnapshot | null>(null);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await fetch("/api/admin/members");
        if (response.ok) {
          const data = await response.json();
          setMembers(data);
        }
      } catch (error) {
        console.error("Failed to fetch members:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, []);

  useEffect(() => {
    if (!selectedMemberId) {
      setSupport(null);
      setSupportError(null);
      return;
    }

    const fetchSupport = async () => {
      setSupportLoading(true);
      setSupportError(null);
      try {
        const response = await fetch(
          `/api/admin/members/${selectedMemberId}/support`,
        );
        const data = await response.json();
        if (!response.ok) {
          setSupportError(data.error || "회원 지원 정보를 불러오지 못했습니다.");
          setSupport(null);
          return;
        }
        setSupport(data);
      } catch (error) {
        console.error("Failed to fetch member support:", error);
        setSupportError("회원 지원 정보를 불러오지 못했습니다.");
        setSupport(null);
      } finally {
        setSupportLoading(false);
      }
    };

    void fetchSupport();
  }, [selectedMemberId]);

  const filteredMembers = members.filter(
    (member) =>
      member.email?.toLowerCase().includes(search.toLowerCase()) ||
      member.nickname?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleOpenSupport = (memberId: number) => {
    setSelectedMemberId(memberId);
  };

  const handleForceLogout = async (sessionId: string) => {
    if (!selectedMemberId) return;
    setRevokingSessionId(sessionId);
    try {
      const response = await fetch(
        `/api/admin/members/${selectedMemberId}/sessions/${sessionId}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "세션 종료에 실패했습니다.");
        return;
      }

      setSupport((current: AdminMemberSupportSnapshot | null) =>
        current
          ? {
              ...current,
              sessions: current.sessions.filter(
                (session: AdminMemberSupportSnapshot["sessions"][number]) =>
                  session.sessionId !== sessionId,
              ),
            }
          : current,
      );
    } catch (error) {
      console.error("Failed to revoke member session:", error);
      alert("세션 종료 중 오류가 발생했습니다.");
    } finally {
      setRevokingSessionId(null);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            회원 관리
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            전체 회원 목록을 조회하고 관리합니다
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <input
          type="text"
          placeholder="이메일 또는 닉네임으로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      이메일
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      닉네임
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      제공자
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      가입일
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      마지막 로그인
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredMembers.map((member) => (
                    <tr
                      key={member.member_id}
                      className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        selectedMemberId === member.member_id
                          ? "bg-blue-50 dark:bg-blue-950/20"
                          : ""
                      }`}
                      onClick={() => handleOpenSupport(member.member_id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {member.member_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {member.email || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {member.nickname || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                          {member.provider}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(member.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {member.lasted_at
                          ? new Date(member.lasted_at).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredMembers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  검색 결과가 없습니다.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                전체 회원
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {members.length}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Kakao 회원
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {members.filter((m) => m.provider === "kakao").length}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Google 회원
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {members.filter((m) => m.provider === "google").length}
              </p>
            </div>
          </div>
        </div>
        <div>
          <AdminMemberSupportPanel
            support={support}
            loading={supportLoading}
            error={supportError}
            selectedMemberId={selectedMemberId}
            revokingSessionId={revokingSessionId}
            onForceLogout={handleForceLogout}
            showDetailLink
          />
        </div>
      </div>
    </div>
  );
}
