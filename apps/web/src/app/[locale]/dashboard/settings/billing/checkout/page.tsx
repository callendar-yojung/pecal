"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import PayPalButton from "@/components/dashboard/PayPalButton";

interface Plan {
  id: number;
  name: string;
  price: number;
  max_members: number;
  max_storage_mb: number;
  paypal_plan_id?: string | null;
  paypal_product_id?: string | null;
}

function CheckoutContent() {
  const t = useTranslations("dashboard.settings.billing");
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const planId = searchParams.get("plan_id");
  const ownerType = searchParams.get("owner_type") as "team" | "personal" | null;
  const ownerId = searchParams.get("owner_id");
  const nicepayStatus = searchParams.get("nicepay");
  const nicepayMessage = searchParams.get("message");

  const [plan, setPlan] = useState<Plan | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [isDowngrade, setIsDowngrade] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ownerName, setOwnerName] = useState<string>("");
  const [cardNo, setCardNo] = useState("");
  const [expYear, setExpYear] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [idNo, setIdNo] = useState("");
  const [cardPw, setCardPw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>("");
  const [hasSavedCard, setHasSavedCard] = useState(false);
  const [useSavedCard, setUseSavedCard] = useState(true);

  const isKorean = locale === "ko";

  useEffect(() => {
    if (planId && ownerType && ownerId) {
      fetchPlan(Number(planId));
      fetchOwnerInfo(ownerType, Number(ownerId));
      fetchCurrentPlan(ownerType, Number(ownerId));
      fetchSavedCard();
    }
  }, [planId, ownerType, ownerId]);

  const fetchPlan = async (id: number) => {
    try {
      const res = await fetch(`/api/plans?id=${id}`);
      const data = await res.json();
      setPlan(data);
    } catch (error) {
      console.error("Failed to fetch plan:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOwnerInfo = async (type: "team" | "personal", id: number) => {
    try {
      const meRes = await fetch("/api/me/account");
      const meData = await meRes.json();

      if (type === "personal") {
        setOwnerName(meData.nickname || t("checkout.personal"));
        return;
      }

      const teamsRes = await fetch("/api/me/teams");
      const teamsData = await teamsRes.json();
      const team = teamsData.teams?.find((t: any) => t.id === id);
      setOwnerName(team?.name || t("checkout.team"));
    } catch (error) {
      console.error("Failed to fetch owner info:", error);
    }
  };

  const fetchCurrentPlan = async (type: "team" | "personal", id: number) => {
    try {
      const res = await fetch(
        `/api/subscriptions?owner_id=${id}&owner_type=${type}&active=true`
      );
      const subData = await res.json();
      if (subData?.plan_id) {
        const planRes = await fetch(`/api/plans?id=${subData.plan_id}`);
        const planData = await planRes.json();
        setCurrentPlan(planData);
      }
    } catch (error) {
      console.error("Failed to fetch current plan:", error);
    }
  };

  const fetchSavedCard = async () => {
    try {
      const res = await fetch("/api/nicepay/billing/register");
      const data = await res.json();
      if (data?.billingKey) {
        setHasSavedCard(true);
      }
    } catch (error) {
      console.error("Failed to fetch saved card:", error);
    }
  };

  useEffect(() => {
    if (plan && currentPlan) {
      setIsDowngrade(plan.price <= currentPlan.price);
    }
  }, [plan, currentPlan]);

  const handlePayPalSuccess = () => {
    alert(t("checkout.nicepay.success"));
    router.push("/dashboard/settings/billing");
  };

  const handlePayPalError = (error: any) => {
    console.error("PayPal Error:", error);
    alert(t("checkout.nicepay.error"));
  };

  const handleNicePayKeyIn = async () => {
    setSubmitError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/nicepay/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan?.id,
          ownerId: Number(ownerId),
          ownerType,
          cardNo: useSavedCard ? "" : cardNo,
          expYear: useSavedCard ? "" : expYear,
          expMonth: useSavedCard ? "" : expMonth,
          idNo: useSavedCard ? "" : idNo,
          cardPw: useSavedCard ? "" : cardPw,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data.error || t("checkout.nicepay.error"));
        return;
      }

      if (data?.scheduled) {
        router.push(`/${locale}/dashboard/settings/billing?plan_change=scheduled`);
        return;
      }

      router.push(`/${locale}/dashboard/settings/billing?nicepay=success`);
    } catch (error) {
      console.error("NicePay Error:", error);
      setSubmitError(t("checkout.nicepay.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const formatCardNo = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
  };

  const formatTwoDigits = (value: string) =>
    value.replace(/\D/g, "").slice(0, 2);

  const formatIdNo = (value: string) => value.replace(/\D/g, "").slice(0, 10);

  if (loading || !plan || !ownerType || !ownerId) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        {/* 헤더 */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="mb-4 text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; {t("checkout.back")}
          </button>
          <h1 className="text-3xl font-bold text-foreground">
            {t("checkout.title")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t("checkout.description")}
          </p>
        </div>

        {/* NicePay 결제 실패 메시지 */}
        {nicepayStatus === "failed" && nicepayMessage && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">
              {nicepayMessage}
            </p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* 주문 요약 */}
          <div className="lg:col-span-1">
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-card-foreground">
                {t("checkout.orderSummary")}
              </h2>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("checkout.subscriptionTarget")}
                  </span>
                  <div className="flex items-center gap-2">
                    {ownerType === "personal" ? (
                      <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded-full">
                        {t("checkout.personal")}
                      </span>
                    ) : (
                      <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-2 py-1 rounded-full">
                        {t("checkout.team")}
                      </span>
                    )}
                    <span className="text-sm font-medium text-foreground">
                      {ownerName}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("checkout.plan")}
                  </span>
                  <span className="font-semibold text-foreground">
                    {plan.name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("checkout.maxMembers")}
                  </span>
                  <span className="text-sm text-foreground">
                    {plan.max_members}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("checkout.storage")}
                  </span>
                  <span className="text-sm text-foreground">
                    {(plan.max_storage_mb / 1000).toFixed(1)}GB
                  </span>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      {t("checkout.monthlyPayment")}
                    </span>
                    <span className="text-xl font-bold text-foreground">
                      {isKorean
                        ? `\u20A9${plan.price.toLocaleString()}`
                        : `$${plan.price.toLocaleString()}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 결제 수단 */}
          <div className="lg:col-span-2">
            <div className="space-y-6">
              <div className="rounded-lg border border-border bg-card p-6">
                {isKorean ? (
                  <>
                    {/* NicePay 카드 결제 */}
                    <div className="mb-6 flex items-center justify-center">
                      <h2 className="text-2xl font-semibold text-card-foreground">
                        {t("checkout.nicepay.title")}
                      </h2>
                    </div>

                    <p className="text-sm text-muted-foreground mb-6 text-center">
                      {t("checkout.nicepay.description")}
                    </p>

                    {isDowngrade && currentPlan && (
                      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                        다음 결제일부터 {plan.name} 플랜으로 변경됩니다.
                      </div>
                    )}

                    {hasSavedCard && !isDowngrade && (
                      <div className="mb-4 rounded-lg border border-border bg-background p-3 text-sm text-foreground">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={useSavedCard}
                            onChange={(e) => setUseSavedCard(e.target.checked)}
                          />
                          저장된 결제수단으로 결제하기
                        </label>
                      </div>
                    )}

                    {submitError && (
                      <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                        {submitError}
                      </div>
                    )}

                    {!isDowngrade && !useSavedCard && (
                      <div className="rounded-xl border border-border bg-background p-5">
                        <div className="mb-4">
                          <h3 className="text-base font-semibold text-foreground">
                            카드 정보
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            입력하신 정보는 암호화되어 처리됩니다.
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                              카드번호
                            </label>
                            <input
                              value={formatCardNo(cardNo)}
                              onChange={(e) => setCardNo(e.target.value)}
                              inputMode="numeric"
                              placeholder="0000 0000 0000 0000"
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-1">
                                유효기간(월)
                              </label>
                              <input
                                value={formatTwoDigits(expMonth)}
                                onChange={(e) => setExpMonth(e.target.value)}
                                inputMode="numeric"
                                placeholder="MM"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-1">
                                유효기간(년)
                              </label>
                              <input
                                value={formatTwoDigits(expYear)}
                                onChange={(e) => setExpYear(e.target.value)}
                                inputMode="numeric"
                                placeholder="YY"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                              생년월일(YYMMDD) 또는 사업자번호
                            </label>
                            <input
                              value={formatIdNo(idNo)}
                              onChange={(e) => setIdNo(e.target.value)}
                              inputMode="numeric"
                              placeholder="예: 900101 또는 1234567890"
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                              카드 비밀번호 앞 2자리
                            </label>
                            <input
                              value={formatTwoDigits(cardPw)}
                              onChange={(e) => setCardPw(e.target.value)}
                              inputMode="numeric"
                              placeholder="**"
                              type="password"
                              maxLength={2}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={handleNicePayKeyIn}
                        disabled={submitting}
                        className="w-full rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {submitting
                          ? t("checkout.nicepay.subscribing")
                          : t("checkout.nicepay.subscribeButton")}
                      </button>
                      <p className="mt-2 text-xs text-muted-foreground text-center">
                        매월 자동 결제되며 언제든지 구독을 취소할 수 있습니다.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    {/* PayPal */}
                    <div className="mb-6 flex items-center justify-center">
                      <h2 className="text-2xl font-semibold text-card-foreground">
                        {t("checkout.paypal.title")}
                      </h2>
                    </div>

                    <p className="text-sm text-muted-foreground mb-6 text-center">
                      {t("checkout.paypal.description")}
                    </p>

                    {!plan.paypal_plan_id && (
                      <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          {t("checkout.paypal.notConfigured")}
                        </p>
                      </div>
                    )}

                    <PayPalButton
                      planId={plan.id}
                      paypalPlanId={plan.paypal_plan_id}
                      ownerId={Number(ownerId)}
                      ownerType={ownerType}
                      onSuccess={handlePayPalSuccess}
                      onError={handlePayPalError}
                    />
                  </>
                )}
              </div>

              {/* 약관 동의 */}
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="terms"
                    required
                    className="mt-1 h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="terms"
                    className="ml-2 text-sm text-muted-foreground"
                  >
                    {t("checkout.termsAgree")}
                  </label>
                </div>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                {t("checkout.securePayment")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-12">Loading...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
