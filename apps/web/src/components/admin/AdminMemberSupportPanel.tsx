"use client";

import Link from "next/link";
import type { AdminMemberSupportSnapshot } from "@/lib/admin-member-support";

export function AdminMemberSupportPanel(props: {
  support: AdminMemberSupportSnapshot | null;
  loading: boolean;
  error: string | null;
  selectedMemberId: number | null;
  revokingSessionId: string | null;
  onForceLogout: (sessionId: string) => void | Promise<void>;
  showDetailLink?: boolean;
}) {
  const {
    support,
    loading,
    error,
    selectedMemberId,
    revokingSessionId,
    onForceLogout,
    showDetailLink = false,
  } = props;

  if (!selectedMemberId) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        회원을 선택하면 세션, 최근 알림, 푸시 토큰, 플랜/저장소 사용량, 알림 진단 정보를 확인할 수 있습니다.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        회원 지원 정보를 불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (!support) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {support.member.nickname || support.member.email}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {support.member.email || "-"} · {support.member.provider}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {showDetailLink && (
              <Link
                href={`/admin/members/${support.member.memberId}`}
                className="rounded-full bg-gray-900 px-3 py-1 text-white dark:bg-white dark:text-gray-900"
              >
                상세 페이지
              </Link>
            )}
            <span
              className={`rounded-full px-3 py-1 ${
                support.member.marketingConsent
                  ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                  : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
              }`}
            >
              마케팅 {support.member.marketingConsent ? "동의" : "비동의"}
            </span>
            <span
              className={`rounded-full px-3 py-1 ${
                support.member.privacyConsent
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              개인정보 {support.member.privacyConsent ? "동의" : "미동의"}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              가입일
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
              {support.member.createdAt
                ? new Date(support.member.createdAt).toLocaleString()
                : "-"}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              마지막 로그인
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
              {support.member.lastLoginAt
                ? new Date(support.member.lastLoginAt).toLocaleString()
                : "-"}
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              마케팅/개인정보 동의 이력
            </p>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {support.member.consentHistory.length}건
            </span>
          </div>
          {support.member.consentHistory.length > 0 ? (
            <div className="mt-3 space-y-2">
              {support.member.consentHistory.map((item) => (
                <div
                  key={item.historyId}
                  className="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900/50"
                >
                  <p className="font-medium text-gray-900 dark:text-white">
                    {item.consentType === "marketing" ? "마케팅" : "개인정보"}:{" "}
                    {item.previousValue ? "동의" : "미동의"} →{" "}
                    {item.currentValue ? "동의" : "미동의"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(item.changedAt).toLocaleString()} · {item.changedByType}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              저장된 동의 변경 이력이 없습니다.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          왜 알림이 안 갔는지 진단
        </h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
            <p className="text-sm text-gray-500 dark:text-gray-400">활성 푸시 토큰</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {support.deliveryDiagnosis.activePushTokenCount}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
            <p className="text-sm text-gray-500 dark:text-gray-400">비활성 푸시 토큰</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {support.deliveryDiagnosis.inactivePushTokenCount}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
            <p className="text-sm text-gray-500 dark:text-gray-400">최근 관리자 알림</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {support.deliveryDiagnosis.recentAdminBroadcastCount}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {support.deliveryDiagnosis.lastAdminBroadcastAt
                ? new Date(support.deliveryDiagnosis.lastAdminBroadcastAt).toLocaleString()
                : "없음"}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">주요 차단 사유</p>
            {support.deliveryDiagnosis.blockers.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700 dark:text-red-200">
                {support.deliveryDiagnosis.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-red-700 dark:text-red-200">
                현재 상태 기준으로 즉시 보이는 차단 사유는 없습니다.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">참고 신호</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-700 dark:text-blue-200">
              {support.deliveryDiagnosis.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            발송건 기준 알림 진단
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {support.broadcastHistory.length}건
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {support.broadcastHistory.length > 0 ? (
            support.broadcastHistory.map((item) => (
              <div
                key={item.broadcastId}
                className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {item.message}
                    </p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"} ·{" "}
                      {item.targetMode === "all" ? "전체 발송" : "선택 발송"} ·{" "}
                      {item.sendPush ? "푸시 포함" : "인앱만"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        item.inAppNotificationCreated
                          ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                          : item.requestedForMember
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {item.inAppNotificationCreated
                        ? "인앱 생성됨"
                        : item.requestedForMember
                          ? "대상이었음"
                          : "대상 아님"}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      상태 {item.status}
                    </span>
                  </div>
                </div>
                <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-900/50 dark:text-gray-300">
                  {item.diagnosis}
                </p>
                {item.errorMessage ? (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-300">
                    오류: {item.errorMessage}
                  </p>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              최근 관리자 알림 발송 이력이 없습니다.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            회원별 세션 조회 / 강제 로그아웃
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {support.sessions.length}개
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {support.sessions.length > 0 ? (
            support.sessions.map((session) => (
              <div
                key={session.sessionId}
                className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {session.clientName || "알 수 없는 기기"} · {session.clientPlatform || "-"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      세션 ID: {session.sessionId}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      마지막 활동: {new Date(session.lastSeenAt).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      생성: {new Date(session.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onForceLogout(session.sessionId)}
                    disabled={revokingSessionId === session.sessionId}
                    className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-900/10"
                  >
                    강제 로그아웃
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">활성 세션이 없습니다.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            회원별 push token 상태 조회
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {support.pushTokens.length}개
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {support.pushTokens.length > 0 ? (
            support.pushTokens.map((token) => (
              <div
                key={`${token.tokenPreview}-${token.lastSeenAt ?? "none"}`}
                className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {token.platform.toUpperCase()} · {token.deviceId || "기기 정보 없음"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {token.tokenPreview}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      최근 확인:{" "}
                      {token.lastSeenAt ? new Date(token.lastSeenAt).toLocaleString() : "-"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      token.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {token.isActive ? "활성" : "비활성"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              등록된 push token이 없습니다.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          회원별 플랜 / 저장소 사용량 조회
        </h3>
        <div className="mt-4 space-y-4">
          {support.usage.length > 0 ? (
            support.usage.map((item) => (
              <div
                key={item.workspaceId}
                className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {item.workspaceName}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {item.workspaceType === "team" ? "팀 워크스페이스" : "개인 워크스페이스"} · 플랜 {item.planName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {item.storageUsedFormatted} / {item.storageLimitFormatted}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      파일 {item.fileCount}개 · 최대 파일 {item.maxFileSizeMb}MB
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-gray-100 dark:bg-gray-700">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{ width: `${Math.min(100, item.storagePercent)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  저장소 사용률 {item.storagePercent}% · 최대 멤버 {item.maxMembers}
                  {item.memberCount !== null ? ` · 현재 멤버 ${item.memberCount}` : ""}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              연결된 워크스페이스가 없습니다.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            회원별 최근 알림 내역 조회
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {support.notifications.length}건
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {support.notifications.length > 0 ? (
            support.notifications.map((notification) => (
              <div
                key={notification.notificationId}
                className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {notification.title || notification.type}
                    </p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {notification.message || "-"}
                    </p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {notification.sourceType || notification.type} ·{" "}
                      {notification.createdAt
                        ? new Date(notification.createdAt).toLocaleString()
                        : "-"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      notification.isRead
                        ? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                    }`}
                  >
                    {notification.isRead ? "읽음" : "읽지 않음"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              최근 알림 내역이 없습니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
