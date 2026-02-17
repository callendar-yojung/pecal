"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Plan {
  id: number;
  name: string;
  price: number;
  max_members: number;
  max_storage_mb: number;
  plan_type: "personal" | "team";
  created_at: string;
}

interface Subscription {
  id: number;
  owner_id: number;
  owner_type: "team" | "personal";
  plan_id: number;
  status: string;
  plan_name?: string;
  plan_price?: number;
}

interface Team {
  id: number;
  name: string;
}

export default function PlansClient({ mode = "combined" }: { mode?: "personal" | "team" | "combined" }) {
  const t = useTranslations("dashboard.settings.billing.plans");
  const tPricing = useTranslations("pricing");
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectionOwnerType =
    mode === "combined"
      ? ((searchParams.get("owner_type") as "team" | "personal") || "personal")
      : mode;
  const selectionOwnerId = searchParams.get("owner_id");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  const [currentSubscription, setCurrentSubscription] =
    useState<Subscription | null>(null);
  const [currentMemberId, setCurrentMemberId] = useState<number | null>(null);
  const [currentOwnerId, setCurrentOwnerId] = useState<number | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const res = await fetch("/api/me/teams");
        const data = await res.json();
        const list: Team[] = data?.teams || [];
        setTeams(list);
        if (!selectedTeamId && list.length > 0) {
          setSelectedTeamId(list[0].id);
        }
      } catch {
        setTeams([]);
      }
    };
    if (mode !== "personal") {
      fetchTeams();
    }
  }, [selectedTeamId, mode]);

  useEffect(() => {
    if (selectionOwnerType !== "team" || selectionOwnerId) return;
    const pendingTeamId = sessionStorage.getItem("pending_team_id");
    if (pendingTeamId) {
      setCurrentOwnerId(Number(pendingTeamId));
    }
  }, [selectionOwnerType, selectionOwnerId]);

  const fetchData = async () => {
    try {
      const plansRes = await fetch("/api/plans");
      if (!plansRes.ok) {
        console.error("Failed to fetch plans:", plansRes.status);
        return;
      }
      const plansData = await plansRes.json();

      if (!Array.isArray(plansData) || plansData.length === 0) {
        return;
      }

      setPlans(plansData);

      let ownerId: number | null = null;

      if (selectionOwnerType === "personal") {
        const meRes = await fetch("/api/me/account");
        const meData = await meRes.json();
        ownerId = meData.member_id;
        setCurrentMemberId(ownerId);
      } else if (selectionOwnerId) {
        ownerId = Number(selectionOwnerId);
      }

      if (ownerId) {
        setCurrentOwnerId(ownerId);
      }

      if (selectionOwnerType === "personal" && ownerId) {
        const currentSubRes = await fetch(
          `/api/subscriptions?owner_id=${ownerId}&owner_type=personal&active=true`
        );
        const currentSubData = await currentSubRes.json();

        if (currentSubData && currentSubData.plan_id) {
          setCurrentSubscription(currentSubData);
        } else {
          const basicPlan = plansData.find((p: Plan) => p.name === "Basic");
          if (basicPlan) {
            setCurrentSubscription({
              id: 0,
              owner_id: ownerId,
              owner_type: "personal",
              plan_id: basicPlan.id,
              status: "ACTIVE",
              plan_name: basicPlan.name,
              plan_price: basicPlan.price,
            });
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (plan: Plan) => {
    const ownerId =
      selectionOwnerType === "personal" ? currentMemberId : currentOwnerId;
    if (!ownerId) return;

    if (plan.price === 0) return;

    if (currentSubscription && currentSubscription.plan_id === plan.id) {
      return;
    }

    setSelectedPlanId(plan.id);

    router.push(
      `/dashboard/settings/billing/checkout?plan_id=${plan.id}&owner_type=${selectionOwnerType}&owner_id=${ownerId}`
    );
  };

  const isCurrentPlan = (planId: number) => {
    return currentSubscription?.plan_id === planId;
  };

  const isTeamPlan = (plan: Plan) => {
    if (plan.plan_type) return plan.plan_type === "team";
    const name = plan.name.toLowerCase();
    return name.includes("team") || name.includes("enterprise");
  };

  const visiblePlans = selectionOwnerType === "team"
    ? plans.filter(isTeamPlan)
    : plans.filter((plan) => !isTeamPlan(plan));

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <p className="text-muted-foreground">{t("loadError")}</p>
          <button
            onClick={fetchData}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 text-center">
          <button
            onClick={() => router.back()}
            className="mb-4 text-sm text-muted-foreground hover:text-foreground"
          >
            {t("back")}
          </button>
          <h1 className="text-3xl font-bold text-foreground">
            {tPricing("title")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {tPricing("description")}
          </p>
        </div>

        {selectionOwnerType !== "team" && (
        <div className="mb-12">
          <div className="mb-6 flex items-center gap-3">
            <h2 className="text-2xl font-bold">{t("personalTitle")}</h2>
            <span className="text-sm text-muted-foreground">
              {t("personalSubtitle")}
            </span>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visiblePlans.map((plan) => {
              const isCurrent = isCurrentPlan(plan.id);
              const isSelected = selectedPlanId === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl border p-6 shadow-sm transition-all hover:shadow-md ${
                    isCurrent ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold">{plan.name}</h3>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-3xl font-bold">
                        {plan.price === 0 ? "무료" : `₩${plan.price.toLocaleString()}`}
                      </span>
                      {plan.price > 0 && (
                        <span className="text-sm text-muted-foreground">/월</span>
                      )}
                    </div>
                  </div>

                  <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                    <li>멤버 {plan.max_members}명</li>
                    <li>스토리지 {plan.max_storage_mb}MB</li>
                  </ul>

                  <button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={isCurrent || plan.price === 0}
                    className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      isCurrent
                        ? "bg-primary text-white"
                        : plan.price === 0
                        ? "bg-muted text-muted-foreground"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {isCurrent
                      ? t("currentPlan")
                      : plan.price === 0
                      ? t("freePlan")
                      : isSelected
                      ? t("processing")
                      : t("select")}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {selectionOwnerType === "team" && (
        <div className="mb-12">
          <div className="mb-6 flex items-center gap-3">
            <h2 className="text-2xl font-bold">{t("teamSection")}</h2>
            <span className="text-sm text-muted-foreground">
              {t("teamDesc")}
            </span>
          </div>

          {teams.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              {t("teamNoTeams")}
            </div>
          ) : (
            <div className="mb-6 flex flex-wrap items-center gap-3">
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
                    `/dashboard/settings/billing/plans?owner_type=team&owner_id=${selectedTeamId}`
                  );
                }}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {t("teamGo")}
              </button>
            </div>
          )}

          {selectionOwnerType === "team" && selectedTeamId ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {visiblePlans.map((plan) => {
                const isCurrent = isCurrentPlan(plan.id);
                const isSelected = selectedPlanId === plan.id;

                return (
                  <div
                    key={plan.id}
                    className={`rounded-2xl border p-6 shadow-sm transition-all hover:shadow-md ${
                      isCurrent ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="mb-4">
                      <h3 className="text-xl font-semibold">{plan.name}</h3>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-bold">
                          {plan.price === 0 ? "무료" : `₩${plan.price.toLocaleString()}`}
                        </span>
                        {plan.price > 0 && (
                          <span className="text-sm text-muted-foreground">/월</span>
                        )}
                      </div>
                    </div>

                    <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                      <li>멤버 {plan.max_members}명</li>
                      <li>스토리지 {plan.max_storage_mb}MB</li>
                    </ul>

                    <button
                      onClick={() => handleSelectPlan(plan)}
                      disabled={isCurrent || plan.price === 0}
                      className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        isCurrent
                          ? "bg-primary text-white"
                          : plan.price === 0
                          ? "bg-muted text-muted-foreground"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {isCurrent
                        ? t("currentPlan")
                        : plan.price === 0
                        ? t("freePlan")
                        : isSelected
                        ? t("processing")
                        : t("select")}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              {t("teamGuide")}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
