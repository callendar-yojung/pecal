"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Plan {
  id: number;
  name: string;
  price: number;
  max_members: number;
  max_storage_mb: number;
}

interface Subscription {
  id: number;
  owner_id: number;
  owner_type: "team" | "personal";
  plan_id: number;
  status: string;
  started_at: string;
  next_payment_date?: string | null;
  plan_name?: string;
  plan_price?: number;
}

interface SavedCard {
  id: number;
  cardCode: string;
  cardName: string;
  cardNoMasked: string;
  createdAt: string;
}

interface PaymentRecord {
  payment_id: number;
  amount: number;
  status: "SUCCESS" | "FAILED" | "REFUNDED";
  payment_type: "FIRST" | "RECURRING" | "RETRY";
  plan_name?: string;
  tid: string | null;
  created_at: string;
}

interface Team {
  id: number;
  name: string;
}

export default function BillingPage() {
  const t = useTranslations("dashboard.settings.billing");
  const router = useRouter();
  const [personalSubscription, setPersonalSubscription] =
    useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState<number | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [teamsLoading, setTeamsLoading] = useState(false);

  // 구독 취소 관련 state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // NicePay 결제 성공 배너
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [showPlanChangeScheduled, setShowPlanChangeScheduled] = useState(false);

  // 저장된 카드 정보
  const [savedCard, setSavedCard] = useState<SavedCard | null>(null);
  const [removingCard, setRemovingCard] = useState(false);
  const [showRemoveCardConfirm, setShowRemoveCardConfirm] = useState(false);

  // 결제 이력
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  useEffect(() => {
    fetchCurrentSubscription();
    fetchBillingKey();
    fetchTeams();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("nicepay") === "success") {
      setShowPaymentSuccess(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("plan_change") === "scheduled") {
      setShowPlanChangeScheduled(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const fetchCurrentSubscription = async () => {
    try {
      // 현재 사용자 정보 가져오기
      const meRes = await fetch("/api/me/account");
      const meData = await meRes.json();
      const currentMemberId = meData.member_id;
      setMemberId(currentMemberId);

      // 개인 활성 구독 조회
      const personalSubRes = await fetch(
        `/api/subscriptions?owner_id=${currentMemberId}&owner_type=personal&active=true`
      );
      const personalSubData = await personalSubRes.json();

      if (personalSubData && personalSubData.plan_id) {
        setPersonalSubscription(personalSubData);
        // 결제 이력 로드
        fetchPaymentHistory(currentMemberId);
      } else {
        // 구독이 없으면 Basic 플랜 정보 가져오기
        const plansRes = await fetch("/api/plans");
        const plansData = await plansRes.json();
        const basicPlan = plansData.find((p: Plan) => p.name === "Basic");

        if (basicPlan) {
          setPersonalSubscription({
            id: 0,
            owner_id: currentMemberId,
            owner_type: "personal",
            plan_id: basicPlan.id,
            status: "ACTIVE",
            started_at: new Date().toISOString(),
            plan_name: basicPlan.name,
            plan_price: basicPlan.price,
          });
        }
        // 무료 플랜이라도 이력이 있을 수 있으므로 로드
        fetchPaymentHistory(currentMemberId);
      }
    } catch (error) {
      console.error("Failed to fetch subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    setTeamsLoading(true);
    try {
      const res = await fetch("/api/me/teams");
      const data = await res.json();
      const list: Team[] = data?.teams || [];
      setTeams(list);
      if (list.length > 0) {
        setSelectedTeamId((prev) => (prev ? prev : list[0].id));
      }
    } catch (error) {
      console.error("Failed to fetch teams:", error);
    } finally {
      setTeamsLoading(false);
    }
  };

  const fetchBillingKey = async () => {
    try {
      const res = await fetch("/api/nicepay/billing/register");
      const data = await res.json();
      if (data.billingKey) {
        setSavedCard(data.billingKey);
      }
    } catch (error) {
      console.error("Failed to fetch billing key:", error);
    }
  };

  const fetchPaymentHistory = async (ownerId: number) => {
    setPaymentsLoading(true);
    try {
      const res = await fetch(
        `/api/payments?owner_id=${ownerId}&owner_type=personal`
      );
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
      }
    } catch (error) {
      console.error("Failed to fetch payment history:", error);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const handleRemoveCard = async () => {
    if (!canRemoveCard) {
      setCancelMessage({
        type: "error",
        text: t("removeCardBlocked"),
      });
      return;
    }
    setRemovingCard(true);
    try {
      const res = await fetch("/api/nicepay/billing/remove", {
        method: "DELETE",
      });
      if (res.ok) {
        setSavedCard(null);
        setShowRemoveCardConfirm(false);
        setCancelMessage({ type: "success", text: t("removeCardSuccess") });
      } else {
        setCancelMessage({ type: "error", text: t("removeCardError") });
      }
    } catch {
      setCancelMessage({ type: "error", text: t("removeCardError") });
    } finally {
      setRemovingCard(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!personalSubscription || personalSubscription.id === 0) return;

    setCanceling(true);
    setCancelMessage(null);

    try {
      const res = await fetch("/api/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: personalSubscription.id,
          status: "CANCELED",
        }),
      });

      if (res.ok) {
        setCancelMessage({ type: "success", text: t("cancel.success") });
        setShowCancelConfirm(false);

        // Basic 플랜으로 리셋
        const plansRes = await fetch("/api/plans");
        const plansData = await plansRes.json();
        const basicPlan = plansData.find((p: Plan) => p.name === "Basic");

        if (basicPlan) {
          setPersonalSubscription({
            id: 0,
            owner_id: personalSubscription.owner_id,
            owner_type: "personal",
            plan_id: basicPlan.id,
            status: "ACTIVE",
            started_at: new Date().toISOString(),
            plan_name: basicPlan.name,
            plan_price: basicPlan.price,
          });
        }
      } else {
        setCancelMessage({ type: "error", text: t("cancel.error") });
      }
    } catch {
      setCancelMessage({ type: "error", text: t("cancel.error") });
    } finally {
      setCanceling(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const formatAmount = (amount: number) => {
    return `\u20A9${amount.toLocaleString()}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
            {t("paymentHistory.success")}
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
            {t("paymentHistory.failed")}
          </span>
        );
      case "REFUNDED":
        return (
          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            {t("paymentHistory.refunded")}
          </span>
        );
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "FIRST":
        return (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {t("paymentHistory.first")}
          </span>
        );
      case "RECURRING":
        return (
          <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200">
            {t("paymentHistory.recurring")}
          </span>
        );
      case "RETRY":
        return (
          <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-200">
            {t("paymentHistory.retry")}
          </span>
        );
      default:
        return null;
    }
  };

  const isPaidSubscription =
    personalSubscription && personalSubscription.id > 0;
  const canRemoveCard =
    !isPaidSubscription || personalSubscription?.plan_price === 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* NicePay 결제 성공 배너 */}
      {showPaymentSuccess && (
        <div className="flex items-center justify-between rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <p className="font-medium text-green-800 dark:text-green-200">
              {t("paymentSuccess")}
            </p>
          </div>
          <button
            onClick={() => setShowPaymentSuccess(false)}
            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* 플랜 변경 예약 배너 */}
      {showPlanChangeScheduled && (
        <div className="flex items-center justify-between rounded-lg border border-blue-300 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="font-medium text-blue-800 dark:text-blue-200">
              {t("planChangeScheduled")}
            </p>
          </div>
          <button
            onClick={() => setShowPlanChangeScheduled(false)}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* 구독 취소 메시지 */}
      {cancelMessage && (
        <div
          className={`flex items-center justify-between rounded-lg border p-4 ${
            cancelMessage.type === "success"
              ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950"
              : "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
          }`}
        >
          <p
            className={`text-sm font-medium ${
              cancelMessage.type === "success"
                ? "text-green-800 dark:text-green-200"
                : "text-red-800 dark:text-red-200"
            }`}
          >
            {cancelMessage.text}
          </p>
          <button
            onClick={() => setCancelMessage(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* 개인 구독 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-2 flex items-center gap-2">
          <div className="rounded-full bg-blue-100 p-1.5 dark:bg-blue-900">
            <svg
              className="h-4 w-4 text-blue-600 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-card-foreground">
            {t("personalSubscription")}
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("personalSubscriptionDesc")}
        </p>

        <div className="mt-6 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <div>
            <p className="font-semibold text-blue-900 dark:text-blue-100">
              {personalSubscription?.plan_name || "Basic"}
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {"\u20A9"}
              {personalSubscription?.plan_price?.toLocaleString() || 0} / month
            </p>
            {isPaidSubscription && (
              <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                {t("status")}: {personalSubscription.status}
              </p>
            )}
            {isPaidSubscription && personalSubscription.next_payment_date && (
              <p className="mt-0.5 text-xs text-blue-600 dark:text-blue-400">
                {t("nextPaymentDate")}:{" "}
                {formatDate(personalSubscription.next_payment_date)}
              </p>
            )}
            {!isPaidSubscription && (
              <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                {t("freePlan")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isPaidSubscription && (
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
              >
                {t("cancel.button")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (!memberId) return;
                router.push(
                  `/dashboard/settings/billing/plans/personal?owner_id=${memberId}`
                );
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              {isPaidSubscription ? t("changePlan") : t("upgrade")}
            </button>
          </div>
        </div>

        {/* 구독 취소 확인 다이얼로그 */}
        {showCancelConfirm && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
            <h3 className="font-semibold text-red-900 dark:text-red-100">
              {t("cancel.title")}
            </h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">
              {t("cancel.message")}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleCancelSubscription}
                disabled={canceling}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {canceling ? t("cancel.canceling") : t("cancel.confirm")}
              </button>
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                disabled={canceling}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-accent disabled:opacity-50"
              >
                {t("cancel.dismiss")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 팀 구독 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-2 flex items-center gap-2">
          <div className="rounded-full bg-purple-100 p-1.5 dark:bg-purple-900">
            <svg
              className="h-4 w-4 text-purple-600 dark:text-purple-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-card-foreground">
            {t("teamSubscription")}
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("teamSubscriptionDesc")}
        </p>

        {teamsLoading ? (
          <div className="mt-4 text-sm text-muted-foreground">
            {t("teamLoading")}
          </div>
        ) : teams.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t("teamNoTeams")}
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="text-sm text-muted-foreground">
              {t("teamSelectLabel")}
            </label>
            <select
              value={selectedTeamId ?? ""}
              onChange={(e) => setSelectedTeamId(Number(e.target.value))}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (!selectedTeamId) return;
                router.push(
                  `/dashboard/settings/billing/plans/team?owner_id=${selectedTeamId}`
                );
              }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {t("teamGo")}
            </button>
          </div>
        )}
      </div>

      {/* 결제 수단 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-card-foreground">
          {t("paymentMethod")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("paymentMethodDesc")}
        </p>

        {savedCard ? (
          <div className="mt-6">
            <div className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                  <svg
                    className="h-5 w-5 text-blue-600 dark:text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {savedCard.cardName || t("savedCard")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {savedCard.cardNoMasked}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRemoveCardConfirm(true)}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
              >
                {t("removeCard")}
              </button>
            </div>

            {/* 카드 삭제 확인 */}
            {showRemoveCardConfirm && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
                <p className="text-sm text-red-700 dark:text-red-300">
                  {t("removeCardConfirm")}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleRemoveCard}
                    disabled={removingCard}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    {removingCard ? t("cancel.canceling") : t("removeCard")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRemoveCardConfirm(false)}
                    disabled={removingCard}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    {t("cancel.dismiss")}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 rounded-lg border-2 border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {t("noPaymentMethod")}
            </p>
          </div>
        )}
      </div>

      {/* 결제 내역 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-card-foreground">
          {t("history")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("historyDesc")}
        </p>

        {paymentsLoading ? (
          <div className="mt-6 flex items-center justify-center rounded-lg border-2 border-dashed border-border p-8">
            <p className="text-sm text-muted-foreground">
              {t("historyLoading")}
            </p>
          </div>
        ) : payments.length === 0 ? (
          <div className="mt-6 rounded-lg border-2 border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">{t("noHistory")}</p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 pr-4 font-medium text-muted-foreground">
                    {t("paymentHistory.date")}
                  </th>
                  <th className="pb-3 pr-4 font-medium text-muted-foreground">
                    {t("paymentHistory.plan")}
                  </th>
                  <th className="pb-3 pr-4 font-medium text-muted-foreground">
                    {t("paymentHistory.amount")}
                  </th>
                  <th className="pb-3 pr-4 font-medium text-muted-foreground">
                    {t("paymentHistory.type")}
                  </th>
                  <th className="pb-3 pr-4 font-medium text-muted-foreground">
                    {t("paymentHistory.status")}
                  </th>
                  <th className="pb-3 font-medium text-muted-foreground">
                    {t("paymentHistory.tid")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr
                    key={payment.payment_id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-3 pr-4 text-foreground">
                      {formatDate(payment.created_at)}
                    </td>
                    <td className="py-3 pr-4 text-foreground">
                      {payment.plan_name || "-"}
                    </td>
                    <td className="py-3 pr-4 text-foreground">
                      {formatAmount(payment.amount)}
                    </td>
                    <td className="py-3 pr-4">
                      {getTypeBadge(payment.payment_type)}
                    </td>
                    <td className="py-3 pr-4">
                      {getStatusBadge(payment.status)}
                    </td>
                    <td className="py-3 font-mono text-xs text-muted-foreground">
                      {payment.tid || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
