"use client";

import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";

export default function LoginPage() {
  const t = useTranslations("login");
  const params = useParams<{ locale: string }>();
  const locale = params?.locale || "en";
  const successCallbackUrl = `/${locale}/login/success`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-background p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {t("title")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t("description")}
          </p>
        </div>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => signIn("kakao", { callbackUrl: successCallbackUrl })}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#FEE500] px-4 py-3 font-medium text-[#191919] transition-all duration-200 hover:bg-[#FDD800] hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
          >
            <svg
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

          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: successCallbackUrl })}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 font-medium text-foreground transition-all duration-200 hover:bg-muted hover:scale-[1.02] hover:shadow-lg hover:border-foreground/20 active:scale-[0.98]"
          >
            <svg
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

          <button
            type="button"
            onClick={() => signIn("apple", { callbackUrl: successCallbackUrl })}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-black px-4 py-3 font-medium text-white transition-all duration-200 hover:bg-black/90 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
          >
            <svg
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
        </div>
      </div>
    </div>
  );
}
