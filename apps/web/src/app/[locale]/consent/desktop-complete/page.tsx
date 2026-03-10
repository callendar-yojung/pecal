import Link from "next/link";
import { getLocale } from "next-intl/server";

export default async function DesktopConsentCompletePage() {
  const locale = await getLocale();
  const isKo = locale === "ko";

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="inline-flex w-fit items-center rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          {isKo ? "동의 완료" : "Consent completed"}
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          {isKo ? "동의가 완료됐습니다." : "Consent has been completed."}
        </h1>
        <p className="text-base leading-7 text-muted-foreground">
          {isKo
            ? "이제 데스크탑 앱으로 돌아가 일정을 등록해보세요."
            : "You can now return to the desktop app and create your schedule."}
        </p>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <Link
            href={`/${locale}`}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted/60"
          >
            {isKo ? "홈으로 이동" : "Go to home"}
          </Link>
        </div>
      </div>
    </main>
  );
}
