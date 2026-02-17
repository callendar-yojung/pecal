import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacyPolicy" });

  return {
    title: t("title"),
  };
}

export default function PrivacyPolicyPage() {
  const t = useTranslations("privacyPolicy");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            ← {t("title")}
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Title */}
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-foreground">
              {t("title")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("lastUpdated")}</p>
          </div>

          {/* Introduction */}
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="text-card-foreground leading-relaxed">{t("intro")}</p>
          </div>

          {/* Section 1 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section1.title")}
            </h2>
            <p className="text-muted-foreground">{t("section1.content")}</p>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  {t("section1.required.title")}
                </h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  {(t.raw("section1.required.items") as string[]).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  {t("section1.optional.title")}
                </h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  {(t.raw("section1.optional.items") as string[]).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section2.title")}
            </h2>
            <p className="text-muted-foreground">{t("section2.content")}</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              {(t.raw("section2.purposes") as string[]).map((purpose, i) => (
                <li key={i}>{purpose}</li>
              ))}
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section3.title")}
            </h2>
            <p className="text-muted-foreground">{t("section3.content")}</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              {(t.raw("section3.retention") as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section4.title")}
            </h2>
            <p className="text-muted-foreground">{t("section4.content")}</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              {(t.raw("section4.exceptions") as string[]).map((exception, i) => (
                <li key={i}>{exception}</li>
              ))}
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section5.title")}
            </h2>
            <p className="text-muted-foreground">{t("section5.content")}</p>
            <p className="text-sm text-muted-foreground italic">
              {t("section5.note")}
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section6.title")}
            </h2>
            <p className="text-muted-foreground">{t("section6.content")}</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              {(t.raw("section6.rights") as string[]).map((right, i) => (
                <li key={i}>{right}</li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground italic">
              {t("section6.note")}
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section7.title")}
            </h2>
            <p className="text-muted-foreground">{t("section7.content")}</p>
            <div className="space-y-2 ml-4">
              <p className="text-sm text-muted-foreground">
                • {t("section7.cookie.what")}
              </p>
              <p className="text-sm text-muted-foreground">
                • {t("section7.cookie.purpose")}
              </p>
              <p className="text-sm text-muted-foreground">
                • {t("section7.cookie.control")}
              </p>
            </div>
          </section>

          {/* Section 8 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section8.title")}
            </h2>
            <p className="text-muted-foreground">{t("section8.content")}</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              {(t.raw("section8.measures") as string[]).map((measure, i) => (
                <li key={i}>{measure}</li>
              ))}
            </ul>
          </section>

          {/* Section 9 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section9.title")}
            </h2>
            <p className="text-muted-foreground">{t("section9.content")}</p>

            <div className="rounded-lg border border-border bg-card p-6 space-y-3">
              <h3 className="font-semibold text-foreground">
                {t("section9.contact.title")}
              </h3>
              <p className="text-sm text-card-foreground">
                {t("section9.contact.name")}
              </p>
              <p className="text-sm text-card-foreground">
                {t("section9.contact.email")}
              </p>

              <div className="pt-4 mt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-2">
                  {t("section9.contact.note")}
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {(t.raw("section9.contact.agencies") as string[]).map((agency, i) => (
                    <li key={i}>• {agency}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Section 10 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section10.title")}
            </h2>
            <p className="text-muted-foreground">{t("section10.content")}</p>
          </section>
        </div>

        {/* Back to Home */}
        <div className="mt-12 pt-8 border-t border-border">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-accent px-6 py-3 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors"
          >
            {t("backToHome")}
          </Link>
        </div>
      </main>
    </div>
  );
}
