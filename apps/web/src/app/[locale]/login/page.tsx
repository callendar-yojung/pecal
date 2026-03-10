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
  const [enabledProviders, setEnabledProviders] = useState<Set<string> | null>(
    null,
  );
  const [mode, setMode] = useState<"login" | "register">("login");
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
        const keys = Object.keys(providers ?? {});
        setEnabledProviders(new Set(keys));
      })
      .catch(() => {
        if (!mounted) return;
        setEnabledProviders(new Set());
      });
    return () => {
      mounted = false;
    };
  }, []);

  const hasProvider = (id: string) =>
    enabledProviders ? enabledProviders.has(id) : false;

  useEffect(() => {
    if (!verificationExpiresAt) {
      setVerificationRemainingSeconds(0);
      return;
    }

    const updateRemaining = () => {
      const remain = Math.max(
        0,
        Math.ceil((verificationExpiresAt - Date.now()) / 1000),
      );
      setVerificationRemainingSeconds(remain);
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [verificationExpiresAt]);

  const passwordValid = mode !== "register" || isValidRegisterPassword(password);
  const passwordConfirmed = mode !== "register" || password === passwordConfirm;
  const registerReady =
    !!loginId.trim() &&
    !!password.trim() &&
    !!email.trim() &&
    !!nickname.trim() &&
    !!passwordConfirm.trim() &&
    passwordValid &&
    passwordConfirmed &&
    emailVerified &&
    emailVerifiedTarget === email.trim().toLowerCase() &&
    loginIdCheck?.available === true &&
    loginIdCheck.value === loginId.trim().toLowerCase() &&
    nicknameCheck?.available === true &&
    nicknameCheck.value === nickname.trim();

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-background p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("description")}</p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {t("localLogin")}
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                mode === "register"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {t("localRegister")}
            </button>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t("loginId")}
              </label>
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t("password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("passwordPlaceholder")}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
              />
              {mode === "register" ? (
                <p className="text-xs text-muted-foreground">{t("passwordRule")}</p>
              ) : null}
            </div>
            {mode === "register" ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {t("passwordConfirm")}
                  </label>
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
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {t("email")}
                  </label>
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
                  <button
                    type="button"
                    onClick={sendVerificationCode}
                    disabled={sendingCode || !email.trim()}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground disabled:opacity-50"
                  >
                    {sendingCode ? t("processing") : t("sendVerificationCode")}
                  </button>
                  {verificationExpiresAt && !emailVerified ? (
                    <p className={`text-xs ${verificationRemainingSeconds > 0 ? "text-muted-foreground" : "text-red-500"}`}>
                      {verificationRemainingSeconds > 0
                        ? t("verificationExpiresIn", {
                            time: formatCountdown(verificationRemainingSeconds),
                          })
                        : t("verificationExpired")}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {t("verificationCode")}
                  </label>
                  <input
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value)}
                    placeholder={t("verificationCodePlaceholder")}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={verifyEmailCode}
                    disabled={verifyingCode || !email.trim() || !verificationCode.trim()}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground disabled:opacity-50"
                  >
                    {verifyingCode ? t("processing") : t("verifyVerificationCode")}
                  </button>
                  {emailVerified && emailVerifiedTarget === email.trim().toLowerCase() ? (
                    <p className="text-xs text-green-600">{t("verificationVerified")}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {t("nickname")}
                  </label>
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
              </>
            ) : null}

            {localError ? (
              <p className="text-sm text-red-500">{localError}</p>
            ) : null}
            {localStatus ? (
              <p className="text-sm text-green-600">{localStatus}</p>
            ) : null}

            <button
              type="button"
              disabled={
                localLoading ||
                !loginId.trim() ||
                !password.trim() ||
                (mode === "register" && !registerReady)
              }
              onClick={mode === "login" ? handleLocalLogin : handleLocalRegister}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {localLoading
                ? t("processing")
                : mode === "login"
                  ? t("localLoginAction")
                  : t("localRegisterAction")}
            </button>
          </div>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs text-muted-foreground">
                {t("or")}
              </span>
            </div>
          </div>

          {hasProvider("kakao") ? (
            <button
              type="button"
              onClick={() =>
                signIn("kakao", { callbackUrl: successCallbackUrl })
              }
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#FEE500] px-4 py-3 font-medium text-[#191919] transition-all duration-200 hover:bg-[#FDD800] hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
            >
              <svg
                aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M10 2.5C5.30558 2.5 1.5 5.53485 1.5 9.27273C1.5 11.6561 3.07455 13.7515 5.45455 14.9545L4.54545 18.0909C4.48485 18.303 4.72727 18.4697 4.90909 18.3333L8.60606 15.8182C9.06061 15.8788 9.52727 15.9091 10 15.9091C14.6944 15.9091 18.5 12.8742 18.5 9.13636C18.5 5.53485 14.6944 2.5 10 2.5Z"
                  fill="currentColor"
                />
              </svg>
              {t("kakao")}
            </button>
          ) : null}

          {hasProvider("google") ? (
            <button
              type="button"
              onClick={() =>
                signIn("google", { callbackUrl: successCallbackUrl })
              }
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 font-medium text-foreground transition-all duration-200 hover:bg-muted hover:scale-[1.02] hover:shadow-lg hover:border-foreground/20 active:scale-[0.98]"
            >
              <svg
                aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {t("google")}
            </button>
          ) : null}

          {hasProvider("apple") ? (
            <button
              type="button"
              onClick={() =>
                signIn("apple", { callbackUrl: successCallbackUrl })
              }
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-black px-4 py-3 font-medium text-white transition-all duration-200 hover:bg-black/90 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
            >
              <svg
                aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M16.365 1.43c0 1.14-.465 2.254-1.203 3.064-.773.842-2.023 1.49-3.173 1.455-.147-1.104.43-2.265 1.174-3.044.803-.835 2.177-1.486 3.202-1.475zM20.93 17.06c-.66 1.44-.97 2.081-1.82 3.386-1.19 1.825-2.868 4.102-4.947 4.118-1.847.016-2.324-1.21-4.832-1.2-2.508.013-3.033 1.223-4.879 1.207-2.078-.016-3.667-2.073-4.857-3.898C-3.9 14.98-.4 8.35 4.56 8.28c1.93-.03 3.152 1.33 4.317 1.33 1.165 0 2.948-1.644 4.974-1.4.849.036 3.233.342 4.765 2.58-3.863 2.114-3.24 7.56 2.313 8.27z" />
              </svg>
              {t("apple")}
            </button>
          ) : null}

          {enabledProviders && !enabledProviders.has("apple") ? (
            <p className="text-xs text-muted-foreground">
              Apple 로그인은 서버 설정 반영 후 자동으로 표시됩니다.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
