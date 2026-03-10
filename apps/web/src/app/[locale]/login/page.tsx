"use client";

import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type AvailabilityState = {
  value: string;
  available: boolean;
  message: string;
};

type Mode = "login" | "register" | "findId" | "resetPassword";
type AuthPanel = "entry" | "local" | "social";

const EMAIL_VERIFICATION_TTL_SECONDS = 3 * 60;

function isValidRegisterPassword(password: string) {
  return password.length >= 8 && /[^A-Za-z0-9]/.test(password);
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${minutes}:${String(remain).padStart(2, "0")}`;
}

export default function LoginPage() {
  const t = useTranslations("login");
  const params = useParams<{ locale: string }>();
  const router = useRouter();
  const locale = params?.locale || "en";
  const successCallbackUrl = `/${locale}/login/success`;
  const [enabledProviders, setEnabledProviders] = useState<Set<string> | null>(null);
  const [authPanel, setAuthPanel] = useState<AuthPanel>("entry");
  const [mode, setMode] = useState<Mode>("login");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [checkingLoginId, setCheckingLoginId] = useState(false);
  const [checkingNickname, setCheckingNickname] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [sendingResetCode, setSendingResetCode] = useState(false);
  const [loginIdCheck, setLoginIdCheck] = useState<AvailabilityState | null>(null);
  const [nicknameCheck, setNicknameCheck] = useState<AvailabilityState | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerifiedTarget, setEmailVerifiedTarget] = useState("");
  const [verificationExpiresAt, setVerificationExpiresAt] = useState<number | null>(null);
  const [verificationRemainingSeconds, setVerificationRemainingSeconds] = useState(0);

  useEffect(() => {
    let mounted = true;
    getProviders()
      .then((providers) => {
        if (!mounted) return;
        setEnabledProviders(new Set(Object.keys(providers ?? {})));
      })
      .catch(() => {
        if (!mounted) return;
        setEnabledProviders(new Set());
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!verificationExpiresAt) {
      setVerificationRemainingSeconds(0);
      return;
    }

    const updateRemaining = () => {
      const remain = Math.max(0, Math.ceil((verificationExpiresAt - Date.now()) / 1000));
      setVerificationRemainingSeconds(remain);
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [verificationExpiresAt]);

  const hasProvider = (id: string) => enabledProviders ? enabledProviders.has(id) : false;
  const registerMode = mode === "register";
  const resetMode = mode === "resetPassword";
  const passwordValid = (!registerMode && !resetMode) || isValidRegisterPassword(password);
  const passwordConfirmed = (!registerMode && !resetMode) || password === passwordConfirm;
  const submitDisabled =
    (mode === "login" && (!loginId.trim() || !password.trim())) ||
    (mode === "register" &&
      (!loginId.trim() ||
        !password.trim() ||
        !email.trim() ||
        !nickname.trim() ||
        !passwordConfirm.trim() ||
        !passwordValid ||
        !passwordConfirmed ||
        !emailVerified ||
        emailVerifiedTarget !== email.trim().toLowerCase() ||
        loginIdCheck?.available !== true ||
        loginIdCheck.value !== loginId.trim().toLowerCase() ||
        nicknameCheck?.available !== true ||
        nicknameCheck.value !== nickname.trim())) ||
    (mode === "findId" && !email.trim()) ||
    (mode === "resetPassword" &&
      (!loginId.trim() ||
        !email.trim() ||
        !verificationCode.trim() ||
        !password.trim() ||
        !passwordConfirm.trim() ||
        !passwordValid ||
        !passwordConfirmed));

  const checkAvailability = async (field: "loginId" | "nickname") => {
    const query =
      field === "loginId"
        ? `login_id=${encodeURIComponent(loginId.trim())}`
        : `nickname=${encodeURIComponent(nickname.trim())}`;
    if (field === "loginId") setCheckingLoginId(true);
    else setCheckingNickname(true);
    setLocalError(null);

    try {
      const response = await fetch(`/api/auth/local/availability?${query}`);
      const data = await response.json();
      if (!response.ok) {
        setLocalError(data.error || t("availabilityCheckFailed"));
        return;
      }
      if (field === "loginId" && data.loginId) {
        setLoginIdCheck({
          value: loginId.trim().toLowerCase(),
          available: Boolean(data.loginId.available),
          message: String(data.loginId.message ?? ""),
        });
      }
      if (field === "nickname" && data.nickname) {
        setNicknameCheck({
          value: nickname.trim(),
          available: Boolean(data.nickname.available),
          message: String(data.nickname.message ?? ""),
        });
      }
    } catch (error) {
      console.error("Availability check failed:", error);
      setLocalError(t("availabilityCheckFailed"));
    } finally {
      if (field === "loginId") setCheckingLoginId(false);
      else setCheckingNickname(false);
    }
  };

  const sendVerificationCode = async () => {
    setSendingCode(true);
    setLocalError(null);
    setLocalStatus(null);
    try {
      const response = await fetch("/api/auth/local/email/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        setLocalError(data.error || t("verificationFailed"));
        return;
      }
      setEmailVerified(false);
      setEmailVerifiedTarget("");
      setVerificationCode("");
      setVerificationExpiresAt(Date.now() + EMAIL_VERIFICATION_TTL_SECONDS * 1000);
      setLocalStatus(t("verificationCodeSent"));
    } catch (error) {
      console.error("Send verification code failed:", error);
      setLocalError(t("verificationFailed"));
    } finally {
      setSendingCode(false);
    }
  };

  const verifyEmailCode = async () => {
    setVerifyingCode(true);
    setLocalError(null);
    setLocalStatus(null);
    try {
      if (verificationRemainingSeconds <= 0) {
        setLocalError(t("verificationExpired"));
        return;
      }
      const normalizedEmail = email.trim().toLowerCase();
      const response = await fetch("/api/auth/local/email/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, code: verificationCode }),
      });
      const data = await response.json();
      if (!response.ok) {
        setEmailVerified(false);
        setEmailVerifiedTarget("");
        setLocalError(data.error || t("verificationFailed"));
        return;
      }
      setEmailVerified(true);
      setEmailVerifiedTarget(normalizedEmail);
      setLocalStatus(t("verificationVerified"));
    } catch (error) {
      console.error("Verify email code failed:", error);
      setEmailVerified(false);
      setEmailVerifiedTarget("");
      setLocalError(t("verificationFailed"));
    } finally {
      setVerifyingCode(false);
    }
  };

  const sendResetCode = async () => {
    setSendingResetCode(true);
    setLocalError(null);
    setLocalStatus(null);
    try {
      const response = await fetch("/api/auth/local/recovery/send-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login_id: loginId, email }),
      });
      const data = await response.json();
      if (!response.ok) {
        setLocalError(data.error || t("resetCodeFailed"));
        return;
      }
      setVerificationExpiresAt(Date.now() + EMAIL_VERIFICATION_TTL_SECONDS * 1000);
      setLocalStatus(data.message || t("resetCodeSent"));
    } catch (error) {
      console.error("Send reset code failed:", error);
      setLocalError(t("resetCodeFailed"));
    } finally {
      setSendingResetCode(false);
    }
  };

  const handleLocalLogin = async () => {
    setLocalLoading(true);
    setLocalError(null);
    setLocalStatus(null);
    const result = await signIn("credentials", {
      loginId,
      password,
      redirect: false,
      callbackUrl: `/${locale}/dashboard`,
    });
    setLocalLoading(false);

    if (!result || result.error) {
      setLocalError(t("localInvalidCredentials"));
      return;
    }

    router.replace(`/${locale}/dashboard`);
    router.refresh();
  };

  const handleLocalRegister = async () => {
    setLocalLoading(true);
    setLocalError(null);
    try {
      if (!passwordValid) {
        setLocalError(t("passwordRule"));
        setLocalLoading(false);
        return;
      }
      if (!passwordConfirmed) {
        setLocalError(t("passwordMismatch"));
        setLocalLoading(false);
        return;
      }
      if (!emailVerified || emailVerifiedTarget !== email.trim().toLowerCase()) {
        setLocalError(t("verificationRequired"));
        setLocalLoading(false);
        return;
      }
      const response = await fetch("/api/auth/external/local/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login_id: loginId,
          password,
          nickname,
          email,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setLocalError(data.error || t("localRegisterFailed"));
        setLocalLoading(false);
        return;
      }
      await handleLocalLogin();
    } catch (error) {
      console.error("Local register failed:", error);
      setLocalError(t("localRegisterFailed"));
      setLocalLoading(false);
    }
  };

  const handleFindId = async () => {
    setLocalLoading(true);
    setLocalError(null);
    setLocalStatus(null);
    try {
      const response = await fetch("/api/auth/local/recovery/find-login-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        setLocalError(data.error || t("findIdFailed"));
        return;
      }
      setLocalStatus(data.message || t("findIdSent"));
    } catch (error) {
      console.error("Find login ID failed:", error);
      setLocalError(t("findIdFailed"));
    } finally {
      setLocalLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setLocalLoading(true);
    setLocalError(null);
    setLocalStatus(null);
    try {
      if (!passwordValid) {
        setLocalError(t("passwordRule"));
        return;
      }
      if (!passwordConfirmed) {
        setLocalError(t("passwordMismatch"));
        return;
      }
      if (verificationRemainingSeconds <= 0) {
        setLocalError(t("verificationExpired"));
        return;
      }
      const response = await fetch("/api/auth/local/recovery/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login_id: loginId,
          email,
          code: verificationCode,
          password,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setLocalError(data.error || t("resetPasswordFailed"));
        return;
      }
      setLocalStatus(t("resetPasswordSuccess"));
      setMode("login");
      setPassword("");
      setPasswordConfirm("");
      setVerificationCode("");
    } catch (error) {
      console.error("Reset password failed:", error);
      setLocalError(t("resetPasswordFailed"));
    } finally {
      setLocalLoading(false);
    }
  };

  const openLocalPanel = (nextMode: Mode = "login") => {
    setAuthPanel("local");
    setMode(nextMode);
    setLocalError(null);
    setLocalStatus(null);
  };

  const openSocialPanel = () => {
    setAuthPanel("social");
    setLocalError(null);
    setLocalStatus(null);
  };

  const goToPreviousPage = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(`/${locale}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-background p-8 shadow-lg">
        <div className="space-y-4">
          <button
            type="button"
            onClick={goToPreviousPage}
            className="inline-flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-border"
          >
            <span aria-hidden="true">←</span>
            {t("backToPrevious", { defaultValue: "이전 페이지로 돌아가기" })}
          </button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
            <p className="mt-2 text-muted-foreground">{t("description")}</p>
          </div>
        </div>

        <div className="space-y-4">
          {authPanel === "entry" ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => openLocalPanel("login")}
                className="flex w-full items-center justify-center rounded-xl bg-foreground px-4 py-4 text-base font-semibold text-background transition-colors hover:opacity-90"
              >
                {t("entryLocal")}
              </button>
              <button
                type="button"
                onClick={openSocialPanel}
                className="flex w-full items-center gap-3 rounded-xl bg-muted px-4 py-4 text-base font-semibold text-foreground transition-colors hover:bg-muted/80"
              >
                <span className="min-w-0 flex-1 truncate text-left">{t("entrySocial")}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FEE500] shadow-sm ring-1 ring-black/5">
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-[#191919]" aria-hidden="true">
                      <path d="M12 4C7.03 4 3 7.13 3 11c0 2.5 1.67 4.68 4.18 5.92L6.3 20.6a.6.6 0 0 0 .88.66l4.28-2.69c.18.01.36.03.54.03 4.97 0 9-3.13 9-7s-4.03-7-9-7Z" />
                    </svg>
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-border">
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden="true">
                      <path fill="#EA4335" d="M12 10.2v3.92h5.45c-.24 1.26-.97 2.33-2.05 3.05l3.32 2.57c1.94-1.79 3.05-4.43 3.05-7.57 0-.72-.07-1.42-.2-2.1H12Z" />
                      <path fill="#34A853" d="M12 21c2.76 0 5.08-.91 6.77-2.46l-3.32-2.57c-.92.62-2.1.98-3.45.98-2.65 0-4.89-1.79-5.69-4.19l-3.43 2.65A10.23 10.23 0 0 0 12 21Z" />
                      <path fill="#4A90E2" d="M6.31 12.76A6.13 6.13 0 0 1 6 10.8c0-.68.12-1.34.31-1.96L2.88 6.19A10.23 10.23 0 0 0 1.8 10.8c0 1.65.4 3.21 1.08 4.61l3.43-2.65Z" />
                      <path fill="#FBBC05" d="M12 4.66c1.5 0 2.85.52 3.92 1.53l2.94-2.94C17.07 1.64 14.76.6 12 .6 7.98.6 4.5 2.9 2.88 6.19l3.43 2.65c.8-2.4 3.04-4.18 5.69-4.18Z" />
                    </svg>
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black shadow-sm ring-1 ring-black/10">
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-white" aria-hidden="true">
                      <path d="M16.37 12.54c.02 2.21 1.94 2.95 1.96 2.96-.02.05-.31 1.08-1.03 2.15-.62.92-1.27 1.84-2.29 1.86-1 .02-1.32-.59-2.46-.59-1.14 0-1.5.57-2.44.61-1 .04-1.76-1-2.39-1.92-1.29-1.86-2.28-5.25-.95-7.58.66-1.16 1.84-1.9 3.12-1.92.98-.02 1.9.66 2.46.66.56 0 1.62-.81 2.73-.69.47.02 1.78.19 2.62 1.42-.07.04-1.56.91-1.53 3.04ZM14.73 5.55c.52-.63.88-1.5.78-2.37-.75.03-1.66.5-2.2 1.13-.49.57-.92 1.45-.81 2.3.84.06 1.71-.43 2.23-1.06Z" />
                    </svg>
                  </span>
                </span>
              </button>
            </div>
          ) : null}

          {authPanel === "local" ? (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
                {[
                  ["login", t("localLogin")],
                  ["register", t("localRegister")],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setMode(key as Mode);
                      setLocalError(null);
                      setLocalStatus(null);
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      mode === key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {mode !== "findId" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t("loginId")}</label>
                    <input
                      value={loginId}
                      onChange={(event) => {
                        setLoginId(event.target.value);
                        setLoginIdCheck(null);
                      }}
                      placeholder={t("loginIdPlaceholder")}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                    />
                    {mode === "register" ? (
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => checkAvailability("loginId")}
                          disabled={checkingLoginId || !loginId.trim()}
                          className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground disabled:opacity-50"
                        >
                          {checkingLoginId ? t("processing") : t("checkLoginId")}
                        </button>
                        {loginIdCheck ? (
                          <p className={`text-xs ${loginIdCheck.available ? "text-green-600" : "text-red-500"}`}>
                            {loginIdCheck.message}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {(mode === "login" || mode === "register" || mode === "resetPassword") ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t("password")}</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={t("passwordPlaceholder")}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                    />
                    {(mode === "register" || mode === "resetPassword") ? (
                      <p className="text-xs text-muted-foreground">{t("passwordRule")}</p>
                    ) : null}
                  </div>
                ) : null}

                {(mode === "register" || mode === "resetPassword") ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t("passwordConfirm")}</label>
                    <input
                      type="password"
                      value={passwordConfirm}
                      onChange={(event) => setPasswordConfirm(event.target.value)}
                      placeholder={t("passwordConfirmPlaceholder")}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                    />
                    {passwordConfirm.trim() && !passwordConfirmed ? (
                      <p className="text-xs text-red-500">{t("passwordMismatch")}</p>
                    ) : null}
                  </div>
                ) : null}

                {(mode === "register" || mode === "findId" || mode === "resetPassword") ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t("email")}</label>
                    <input
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setEmailVerified(false);
                        setEmailVerifiedTarget("");
                        setVerificationExpiresAt(null);
                      }}
                      placeholder={t("emailPlaceholder")}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                  </div>
                ) : null}

                {mode === "register" ? (
                  <button
                    type="button"
                    onClick={sendVerificationCode}
                    disabled={sendingCode || !email.trim()}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground disabled:opacity-50"
                  >
                    {sendingCode ? t("processing") : t("sendVerificationCode")}
                  </button>
                ) : null}

                {mode === "resetPassword" ? (
                  <button
                    type="button"
                    onClick={sendResetCode}
                    disabled={sendingResetCode || !email.trim() || !loginId.trim()}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground disabled:opacity-50"
                  >
                    {sendingResetCode ? t("processing") : t("sendResetCode")}
                  </button>
                ) : null}

                {verificationExpiresAt && (mode === "register" || mode === "resetPassword") ? (
                  <p className={`text-xs ${verificationRemainingSeconds > 0 ? "text-muted-foreground" : "text-red-500"}`}>
                    {verificationRemainingSeconds > 0
                      ? t("verificationExpiresIn", { time: formatCountdown(verificationRemainingSeconds) })
                      : t("verificationExpired")}
                  </p>
                ) : null}

                {(mode === "register" || mode === "resetPassword") ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t("verificationCode")}</label>
                    <input
                      value={verificationCode}
                      onChange={(event) => setVerificationCode(event.target.value)}
                      placeholder={t("verificationCodePlaceholder")}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                    />
                    {mode === "register" ? (
                      <button
                        type="button"
                        onClick={verifyEmailCode}
                        disabled={verifyingCode || !email.trim() || !verificationCode.trim()}
                        className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground disabled:opacity-50"
                      >
                        {verifyingCode ? t("processing") : t("verifyVerificationCode")}
                      </button>
                    ) : null}
                    {mode === "register" && emailVerified && emailVerifiedTarget === email.trim().toLowerCase() ? (
                      <p className="text-xs text-green-600">{t("verificationVerified")}</p>
                    ) : null}
                  </div>
                ) : null}

                {mode === "register" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t("nickname")}</label>
                    <input
                      value={nickname}
                      onChange={(event) => {
                        setNickname(event.target.value);
                        setNicknameCheck(null);
                      }}
                      placeholder={t("nicknamePlaceholder")}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => checkAvailability("nickname")}
                        disabled={checkingNickname || !nickname.trim()}
                        className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground disabled:opacity-50"
                      >
                        {checkingNickname ? t("processing") : t("checkNickname")}
                      </button>
                      {nicknameCheck ? (
                        <p className={`text-xs ${nicknameCheck.available ? "text-green-600" : "text-red-500"}`}>
                          {nicknameCheck.message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {localError ? <p className="text-sm text-red-500">{localError}</p> : null}
                {localStatus ? <p className="text-sm text-green-600">{localStatus}</p> : null}

                <button
                  type="button"
                  disabled={submitDisabled || localLoading}
                  onClick={
                    mode === "login"
                      ? handleLocalLogin
                      : mode === "register"
                        ? handleLocalRegister
                        : mode === "findId"
                          ? handleFindId
                          : handleResetPassword
                  }
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {localLoading
                    ? t("processing")
                    : mode === "login"
                      ? t("localLoginAction")
                      : mode === "register"
                        ? t("localRegisterAction")
                        : mode === "findId"
                          ? t("findIdAction")
                        : t("resetPasswordAction")}
                </button>

                {mode === "login" ? (
                  <div className="flex items-center justify-between pt-1 text-sm text-muted-foreground">
                    <button type="button" onClick={() => setMode("findId")} className="hover:text-foreground">
                      {t("findId")}
                    </button>
                    <button type="button" onClick={() => setMode("resetPassword")} className="hover:text-foreground">
                      {t("resetPassword")}
                    </button>
                  </div>
                ) : null}

                {mode === "register" ? (
                  <div className="flex items-center justify-between pt-1 text-sm text-muted-foreground">
                    <button type="button" onClick={() => setMode("findId")} className="hover:text-foreground">
                      {t("findId")}
                    </button>
                    <button type="button" onClick={() => setMode("resetPassword")} className="hover:text-foreground">
                      {t("resetPassword")}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {authPanel === "social" ? (
            <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
              <button
                type="button"
                onClick={() => setAuthPanel("entry")}
                className="inline-flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-border"
              >
                <span aria-hidden="true">←</span>
                {t("entryBack")}
              </button>
              <p className="text-sm text-muted-foreground">{t("socialDescription")}</p>

              {hasProvider("kakao") ? (
                <button
                  type="button"
                  onClick={() => signIn("kakao", { callbackUrl: successCallbackUrl })}
                  className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#FEE500] px-4 py-3 font-medium text-[#191919] transition-all duration-200 hover:bg-[#FDD800] hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
                >
                  {t("kakao")}
                </button>
              ) : null}

              {hasProvider("google") ? (
                <button
                  type="button"
                  onClick={() => signIn("google", { callbackUrl: successCallbackUrl })}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {t("google")}
                </button>
              ) : null}

              {hasProvider("apple") ? (
                <button
                  type="button"
                  onClick={() => signIn("apple", { callbackUrl: successCallbackUrl })}
                  className="flex w-full items-center justify-center gap-3 rounded-xl bg-foreground px-4 py-3 font-medium text-background transition-colors hover:opacity-90"
                >
                  {t("apple")}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
