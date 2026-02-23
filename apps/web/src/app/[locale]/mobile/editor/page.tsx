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

  const handleInbound = useCallback((raw: unknown) => {
    try {
      const parsed = typeof raw === "string" ? (JSON.parse(raw) as BridgeInbound) : (raw as BridgeInbound);
      if (!parsed || (parsed as any).channel !== "pecal-editor") return;
      if ((parsed as any).type !== "set-content") return;

      const payload = (parsed as any).payload as
        | { json?: string; text?: string; readOnly?: boolean; placeholder?: string }
        | undefined;
      if (!payload) return;
      setReadOnly(!!payload.readOnly);
      setPlaceholder(payload.placeholder?.trim() || "내용을 입력하세요.");
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
