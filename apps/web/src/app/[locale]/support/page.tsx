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
  return {
    ...buildStaticMetadata({
      locale: isKo ? "ko" : "en",
      title: isKo ? "Pecal 지원" : "Pecal Support",
      description: isKo
        ? "문의, 로그인 문제, 계정 삭제, 결제 및 오류 제보 채널을 확인하세요."
        : "Find contact channels for support, sign-in issues, account deletion, billing, and bug reports.",
      path: `/${isKo ? "ko" : "en"}/support`,
    }),
  };
}

export default async function SupportPage({ params }: { params: Params }) {
  const { locale } = await params;
  const isKo = locale === "ko";

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-foreground">
              {isKo ? "Pecal 지원" : "Pecal Support"}
            </h1>
            <p className="text-muted-foreground">
              {isKo
                ? "문의, 로그인 문제, 계정 삭제, 결제 및 오류 제보를 아래 채널로 접수할 수 있습니다."
                : "Use the channels below for inquiries, sign-in issues, account deletion, billing, and bug reports."}
            </p>
          </div>

          <section className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {isKo ? "문의" : "Contact"}
              </h2>
              <p className="mt-2 text-card-foreground">
                Email:{" "}
                <a
                  href="mailto:support@pecal.site"
                  className="underline underline-offset-4"
                >
                  support@pecal.site
                </a>
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {isKo ? "개인정보 / 계정 삭제" : "Privacy / Account deletion"}
              </h2>
              <p className="mt-2 text-card-foreground">
                {isKo
                  ? "계정 삭제는 앱 설정 > 프로필 > 계정 삭제에서 바로 진행할 수 있습니다."
                  : "You can delete your account directly in the app under Settings > Profile > Delete Account."}
              </p>
              <p className="mt-2 text-card-foreground">
                {isKo ? "추가 안내 페이지:" : "Additional information page:"}{" "}
                <Link
                  href="/delete-account"
                  className="underline underline-offset-4"
                >
                  {isKo ? "계정 삭제 안내" : "Delete account guide"}
                </Link>
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {isKo ? "운영 정보" : "Business information"}
              </h2>
              <p className="mt-2 text-card-foreground">Pecal</p>
              <p className="text-card-foreground">
                {isKo
                  ? "개인정보 보호책임자 / 담당 부서: Pecal 운영팀"
                  : "Privacy Officer / Department: Pecal Operations Team"}
              </p>
              <p className="text-card-foreground">
                Email:{" "}
                <a
                  href="mailto:privacy@pecal.com"
                  className="underline underline-offset-4"
                >
                  privacy@pecal.com
                </a>
              </p>
            </div>
          </section>
          <LegalNoticePanel locale={locale} current="support" />
        </div>
      </main>
    </div>
  );
}
