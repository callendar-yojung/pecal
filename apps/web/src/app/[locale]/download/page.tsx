"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";

interface ReleaseInfo {
  version: string;
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  releaseNotes?: string;
}

interface Releases {
  windows?: ReleaseInfo;
  macos?: ReleaseInfo;
  "macos-arm64"?: ReleaseInfo;
  "macos-x64"?: ReleaseInfo;
  linux?: ReleaseInfo;
  ubuntu?: ReleaseInfo;
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === "windows") {
    return (
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.95" />
      </svg>
    );
  }
  if (platform === "macos" || platform === "macos-arm64" || platform === "macos-x64") {
    return (
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
    );
  }
  // Linux/Ubuntu
  return (
    <svg className="h-12 w-12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 00-.205.334 1.18 1.18 0 00-.09.4v.019c.002.089.008.179.02.267-.193-.067-.438-.135-.607-.202a1.635 1.635 0 01-.018-.2v-.02a1.772 1.772 0 01.15-.768c.082-.22.232-.406.43-.533a.985.985 0 01.594-.2zm-2.962.059h.036c.142 0 .27.048.399.135.146.129.264.288.344.465.09.199.14.4.153.667v.004c.007.134.006.2-.002.266v.08c-.03.007-.056.018-.083.024-.152.055-.274.135-.393.2.012-.09.013-.18.003-.267v-.015c-.012-.133-.04-.2-.082-.333a.613.613 0 00-.166-.267.248.248 0 00-.183-.064h-.021c-.071.006-.13.04-.186.132a.552.552 0 00-.12.27.944.944 0 00-.023.33v.015c.012.135.037.2.08.334.046.134.098.2.166.268.01.009.02.018.034.024-.07.057-.117.07-.176.136a.304.304 0 01-.131.068 2.62 2.62 0 01-.275-.402 1.772 1.772 0 01-.155-.667 1.759 1.759 0 01.08-.668 1.43 1.43 0 01.283-.535c.128-.133.26-.2.418-.2zm1.37 1.706c.332 0 .733.065 1.216.399.293.2.523.269 1.052.468h.003c.255.136.405.266.478.399v-.131a.571.571 0 01.016.47c-.123.31-.516.643-1.063.842v.002c-.268.135-.501.333-.775.465-.276.135-.588.292-1.012.267a1.139 1.139 0 01-.448-.067 3.566 3.566 0 01-.322-.198c-.195-.135-.363-.332-.612-.465v-.005h-.005c-.4-.246-.616-.512-.686-.71-.07-.268-.005-.47.193-.6.224-.135.38-.271.483-.336.104-.074.143-.102.176-.131h.002v-.003c.169-.202.436-.47.839-.601.139-.036.294-.065.466-.065zm2.8 2.142c.358 1.417 1.196 3.475 1.735 4.473.286.534.855 1.659 1.102 3.024.156-.005.33.018.513.064.646-1.671-.546-3.467-1.089-3.966-.22-.2-.232-.335-.123-.335.59.534 1.365 1.572 1.646 2.757.13.535.16 1.104.021 1.67.067.028.135.06.205.067 1.032.534 1.413.938 1.23 1.537v-.002c-.06-.135-.12-.2-.197-.334h-.003c-.028-.012-.077-.065-.14-.135-.064-.066-.148-.143-.232-.133h-.003c-.085.007-.133.06-.18.133-.05.078-.086.142-.137.2-.042.067-.094.133-.163.133-.027 0-.048-.009-.063-.025-.071-.065-.089-.194-.089-.33v-.005c0-.065-.002-.133-.018-.2-.043-.2-.161-.333-.416-.733-.085-.135-.144-.266-.166-.401-.025-.067-.041-.135-.046-.2-.006-.202.002-.4.055-.601.002-.065.006-.14.01-.2.034-.27-.036-.469-.235-.802a8.807 8.807 0 00-.27-.397c-.03-.054-.063-.088-.091-.162-.007-.02-.011-.04-.015-.06-.04-.135-.09-.27-.17-.4-.063-.103-.127-.202-.193-.3a.467.467 0 00-.046-.07c-.14-.199-.292-.4-.447-.598-.039-.047-.08-.095-.123-.138-.202-.2-.32-.266-.375-.334-.104-.134-.076-.2.031-.2.09 0 .234.067.39.2.143.135.2.2.292.334v.002c.049.069.098.138.147.2.029.034.057.066.086.1.22.267.46.535.642.8v.002c.044.068.083.133.118.2.018.034.033.07.05.101.108.2.175.332.226.401.044.06.088.088.147.133h.018c.029-.065.048-.15.043-.266-.003-.058-.012-.116-.022-.173-.058-.2-.114-.4-.149-.603-.018-.132-.03-.266-.038-.4-.004-.108-.006-.218-.007-.332-.006-.2.022-.402.063-.6.048-.198.09-.4.12-.601.04-.2.1-.468.145-.734.042-.27.087-.537.078-.8-.017-.466-.193-.935-.518-1.27-.034-.052-.069-.1-.104-.15z" />
    </svg>
  );
}

export default function DownloadPage() {
  const t = useTranslations("download");
  const [releases, setReleases] = useState<Releases>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReleases() {
      try {
        const response = await fetch("/api/releases/latest");
        if (!response.ok) {
          throw new Error("Failed to fetch releases");
        }
        const data = await response.json();
        setReleases(data.releases || {});
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchReleases();
  }, []);

  const platforms = [
    {
      key: "windows",
      name: t("platforms.windows"),
      description: t("platforms.windowsDesc"),
      release: releases.windows,
    },
    {
      key: "macos-arm64",
      name: t("platforms.macosArm"),
      description: t("platforms.macosArmDesc"),
      release: releases["macos-arm64"] || releases.macos,
    },
    {
      key: "macos-x64",
      name: t("platforms.macosIntel"),
      description: t("platforms.macosIntelDesc"),
      release: releases["macos-x64"],
    },
    {
      key: "linux",
      name: t("platforms.linux"),
      description: t("platforms.linuxDesc"),
      release: releases.linux || releases.ubuntu,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-foreground">
              Kelindor
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:opacity-90"
            >
              {t("login")}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              {t("title")}
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              {t("description")}
            </p>
          </div>
        </div>
      </section>

      {/* Download Cards */}
      <section className="pb-20">
        <div className="mx-auto max-w-5xl px-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-8 text-center">
              <p className="text-destructive">{t("error")}</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {platforms.map((platform) => (
                <div
                  key={platform.key}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 transition-all hover:border-primary/50 hover:shadow-lg"
                >
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0 text-muted-foreground transition-colors group-hover:text-foreground">
                      <PlatformIcon platform={platform.key} />
                    </div>
                    <div className="flex-1">
                      <h3 className="mb-1 text-xl font-semibold text-foreground">
                        {platform.name}
                      </h3>
                      <p className="mb-4 text-sm text-muted-foreground">
                        {platform.description}
                      </p>

                      {platform.release ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              v{platform.release.version}
                            </span>
                            {platform.release.fileSize && (
                              <span>{formatFileSize(platform.release.fileSize)}</span>
                            )}
                          </div>
                          <a
                            href={platform.release.downloadUrl}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all hover:opacity-90"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                              />
                            </svg>
                            {t("downloadButton")}
                          </a>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                          {t("comingSoon")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* System Requirements */}
      <section className="border-t border-border py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold text-foreground">
            {t("requirements.title")}
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 font-semibold text-foreground">Windows</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Windows 10 {t("requirements.orLater")}</li>
                <li>• 64-bit</li>
                <li>• 4GB RAM</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 font-semibold text-foreground">macOS</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• macOS 11 (Big Sur) {t("requirements.orLater")}</li>
                <li>• Apple Silicon / Intel</li>
                <li>• 4GB RAM</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 font-semibold text-foreground">Linux</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Ubuntu 20.04 {t("requirements.orLater")}</li>
                <li>• 64-bit</li>
                <li>• 4GB RAM</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Kelindor. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}