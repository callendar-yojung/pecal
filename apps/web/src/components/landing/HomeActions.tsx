"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

type StoreAction = {
  key: "windows" | "appStore" | "playStore";
  href: string | null;
};

const STORE_ACTIONS: StoreAction[] = [
  {
    key: "windows",
    href:
      process.env.NEXT_PUBLIC_WINDOWS_STORE_URL ??
      "https://apps.microsoft.com/detail/xpdm17p9fk4bjf?hl=ko-KR&gl=KR",
  },
  {
    key: "appStore",
    href: process.env.NEXT_PUBLIC_APP_STORE_URL ?? null,
  },
  {
    key: "playStore",
    href: process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? null,
  },
];

function ActionIcon({ keyName }: { keyName: StoreAction["key"] | "web" }) {
  let src = "/store-icons/web.png";
  if (keyName === "windows") src = "/store-icons/windows.png";
  if (keyName === "appStore") src = "/store-icons/appstore.png";
  if (keyName === "playStore") src = "/store-icons/playstore.png";

  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/70 bg-background/80 p-1 shadow-sm dark:bg-foreground/5">
      <Image
        src={src}
        alt=""
        width={16}
        height={16}
        className="h-4 w-4 object-contain"
        aria-hidden="true"
      />
    </span>
  );
}

function ActionRightHint() {
  return <span className="text-sm text-muted-foreground">→</span>;
}

export default function HomeActions() {
  const t = useTranslations("homeActions");

  return (
    <section className="px-6 py-16 md:py-24">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center rounded-3xl border border-border bg-card p-8 text-center shadow-lg">
        <h1 className="text-3xl font-bold text-foreground md:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 text-base text-muted-foreground">{t("description")}</p>

        <div className="mt-8 flex w-full flex-col gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-12 min-h-12 items-center justify-between rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <span className="inline-flex items-center gap-2">
              <ActionIcon keyName="web" />
              {t("web")}
            </span>
            <ActionRightHint />
          </Link>

          {STORE_ACTIONS.map((store) =>
            store.href ? (
              <a
                key={store.key}
                href={store.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 min-h-12 items-center justify-between rounded-xl border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/60"
              >
                <span className="inline-flex items-center gap-2">
                  <ActionIcon keyName={store.key} />
                  {t(store.key)}
                </span>
                <ActionRightHint />
              </a>
            ) : (
              <button
                key={store.key}
                type="button"
                disabled
                className="inline-flex h-12 min-h-12 items-center justify-between rounded-xl border border-border bg-muted px-5 text-sm font-semibold text-muted-foreground"
              >
                <span className="inline-flex items-center gap-2">
                  <ActionIcon keyName={store.key} />
                  {t(store.key)}
                </span>
                <span>{t("comingSoon")}</span>
              </button>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
