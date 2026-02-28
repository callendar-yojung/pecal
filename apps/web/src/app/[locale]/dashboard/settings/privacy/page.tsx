"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

export default function PrivacyPage() {
  const t = useTranslations("dashboard.settings.privacy");
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [thirdParty, setThirdParty] = useState(false);

  return (
    <div className="space-y-6">
      {/* 데이터 공유 설정 */}
      <div className="dashboard-glass-card premium-noise p-6">
        <h2 className="text-lg font-semibold text-card-foreground">
          {t("dataSharing")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("dataSharingDesc")}
        </p>

        <div className="mt-6 space-y-4">
          {/* 분석 데이터 */}
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <div className="text-sm font-medium text-card-foreground">
                {t("analytics")}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("analyticsDesc")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAnalytics(!analytics)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                analytics ? "bg-accent" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                  analytics ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* 마케팅 */}
          <div className="flex items-center justify-between border-b border-border pb-4">
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
              onClick={() => setMarketing(!marketing)}
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

          {/* 서드파티 */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-card-foreground">
                {t("thirdParty")}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("thirdPartyDesc")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setThirdParty(!thirdParty)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                thirdParty ? "bg-accent" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                  thirdParty ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 데이터 내보내기 */}
      <div className="dashboard-glass-card premium-noise p-6">
        <h2 className="text-lg font-semibold text-card-foreground">
          {t("exportData")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("exportDataDesc")}
        </p>
        <button type="button" className="ui-button mt-4 px-4 py-2 text-sm">
          {t("exportButton")}
        </button>
      </div>
    </div>
  );
}
