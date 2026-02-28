"use client";

import { useEffect, useMemo, useState } from "react";

type Inbound = {
  channel?: string;
  type?: "set-value";
  payload?: {
    value?: string;
    label?: string;
    theme?: "light" | "dark";
  };
};

type Outbound =
  | { channel: "pecal-datetime"; type: "ready" }
  | { channel: "pecal-datetime"; type: "change"; payload: { value: string } }
  | { channel: "pecal-datetime"; type: "error"; payload: { message: string } };

function postToNative(message: Outbound) {
  const serialized = JSON.stringify(message);
  if (
    typeof window !== "undefined" &&
    (window as any).ReactNativeWebView?.postMessage
  ) {
    (window as any).ReactNativeWebView.postMessage(serialized);
  }
}

function splitDateTime(value: string) {
  if (!value) return { date: "", time: "09:00" };
  const [date, time] = value.split("T");
  return {
    date: date || "",
    time: (time || "09:00").slice(0, 5),
  };
}

function toIso(date: string, time: string) {
  if (!date) return "";
  const local = `${date}T${time || "09:00"}`;
  const parsed = new Date(local);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

function applyTheme(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);

  const palette =
    theme === "dark"
      ? {
          "--background": "#07090E",
          "--foreground": "#F8FAFF",
          "--card": "#10131B",
          "--card-foreground": "#F8FAFF",
          "--popover": "#10131B",
          "--popover-foreground": "#F8FAFF",
          "--primary": "#7B88FF",
          "--primary-foreground": "#07090E",
          "--secondary": "#171C28",
          "--secondary-foreground": "#F8FAFF",
          "--muted": "#171C28",
          "--muted-foreground": "#8D98AF",
          "--border": "#202637",
          "--input": "#202637",
          "--ring": "#4C5A78",
          "--page-background": "#07090E",
          "--dashboard-background": "#07090E",
          "--sidebar-background": "#0D111A",
          "--sidebar-foreground": "#F8FAFF",
          "--sidebar-border": "#202637",
          "--subtle": "#171C28",
          "--subtle-foreground": "#8D98AF",
          "--hover": "#1B2434",
          "--active": "#273247",
        }
      : {
          "--background": "#F2F4FB",
          "--foreground": "#0F172A",
          "--card": "#FFFFFF",
          "--card-foreground": "#0F172A",
          "--popover": "#FFFFFF",
          "--popover-foreground": "#0F172A",
          "--primary": "#5B6CFF",
          "--primary-foreground": "#FFFFFF",
          "--secondary": "#ECEFF7",
          "--secondary-foreground": "#0F172A",
          "--muted": "#ECEFF7",
          "--muted-foreground": "#7C8599",
          "--border": "#E5EAF5",
          "--input": "#E5EAF5",
          "--ring": "#AAB4CB",
          "--page-background": "#F2F4FB",
          "--dashboard-background": "#F2F4FB",
          "--sidebar-background": "#FFFFFF",
          "--sidebar-foreground": "#0F172A",
          "--sidebar-border": "#E5EAF5",
          "--subtle": "#ECEFF7",
          "--subtle-foreground": "#7C8599",
          "--hover": "#E8ECF8",
          "--active": "#DCE3F5",
        };
  Object.entries(palette).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export default function MobileDateTimePage() {
  const [label, setLabel] = useState("날짜/시간");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  const timeOptions = useMemo(
    () =>
      Array.from({ length: 48 }, (_, idx) => {
        const hours = String(Math.floor(idx / 2)).padStart(2, "0");
        const minutes = idx % 2 === 0 ? "00" : "30";
        return `${hours}:${minutes}`;
      }),
    [],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(String(event.data)) as Inbound;
        if (parsed.channel !== "pecal-datetime" || parsed.type !== "set-value")
          return;
        if (parsed.payload?.label) setLabel(parsed.payload.label);
        if (
          parsed.payload?.theme === "dark" ||
          parsed.payload?.theme === "light"
        ) {
          setTheme(parsed.payload.theme);
        }
        const split = splitDateTime(parsed.payload?.value || "");
        setDate(split.date);
        setTime(split.time);
      } catch (error) {
        postToNative({
          channel: "pecal-datetime",
          type: "error",
          payload: {
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
    };

    window.addEventListener("message", onMessage);
    document.addEventListener("message", onMessage as unknown as EventListener);
    postToNative({ channel: "pecal-datetime", type: "ready" });
    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener(
        "message",
        onMessage as unknown as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    const rootTheme = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    setTheme(rootTheme);
  }, []);

  useEffect(() => {
    if (!theme) return;
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      if (!root.classList.contains(theme)) {
        applyTheme(theme);
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [theme]);

  useEffect(() => {
    const value = toIso(date, time);
    if (!value) return;
    postToNative({
      channel: "pecal-datetime",
      type: "change",
      payload: { value },
    });
  }, [date, time]);

  if (!theme) return <div className="min-h-screen bg-transparent p-2" />;

  return (
    <div className="min-h-screen bg-transparent p-2">
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="mb-2 text-xs font-semibold text-muted-foreground">
          {label}
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <select
            className="h-10 w-28 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          >
            {timeOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
