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

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-background p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("description")}</p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            {[
              ["login", t("localLogin")],
              ["register", t("localRegister")],
              ["findId", t("findId")],
              ["resetPassword", t("resetPassword")],
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

          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
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
                  autoCapitalize="none"
                  autoCorrect="off"
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
          </div>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs text-muted-foreground">{t("or")}</span>
            </div>
          </div>

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
      </div>
    </div>
  );
}
