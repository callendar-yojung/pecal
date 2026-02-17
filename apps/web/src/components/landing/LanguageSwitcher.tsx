"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { localeNames, type Locale } from "@/i18n/config";

export default function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border p-1">
      {(Object.entries(localeNames) as [Locale, string][]).map(
        ([code, name]) => (
          <button
            key={code}
            type="button"
            onClick={() => switchLocale(code)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              locale === code
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {name}
          </button>
        )
      )}
    </div>
  );
}
