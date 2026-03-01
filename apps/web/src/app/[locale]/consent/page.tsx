"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";

function parseSearchParams() {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }
  return new URLSearchParams(window.location.search);
}

function sanitizeCallback(raw: string | null, locale: string) {
  if (!raw || !raw.startsWith("/")) {
    return `/${locale}/dashboard`;
  }
  return raw;
}

export default function ConsentPage() {
  const locale = useLocale();
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [marketingChecked, setMarketingChecked] = useState(false);
  const [activeDoc, setActiveDoc] = useState<"terms" | "privacy">("terms");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => parseSearchParams(), []);
  const token = params.get("token") ?? "";
  const callback = sanitizeCallback(params.get("callback"), locale);
  const isKo = locale === "ko";

  const copy = isKo
    ? {
        title: "서비스 동의",
        subtitle:
          "아래 문서를 페이지 내에서 확인하고 동의해 주세요. 필수 항목 미동의 시 서비스 이용이 제한됩니다.",
        termsRequiredLabel: "필수 동의: 서비스 이용약관",
        termsRequiredDesc:
          "서비스 이용 조건, 회원 책임, 계정 관리, 서비스 변경/중단 정책을 확인했습니다.",
        privacyRequiredLabel: "필수 동의: 개인정보 처리방침",
        privacyRequiredDesc:
          "개인정보 수집/이용 목적, 보관 기간, 이용자 권리 및 보호 조치를 확인했습니다.",
        optionalLabel: "선택 동의: 마케팅 정보 수신",
        optionalDesc:
          "이벤트/혜택/업데이트 알림 수신에 동의합니다. (언제든 철회 가능)",
        optionalBadge: "추천",
        optionalHint: "동의하면 신규 기능/혜택 소식을 더 빠르게 받을 수 있어요.",
        agreeRequiredAll: "모두 동의",
        viewTerms: "약관 전체 새 탭으로 보기",
        viewPrivacy: "개인정보처리방침 전체 새 탭으로 보기",
        submit: "확인",
        saving: "저장 중...",
        requiredError: "필수 동의 항목(이용약관, 개인정보 처리방침)을 모두 체크해 주세요.",
        termsTitle: "서비스 이용약관 핵심 요약",
        privacyTitle: "개인정보 처리방침 핵심 요약",
      }
    : {
        title: "Consent",
        subtitle:
          "Review both documents below and complete consent here. Service access is blocked without required consent.",
        termsRequiredLabel: "Required: Terms of Service",
        termsRequiredDesc:
          "I have reviewed service use conditions, user responsibilities, account policies, and service change/interruption policy.",
        privacyRequiredLabel: "Required: Privacy Policy",
        privacyRequiredDesc:
          "I have reviewed data collection/use purpose, retention period, user rights, and data protection measures.",
        optionalLabel: "Optional: Marketing consent",
        optionalDesc:
          "I agree to receive event/promotion/update notifications. (Can be withdrawn anytime)",
        optionalBadge: "Recommended",
        optionalHint: "Get product updates, new features, and promotions faster.",
        agreeRequiredAll: "Agree to all",
        viewTerms: "Open full Terms in new tab",
        viewPrivacy: "Open full Privacy Policy in new tab",
        submit: "Confirm",
        saving: "Saving...",
        requiredError:
          "Please check all required items (Terms of Service, Privacy Policy).",
        termsTitle: "Terms of Service Summary",
        privacyTitle: "Privacy Policy Summary",
      };

  const requiredChecked = termsChecked && privacyChecked;

  const submitConsent = async () => {
    if (!requiredChecked) {
      setError(copy.requiredError);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch("/api/me/account", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          privacy_consent: true,
          marketing_consent: marketingChecked,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        throw new Error(data.error || data.message || "Failed to save consent");
      }

      if (token) {
        const sessionRes = await fetch("/api/me/consent/session", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!sessionRes.ok) {
          console.error("Failed to create consent session", await sessionRes.text());
        }
      }

      window.location.href = callback;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save consent");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h1 className="text-2xl font-bold">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{copy.subtitle}</p>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <section className="space-y-3">
            <label className="flex items-start gap-3 rounded-xl border border-border p-4">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={termsChecked}
                onChange={(e) => setTermsChecked(e.target.checked)}
              />
              <div>
                <p className="text-sm font-semibold">{copy.termsRequiredLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {copy.termsRequiredDesc}
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-border p-4">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={privacyChecked}
                onChange={(e) => setPrivacyChecked(e.target.checked)}
              />
              <div>
                <p className="text-sm font-semibold">
                  {copy.privacyRequiredLabel}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {copy.privacyRequiredDesc}
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-border bg-amber-50/60 p-4 dark:bg-amber-500/10">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={marketingChecked}
                onChange={(e) => setMarketingChecked(e.target.checked)}
              />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{copy.optionalLabel}</p>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-400/20 dark:text-amber-300">
                    {copy.optionalBadge}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {copy.optionalDesc}
                </p>
                <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                  {copy.optionalHint}
                </p>
              </div>
            </label>

            <button
              type="button"
              onClick={() => {
                setTermsChecked(true);
                setPrivacyChecked(true);
                setMarketingChecked(true);
              }}
              className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-4 text-sm font-semibold text-primary hover:bg-primary/15"
            >
              {copy.agreeRequiredAll}
            </button>
          </section>

          <section className="rounded-xl border border-border p-4">
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActiveDoc("terms")}
                className={`inline-flex h-9 items-center justify-center rounded-lg border text-sm font-semibold ${
                  activeDoc === "terms"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted/60"
                }`}
              >
                {copy.termsTitle}
              </button>
              <button
                type="button"
                onClick={() => setActiveDoc("privacy")}
                className={`inline-flex h-9 items-center justify-center rounded-lg border text-sm font-semibold ${
                  activeDoc === "privacy"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted/60"
                }`}
              >
                {copy.privacyTitle}
              </button>
            </div>

            <div className="h-[300px] overflow-auto rounded-lg border border-border bg-muted/20 p-4 text-sm leading-6">
              {activeDoc === "terms" ? (
                <div className="space-y-3">
                  <p className="font-semibold">{copy.termsTitle}</p>
                  <p>
                    {isKo
                      ? "1) 목적: 회사와 회원의 권리·의무 및 책임을 규정합니다."
                      : "1) Purpose: Defines rights, obligations, and responsibilities between company and user."}
                  </p>
                  <p>
                    {isKo
                      ? "2) 회원가입/계정: 계정 정보 관리 책임은 회원에게 있으며, 계정 공유는 금지됩니다."
                      : "2) Account: Users are responsible for account security and account sharing is prohibited."}
                  </p>
                  <p>
                    {isKo
                      ? "3) 서비스 제공/변경: 점검, 장애, 불가항력 사유로 서비스가 일시 중단될 수 있습니다."
                      : "3) Service availability: Service may be interrupted due to maintenance, technical issues, or force majeure."}
                  </p>
                  <p>
                    {isKo
                      ? "4) 콘텐츠 권리: 업로드 콘텐츠 저작권은 회원에게 있으며, 운영 목적 범위 내에서만 이용합니다."
                      : "4) Content rights: Users retain ownership of uploaded content; service uses content only for operation purposes."}
                  </p>
                  <p>
                    {isKo
                      ? "5) 탈퇴/해지: 회원은 탈퇴할 수 있으며, 법령상 보관 의무를 제외하고 데이터는 삭제됩니다."
                      : "5) Termination: Users may withdraw; data is deleted except where legal retention is required."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="font-semibold">{copy.privacyTitle}</p>
                  <p>
                    {isKo
                      ? "1) 수집 항목: 이메일, 닉네임, OAuth 식별자, 디바이스 정보, 푸시 토큰."
                      : "1) Collected data: Email, nickname, OAuth identifier, device info, and push token."}
                  </p>
                  <p>
                    {isKo
                      ? "2) 이용 목적: 회원 인증, 서비스 제공, 일정/파일 저장, 알림 발송, 마케팅(선택 동의 시)."
                      : "2) Purpose: Authentication, service delivery, task/file storage, notifications, and marketing (if opted in)."}
                  </p>
                  <p>
                    {isKo
                      ? "3) 보관 기간: 탈퇴 시 삭제를 원칙으로 하되 법령에 따른 보관은 예외로 합니다."
                      : "3) Retention: Deleted upon account withdrawal except when legal retention is required."}
                  </p>
                  <p>
                    {isKo
                      ? "4) 제3자 제공: 원칙적으로 제공하지 않으며 법령 요청이 있는 경우에만 제공합니다."
                      : "4) Third-party sharing: Not shared by default; only when legally required."}
                  </p>
                  <p>
                    {isKo
                      ? "5) 이용자 권리: 열람/정정/삭제 및 마케팅 수신 동의 철회가 가능합니다."
                      : "5) User rights: Access, correction, deletion, and withdrawal of marketing consent are available."}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Link
                href={`/${locale}/terms`}
                target="_blank"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted/60"
              >
                {copy.viewTerms}
              </Link>
              <Link
                href={`/${locale}/privacy`}
                target="_blank"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted/60"
              >
                {copy.viewPrivacy}
              </Link>
            </div>
          </section>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void submitConsent()}
          disabled={saving || !requiredChecked}
          className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving ? copy.saving : copy.submit}
        </button>
      </div>
    </main>
  );
}
