import type { Metadata } from "next";
import LegalNoticePanel from "@/components/legal/LegalNoticePanel";
import { Link } from "@/i18n/routing";
import { buildStaticMetadata } from "@/lib/site-metadata";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { locale } = await params;
  const isKo = locale !== "en";
  return buildStaticMetadata({
    locale: isKo ? "ko" : "en",
    title: isKo ? "계정 삭제 안내" : "Delete Account",
    description: isKo
      ? "앱에서 계정을 삭제하는 방법과 제한 사항을 확인하세요."
      : "Review how to delete your account in the app and the related restrictions.",
    path: `/${isKo ? "ko" : "en"}/delete-account`,
  });
}

export default async function DeleteAccountPage({
  params,
}: {
  params: Params;
}) {
  const { locale } = await params;
  const isKo = locale === "ko";

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-foreground">
              {isKo ? "계정 삭제 안내" : "Delete Account"}
            </h1>
            <p className="text-muted-foreground">
              {isKo
                ? "Pecal 계정은 앱에서 직접 삭제할 수 있습니다."
                : "Your Pecal account can be deleted directly from the app."}
            </p>
          </div>

          <section className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              {isKo ? "삭제 방법" : "How to delete"}
            </h2>
            <ol className="list-decimal space-y-2 pl-5 text-card-foreground">
              <li>
                {isKo
                  ? "앱 실행 후 설정으로 이동합니다."
                  : "Open the app and go to Settings."}
              </li>
              <li>
                {isKo
                  ? "프로필 화면에서 계정 삭제를 선택합니다."
                  : "Open Profile and choose Delete Account."}
              </li>
              <li>
                {isKo
                  ? "안내 문구를 확인하고 최종 삭제를 진행합니다."
                  : "Review the warning and confirm the deletion."}
              </li>
            </ol>
            <p className="text-sm text-muted-foreground">
              {isKo
                ? "팀 소유자는 팀을 이전하거나 삭제한 뒤 계정을 삭제할 수 있습니다."
                : "Team owners must transfer or delete their team before deleting the account."}
            </p>
          </section>

          <section className="rounded-lg border border-border bg-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              {isKo ? "도움이 필요하신가요?" : "Need help?"}
            </h2>
            <p className="text-card-foreground">
              <a
                href="mailto:support@pecal.site"
                className="underline underline-offset-4"
              >
                support@pecal.site
              </a>
            </p>
            <p className="text-card-foreground">
              <Link href="/support" className="underline underline-offset-4">
                {isKo ? "지원 페이지로 이동" : "Go to support page"}
              </Link>
            </p>
          </section>
          <LegalNoticePanel locale={locale} current="delete-account" />
        </div>
      </main>
    </div>
  );
}
