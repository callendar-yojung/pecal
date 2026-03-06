import { Link } from "@/i18n/routing";

type LegalNoticePanelProps = {
  locale: string;
  current: "privacy" | "terms" | "support" | "delete-account";
};

const content = {
  ko: {
    title: "법적 고지 및 지원",
    description:
      "개인정보 처리방침, 이용약관, 지원, 계정 삭제 안내를 한곳에서 확인할 수 있습니다.",
    links: {
      privacy: "개인정보 처리방침",
      terms: "이용약관",
      support: "지원",
      "delete-account": "계정 삭제 안내",
    },
  },
  en: {
    title: "Legal notice and support",
    description:
      "Find the privacy policy, terms, support, and account deletion information in one place.",
    links: {
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      support: "Support",
      "delete-account": "Delete Account",
    },
  },
} as const;

export default function LegalNoticePanel({
  locale,
  current,
}: LegalNoticePanelProps) {
  const copy = locale === "ko" ? content.ko : content.en;
  const items: Array<{ key: LegalNoticePanelProps["current"]; href: string }> =
    [
      { key: "privacy", href: "/privacy" },
      { key: "terms", href: "/terms" },
      { key: "support", href: "/support" },
      { key: "delete-account", href: "/delete-account" },
    ];

  return (
    <section className="mt-12 rounded-2xl border border-border bg-card p-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">{copy.title}</h2>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        {items.map((item) => {
          const isCurrent = item.key === current;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={
                isCurrent
                  ? "rounded-full border border-primary bg-primary/10 px-4 py-2 text-sm font-medium text-primary"
                  : "rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {copy.links[item.key]}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
