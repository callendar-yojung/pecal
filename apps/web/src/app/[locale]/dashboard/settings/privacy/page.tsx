"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export default function PrivacyPage() {
  const t = useTranslations("dashboard.settings.privacy");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<"privacy" | "marketing" | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/me/account", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          privacy_consent?: boolean;
          marketing_consent?: boolean;
        };
        if (!active) return;
        setPrivacyConsent(Boolean(data.privacy_consent));
        setMarketing(Boolean(data.marketing_consent));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const updateConsent = async (
    key: "privacy_consent" | "marketing_consent",
    value: boolean,
  ) => {
    setSavingKey(key === "privacy_consent" ? "privacy" : "marketing");
    try {
      await fetch("/api/me/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="dashboard-glass-card premium-noise p-6">
        <h2 className="text-lg font-semibold text-card-foreground">
          {t("dataSharing")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("dataSharingDesc")}
        </p>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <div className="text-sm font-medium text-card-foreground">
                {t("privacyConsent")}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("privacyConsentDesc")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !privacyConsent;
                setPrivacyConsent(next);
                void updateConsent("privacy_consent", next);
              }}
              disabled={loading || savingKey === "privacy"}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                privacyConsent ? "bg-accent" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                  privacyConsent ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-card-foreground">
                {t("marketing")}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("marketingDesc")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !marketing;
                setMarketing(next);
                void updateConsent("marketing_consent", next);
              }}
              disabled={loading || savingKey === "marketing"}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                marketing ? "bg-accent" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                  marketing ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
