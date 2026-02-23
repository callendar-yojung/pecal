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
  if (typeof window !== "undefined" && (window as any).ReactNativeWebView?.postMessage) {
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
}

export default function MobileDateTimePage() {
  const [label, setLabel] = useState("날짜/시간");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const timeOptions = useMemo(
    () =>
      Array.from({ length: 48 }, (_, idx) => {
        const hours = String(Math.floor(idx / 2)).padStart(2, "0");
        const minutes = idx % 2 === 0 ? "00" : "30";
        return `${hours}:${minutes}`;
      }),
    []
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(String(event.data)) as Inbound;
        if (parsed.channel !== "pecal-datetime" || parsed.type !== "set-value") return;
        if (parsed.payload?.label) setLabel(parsed.payload.label);
        if (parsed.payload?.theme === "dark" || parsed.payload?.theme === "light") {
          setTheme(parsed.payload.theme);
        }
        const split = splitDateTime(parsed.payload?.value || "");
        setDate(split.date);
        setTime(split.time);
      } catch (error) {
        postToNative({
          channel: "pecal-datetime",
          type: "error",
          payload: { message: error instanceof Error ? error.message : String(error) },
        });
      }
    };

    window.addEventListener("message", onMessage);
    document.addEventListener("message", onMessage as unknown as EventListener);
    postToNative({ channel: "pecal-datetime", type: "ready" });
    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("message", onMessage as unknown as EventListener);
    };
  }, []);

  useEffect(() => {
    const queryTheme = new URLSearchParams(window.location.search).get("mobile_theme");
    if (queryTheme === "dark" || queryTheme === "light") setTheme(queryTheme);
  }, []);

  useEffect(() => {
    applyTheme(theme);
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

  return (
    <div className="min-h-screen bg-transparent p-2">
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="mb-2 text-xs font-semibold text-muted-foreground">{label}</div>
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
