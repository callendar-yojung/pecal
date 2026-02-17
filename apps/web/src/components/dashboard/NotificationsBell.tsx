"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

interface NotificationItem {
  notification_id: number;
  type: string;
  title: string | null;
  message: string | null;
  payload_json: string | null;
  source_type: string | null;
  source_id: number | null;
  is_read: number;
  created_at: string;
  invitation_status?: string | null;
  team_name?: string | null;
  inviter_name?: string | null;
}

export default function NotificationsBell() {
  const t = useTranslations("dashboard.notifications");
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchCount = async () => {
    const res = await fetch("/api/notifications/unread");
    const data = await res.json();
    if (res.ok) setCount(Number(data.count || 0));
  };

  const fetchList = async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/notifications?limit=20");
      const data = await res.json();
      if (res.ok) {
        setItems(data.notifications || []);
      } else {
        setItems([]);
        setListError(t("loadError"));
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      setItems([]);
      setListError(t("loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (open) {
      fetchList();
      fetchCount();
    }
  }, [open]);

  const handleMarkRead = async (id: number) => {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setItems((prev) => prev.map((n) => (n.notification_id === id ? { ...n, is_read: 1 } : n)));
    fetchCount();
  };

  const handleRespond = async (invitationId: number, action: "accept" | "decline") => {
    const res = await fetch(`/api/invitations/${invitationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      fetchList();
      fetchCount();
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((n) => n.notification_id !== id));
    fetchCount();
  };

  const handleClearAll = async () => {
    await fetch("/api/notifications/clear", { method: "DELETE" });
    setItems([]);
    fetchCount();
  };

  const empty = useMemo(
    () => !loading && !listError && items.length === 0,
    [loading, listError, items.length]
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={t("title")}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0h6z"
          />
        </svg>
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-popover shadow-lg z-50">
          <div className="flex items-center justify-between border-b border-border px-4 py-2 text-sm font-semibold">
            <span>{t("title")}</span>
            {items.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t("clearAll")}
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="p-4 text-sm text-muted-foreground">{t("loading")}</div>
            )}
            {listError && !loading && (
              <div className="p-4 text-sm text-muted-foreground">
                {listError}
                <button
                  type="button"
                  onClick={fetchList}
                  className="ml-2 text-xs text-foreground underline"
                >
                  {t("retry")}
                </button>
              </div>
            )}
            {empty && (
              <div className="p-4 text-sm text-muted-foreground">{t("empty")}</div>
            )}
            {!loading && items.map((n) => (
              <div key={n.notification_id} className={`px-4 py-3 text-sm border-b border-border ${n.is_read ? "bg-background" : "bg-muted/40"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{n.title || t("notification")}</p>
                    {n.message && <p className="mt-1 text-xs text-muted-foreground">{n.message}</p>}
                    {n.source_type === "TEAM_INVITE" && (
                      <div className="mt-2 flex gap-2">
                        {n.invitation_status === "PENDING" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRespond(Number(n.source_id), "accept")}
                              className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white"
                            >
                              {t("accept")}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRespond(Number(n.source_id), "decline")}
                              className="rounded-md border border-border px-2 py-1 text-xs"
                            >
                              {t("decline")}
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {n.invitation_status === "ACCEPTED" ? t("accepted") : t("declined")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {!n.is_read && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(n.notification_id)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        {t("markRead")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(n.notification_id)}
                      className="text-xs text-muted-foreground hover:text-destructive"
                      aria-label={t("delete")}
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
