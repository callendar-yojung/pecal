import Link from "next/link";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LoginSuccessPage({ params }: Props) {
  const { locale } = await params;
  const isKo = locale === "ko";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4">
      <section className="w-full max-w-md rounded-2xl bg-background p-8 shadow-lg">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <svg
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-center text-2xl font-bold text-foreground">
          {isKo ? "로그인 성공!" : "Login successful!"}
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {isKo
            ? "이제 Pecal을 사용할 수 있어요."
            : "You can now use Pecal."}
        </p>

        <div className="mt-7 space-y-3">
          <Link
            href={`/${locale}/dashboard`}
            className="block w-full rounded-xl bg-primary px-4 py-3 text-center font-medium text-primary-foreground transition hover:opacity-90"
          >
            {isKo ? "대시보드로 이동" : "Go to dashboard"}
          </Link>
          <Link
            href={`/${locale}`}
            className="block w-full rounded-xl border border-border bg-background px-4 py-3 text-center font-medium text-foreground transition hover:bg-muted"
          >
            {isKo ? "홈으로 이동" : "Go to home"}
          </Link>
        </div>
      </section>
    </main>
  );
}
