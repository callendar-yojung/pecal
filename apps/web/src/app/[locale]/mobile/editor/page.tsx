"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RichTextEditor from "@/components/editor/RichTextEditor";

type BridgeInbound =
  | {
      channel?: string;
      type?: "set-content";
      payload?: {
        json?: string;
        text?: string;
        readOnly?: boolean;
        placeholder?: string;
        theme?: "light" | "dark";
      };
    }
  | Record<string, unknown>;

type BridgeOutbound =
  | { channel: "pecal-editor"; type: "ready" }
  | { channel: "pecal-editor"; type: "height"; payload: { height: number } }
  | { channel: "pecal-editor"; type: "update"; payload: { json: string; text: string } }
  | { channel: "pecal-editor"; type: "error"; payload: { message: string } };

function postToNative(message: BridgeOutbound) {
  const serialized = JSON.stringify(message);
  if (typeof window !== "undefined" && (window as any).ReactNativeWebView?.postMessage) {
    (window as any).ReactNativeWebView.postMessage(serialized);
  }
}

function parseContent(json?: string, text?: string) {
  if (json?.trim()) {
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // fall through
    }
  }

  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: text?.trim() ? [{ type: "text", text }] : [],
      },
    ],
  };
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

  Object.entries(palette).forEach(([key, value]) => root.style.setProperty(key, value));
}

function plainTextFromNode(node: any): string {
  if (!node) return "";
  if (node.type === "text") return String(node.text ?? "");
  const content = Array.isArray(node.content) ? node.content : [];

  if (node.type === "bulletList") {
    return content
      .map((item: any) => `- ${plainTextFromNode(item?.content?.[0])}`)
      .join("\n");
  }

  if (node.type === "orderedList") {
    return content
      .map((item: any, idx: number) => `${idx + 1}. ${plainTextFromNode(item?.content?.[0])}`)
      .join("\n");
  }

  if (node.type === "taskList") {
    return content
      .map((item: any) => `- [ ] ${plainTextFromNode(item?.content?.[0])}`)
      .join("\n");
  }

  if (node.type === "heading") {
    const level = Number(node?.attrs?.level ?? 1);
    const prefix = level === 1 ? "# " : level === 2 ? "## " : "### ";
    return prefix + content.map((child: any) => plainTextFromNode(child)).join("");
  }

  if (node.type === "blockquote") {
    return `> ${plainTextFromNode(content[0])}`;
  }

  if (node.type === "codeBlock") {
    return ["```", content.map((child: any) => plainTextFromNode(child)).join(""), "```"].join("\n");
  }

  return content.map((child: any) => plainTextFromNode(child)).join("");
}

export default function MobileEditorPage() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [content, setContent] = useState<Record<string, any>>({
    type: "doc",
    content: [{ type: "paragraph" }],
  });
  const [contentKey, setContentKey] = useState(0);
  const [readOnly, setReadOnly] = useState(false);
  const [placeholder, setPlaceholder] = useState("내용을 입력하세요.");
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  const handleInbound = useCallback((raw: unknown) => {
    try {
      const parsed = typeof raw === "string" ? (JSON.parse(raw) as BridgeInbound) : (raw as BridgeInbound);
      if (!parsed || (parsed as any).channel !== "pecal-editor") return;
      if ((parsed as any).type !== "set-content") return;

      const payload = (parsed as any).payload as
        | { json?: string; text?: string; readOnly?: boolean; placeholder?: string; theme?: "light" | "dark" }
        | undefined;
      if (!payload) return;
      setReadOnly(!!payload.readOnly);
      setPlaceholder(payload.placeholder?.trim() || "내용을 입력하세요.");
      if (payload.theme === "dark" || payload.theme === "light") {
        setTheme(payload.theme);
      }
      setContent(parseContent(payload.json, payload.text));
      setContentKey((prev) => prev + 1);
    } catch (error) {
      postToNative({
        channel: "pecal-editor",
        type: "error",
        payload: { message: error instanceof Error ? error.message : String(error) },
      });
    }
  }, []);

  useEffect(() => {
    const rootTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
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
    const onWindowMessage = (event: MessageEvent) => handleInbound(event.data);
    const onDocumentMessage = (event: Event) => {
      const data = (event as unknown as { data?: unknown }).data;
      handleInbound(data);
    };

    window.addEventListener("message", onWindowMessage);
    document.addEventListener("message", onDocumentMessage);
    postToNative({ channel: "pecal-editor", type: "ready" });

    return () => {
      window.removeEventListener("message", onWindowMessage);
      document.removeEventListener("message", onDocumentMessage);
    };
  }, [handleInbound]);

  useEffect(() => {
    if (!rootRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const height = Math.ceil(entries[0]?.contentRect?.height ?? 300);
      postToNative({ channel: "pecal-editor", type: "height", payload: { height } });
    });
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, []);

  const initialContent = useMemo(() => content, [content, contentKey]);

  if (!theme) return <div className="min-h-screen bg-transparent p-0" />;

  return (
    <div ref={rootRef} className="min-h-screen bg-transparent p-0">
      <RichTextEditor
        initialContent={initialContent}
        contentKey={contentKey}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(next) => {
          try {
            const text = plainTextFromNode(next).trim();
            postToNative({
              channel: "pecal-editor",
              type: "update",
              payload: { json: JSON.stringify(next), text },
            });
          } catch (error) {
            postToNative({
              channel: "pecal-editor",
              type: "error",
              payload: { message: error instanceof Error ? error.message : String(error) },
            });
          }
        }}
      />
    </div>
  );
}
