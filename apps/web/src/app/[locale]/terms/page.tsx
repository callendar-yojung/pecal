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
  const t = await getTranslations({ locale, namespace: "termsOfService" });

  return {
    title: t("title"),
  };
}

export default function TermsOfServicePage() {
  const t = useTranslations("termsOfService");

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
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section2.title")}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              {(t.raw("section2.items") as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section3.title")}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              {(t.raw("section3.items") as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section4.title")}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              {(t.raw("section4.items") as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section5.title")}
            </h2>
            <p className="text-muted-foreground">{t("section5.content")}</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              {(t.raw("section5.items") as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section6.title")}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              {(t.raw("section6.items") as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section7.title")}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              {(t.raw("section7.items") as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          {/* Section 8 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section8.title")}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              {(t.raw("section8.items") as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          {/* Section 9 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section9.title")}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              {(t.raw("section9.items") as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          {/* Section 10 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section10.title")}
            </h2>
            <p className="text-muted-foreground">{t("section10.content")}</p>
          </section>

          {/* Section 11 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section11.title")}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              {(t.raw("section11.items") as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          {/* Section 12 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section12.title")}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              {(t.raw("section12.items") as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          {/* Section 13 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section13.title")}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              {(t.raw("section13.items") as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          {/* Section 14 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t("section14.title")}
            </h2>
            <p className="text-muted-foreground">{t("section14.content")}</p>
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
