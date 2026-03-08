"use client";

import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type LoginSessionItem = {
  session_id: string;
  provider: string | null;
  client_platform: string | null;
  client_name: string | null;
  app_version: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  current: boolean;
};

function detectBrowser(userAgent: string | null) {
  const ua = userAgent?.toLowerCase() ?? "";

  if (!ua) return "Unknown";
  if (ua.includes("edg/")) return "Microsoft Edge";
  if (ua.includes("whale/")) return "Naver Whale";
  if (ua.includes("opr/") || ua.includes("opera/")) return "Opera";
  if (ua.includes("chrome/") && !ua.includes("edg/")) return "Google Chrome";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "Safari";
  if (ua.includes("firefox/")) return "Firefox";
  return "Unknown";
}

function detectDeviceType(userAgent: string | null, platform: string | null) {
  const ua = userAgent?.toLowerCase() ?? "";

  if (platform === "desktop") return "Desktop app";
  if (platform === "mobile") return "Mobile app";
  if (
    ua.includes("iphone") ||
    ua.includes("android") ||
    ua.includes("mobile")
  ) {
    return "Mobile browser";
  }
  if (ua.includes("ipad") || ua.includes("tablet")) {
    return "Tablet";
  }
  if (ua) return "Desktop browser";
  return "Unknown device";
}

function detectHardware(userAgent: string | null, platform: string | null) {
  const ua = userAgent?.toLowerCase() ?? "";

  if (platform === "desktop") return "Desktop";
  if (platform === "ios") return "iPhone";
  if (platform === "android") return "Android";
  if (ua.includes("iphone")) return "iPhone";
  if (ua.includes("ipad")) return "iPad";
  if (ua.includes("android") && ua.includes("mobile")) return "Android phone";
  if (ua.includes("android")) return "Android tablet";
  if (ua.includes("mac os x") || ua.includes("macintosh")) return "Mac";
  if (ua.includes("windows nt")) return "Windows PC";
  if (ua.includes("linux")) return "Linux PC";
  return "Unknown device";
}

export default function SecurityPage() {
  const t = useTranslations("dashboard.settings.security");
  const { status } = useSession();
  const [sessions, setSessions] = useState<LoginSessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    let active = true;

    const loadSessions = async () => {
      try {
        setSessionsLoading(true);
        const response = await fetch("/api/me/sessions", {
          credentials: "include",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load sessions");
        }

        if (active) {
          setSessions(data.sessions ?? []);
        }
      } catch (error) {
        console.error("Failed to load sessions:", error);
      } finally {
        if (active) {
          setSessionsLoading(false);
        }
      }
    };

    const handleWebJwtSynced = () => {
      void loadSessions();
    };

    void loadSessions();
    window.addEventListener("pecal:web-jwt-synced", handleWebJwtSynced);

    return () => {
      active = false;
      window.removeEventListener("pecal:web-jwt-synced", handleWebJwtSynced);
    };
  }, [status]);

  const formatSessionTime = (value: string) => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
    } catch {
      return value;
    }
  };

  const formatSessionTitle = (item: LoginSessionItem) => {
    const clientName = item.client_name?.trim();
    if (
      clientName &&
      clientName !== "Pecal" &&
      clientName !== "Pecal Web"
    ) {
      return clientName;
    }

    return detectHardware(item.user_agent, item.client_platform) || t("unknownDevice");
  };

  const formatProvider = (provider: string | null) => {
    if (!provider) return t("unknownProvider");
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  };

  const formatEnvironment = (item: LoginSessionItem) => {
    const deviceType = detectDeviceType(item.user_agent, item.client_platform);
    const browser = detectBrowser(item.user_agent);

    if (
      item.client_platform === "desktop" ||
      item.client_platform === "mobile" ||
      item.client_platform === "ios" ||
      item.client_platform === "android"
    ) {
      return deviceType;
    }

    return browser ? `${deviceType} · ${browser}` : deviceType;
  };

  const handleRevokeSession = async (sessionId: string) => {
    const confirmed = window.confirm(t("revokeDeviceConfirm"));
    if (!confirmed) return;

    try {
      setRevokingSessionId(sessionId);
      const response = await fetch(`/api/me/sessions/${sessionId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to revoke session");
      }

      setSessions((currentSessions) =>
        currentSessions.filter((item) => item.session_id !== sessionId),
      );
    } catch (error) {
      console.error("Failed to revoke session:", error);
      alert(t("revokeDeviceFailed"));
    } finally {
      setRevokingSessionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="dashboard-glass-card p-6">
        <h2 className="text-lg font-semibold text-card-foreground">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>

        <div className="mt-6 space-y-3">
          {sessionsLoading ? (
            <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              {t("loadingDevices")}
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              {t("noDevices")}
            </div>
          ) : (
            sessions.map((item) => (
              <div
                key={item.session_id}
                className="rounded-2xl border border-border/70 bg-background/60 px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-card-foreground">
                        {formatSessionTitle(item)}
                      </span>
                      {item.current && (
                        <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-medium text-primary">
                          {t("currentDevice")}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>
                        {t("deviceLabel")}: {formatEnvironment(item)}
                      </p>
                      <p>
                        {t("providerLabel")}: {formatProvider(item.provider)}
                      </p>
                      {item.app_version && (
                        <p>
                          {t("appVersionLabel")}: {item.app_version}
                        </p>
                      )}
                      <p>
                        {t("lastActive")}:{" "}
                        {formatSessionTime(item.last_seen_at)}
                      </p>
                    </div>
                  </div>
                  {!item.current && (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(item.session_id)}
                      disabled={revokingSessionId === item.session_id}
                      className="rounded-xl border border-destructive px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                    >
                      {revokingSessionId === item.session_id
                        ? t("revokingDevice")
                        : t("revokeDevice")}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
