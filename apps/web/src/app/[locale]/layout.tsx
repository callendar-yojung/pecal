import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/config";
import type { Metadata } from "next";
import SessionProvider from "@/components/SessionProvider";
import { ThemeProvider } from "@/contexts/ThemeContext";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const messages = (await import(`../../../messages/${locale}.json`)).default;
  const t = messages.metadata;

  const baseUrl = "https://trabien.com";

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: t.title,
      template: `%s | Pecal`,
    },
    description: t.description,
    keywords:
      locale === "ko"
        ? [
            "협업 도구",
            "프로젝트 관리",
            "팀 워크스페이스",
            "문서 관리",
            "생산성",
            "Pecal",
            "KD",
          ]
        : [
            "collaboration tool",
            "project management",
            "team workspace",
            "document management",
            "productivity",
            "Pecal",
            "KD",
          ],
    authors: [{ name: "Pecal Team" }],
    creator: "Pecal",
    alternates: {
      canonical: `${baseUrl}/${locale}`,
      languages: {
        ko: `${baseUrl}/ko`,
        en: `${baseUrl}/en`,
        "x-default": baseUrl,
      },
    },
    openGraph: {
      type: "website",
      locale: locale === "ko" ? "ko_KR" : "en_US",
      url: `${baseUrl}/${locale}`,
      siteName: "Pecal",
      title: t.title,
      description: t.ogDescription,
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: t.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t.title,
      description: t.ogDescription,
      images: ["/og-image.png"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  // 플래시 방지를 위한 인라인 스크립트
  const themeScript = `
    (function() {
      function getTheme() {
        var match = document.cookie.split('; ').find(function(row){ return row.trim().indexOf('theme=') === 0 });
        return match ? decodeURIComponent(match.split('=')[1]) : null;
      }
      var raw = getTheme();
      var theme = raw ? raw.toLowerCase() : 'light';
      var root = document.documentElement;
      root.classList.remove('light','dark');
      if (theme === 'dark' || theme === 'black') {
        root.classList.add('dark');
      } else {
        root.classList.add('light');
      }
    })();
  `;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          <ThemeProvider>
            <NextIntlClientProvider messages={messages}>
              {children}
            </NextIntlClientProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
