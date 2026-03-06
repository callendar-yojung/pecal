import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";

export const SITE_URL = "https://pecal.site";
export const DEFAULT_OG_IMAGE = "/og-pecal.png";

function toOpenGraphLocale(locale: Locale) {
  return locale === "ko" ? "ko_KR" : "en_US";
}

export function buildStaticMetadata(params: {
  locale: Locale;
  title: string;
  description: string;
  path: string;
  image?: string;
}): Metadata {
  const { locale, title, description, path, image = DEFAULT_OG_IMAGE } = params;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const absoluteUrl = `${SITE_URL}${normalizedPath}`;

  return {
    title,
    description,
    alternates: {
      canonical: absoluteUrl,
    },
    openGraph: {
      type: "website",
      url: absoluteUrl,
      siteName: "Pecal",
      locale: toOpenGraphLocale(locale),
      title,
      description,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
