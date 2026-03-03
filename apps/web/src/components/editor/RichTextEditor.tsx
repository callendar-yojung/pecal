"use client";

import { Extension } from "@tiptap/core";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { lowlight } from "lowlight/lib/core";
import { useEffect, useRef, useState } from "react";
import { FontSize } from "./FontSize";
import { extractGoogleMapsEmbedSrc, GoogleMapsEmbed } from "./GoogleMapsEmbed";
import RichTextToolbar from "./RichTextToolbar";

const registerLanguages = () => {
  lowlight.registerLanguage("javascript", javascript);
  lowlight.registerLanguage("js", javascript);
  lowlight.registerLanguage("typescript", typescript);
  lowlight.registerLanguage("ts", typescript);
  lowlight.registerLanguage("python", python);
  lowlight.registerLanguage("py", python);
  lowlight.registerLanguage("go", go);
  lowlight.registerLanguage("golang", go);
  lowlight.registerLanguage("java", java);
  lowlight.registerLanguage("json", json);
  lowlight.registerLanguage("bash", bash);
  lowlight.registerLanguage("sh", bash);
  lowlight.registerLanguage("css", css);
  lowlight.registerLanguage("html", xml);
  lowlight.registerLanguage("xml", xml);
  lowlight.registerLanguage("markdown", markdown);
  lowlight.registerLanguage("md", markdown);
  lowlight.registerLanguage("sql", sql);
  lowlight.registerLanguage("yaml", yaml);
  lowlight.registerLanguage("yml", yaml);
};

registerLanguages();

const CodeBlockTab = Extension.create({
  name: "codeBlockTab",
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (!this.editor.isActive("codeBlock")) return false;
        this.editor.commands.insertContent("    ");
        return true;
      },
      "Shift-Tab": () => {
        if (!this.editor.isActive("codeBlock")) return false;
        const { state } = this.editor;
        const { from, to } = state.selection;
        if (from !== to) return false;
        const textBefore = state.doc.textBetween(from - 4, from, "\0", "\0");
        if (textBefore !== "    ") return false;
        this.editor.commands.deleteRange({ from: from - 4, to: from });
        return true;
      },
    };
  },
});

interface RichTextEditorProps {
  initialContent?: Record<string, unknown>;
  onChange?: (content: Record<string, unknown>) => void;
  contentKey?: string | number;
  readOnly?: boolean;
  showToolbar?: boolean;
  placeholder?: string;
}
function serializeDocument(
  content: Record<string, unknown> | null | undefined,
): string {
  try {
    return JSON.stringify(
      content ?? { type: "doc", content: [{ type: "paragraph" }] },
    );
  } catch {
    return "";
  }
}

export default function RichTextEditor({
  initialContent,
  onChange,
  contentKey,
  readOnly = false,
  showToolbar = true,
  placeholder = "내용을 입력하세요.",
}: RichTextEditorProps) {
  const lastAppliedDocRef = useRef<string>("");
  const [isEmpty, setIsEmpty] = useState(true);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      CodeBlockTab,
      Underline,
      TextStyle,
      Color,
      FontSize,
      Highlight,
      Link.configure({
        openOnClick: true,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer nofollow",
        },
      }),
      GoogleMapsEmbed,
      TaskList.configure({
        HTMLAttributes: {
          class: "editor-task-list",
          "data-type": "taskList",
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: "editor-task-item",
          "data-type": "taskItem",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: initialContent ?? {
      type: "doc",
      content: [{ type: "paragraph" }],
    },
    editable: !readOnly,
    editorProps: {
      attributes: {
        class:
          "min-h-[300px] w-full bg-transparent px-4 py-3 text-sm text-foreground focus:outline-none",
      },
      handlePaste: (view, event) => {
        const clipboardText = event.clipboardData?.getData("text/plain") ?? "";
        const src = extractGoogleMapsEmbedSrc(clipboardText);
        if (!src) return false;
        event.preventDefault();
        const nodeType = view.state.schema.nodes.googleMapsEmbed;
        if (!nodeType) return false;
        const node = nodeType.create({ src });
        const tr = view.state.tr.replaceSelectionWith(node);
        view.dispatch(tr.scrollIntoView());
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      setIsEmpty(editor.isEmpty);
      const nextContent = editor.getJSON() as Record<string, unknown>;
      lastAppliedDocRef.current = serializeDocument(nextContent);
      onChange?.(nextContent);
    },
    onCreate: ({ editor }) => {
      const initial = editor.getJSON() as Record<string, unknown>;
      lastAppliedDocRef.current = serializeDocument(initial);
      setIsEmpty(editor.isEmpty);
    },
  });

  useEffect(() => {
    if (!editor || !initialContent) return;
    const nextSerialized = serializeDocument(initialContent);
    if (!nextSerialized || nextSerialized === lastAppliedDocRef.current) return;
    editor.commands.setContent(initialContent, false);
    lastAppliedDocRef.current = nextSerialized;
    setIsEmpty(editor.isEmpty);
  }, [editor, initialContent]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {showToolbar && <RichTextToolbar editor={editor} />}
      <div className="relative">
        {!readOnly && isEmpty ? (
          <div className="pointer-events-none absolute left-4 top-3 z-[1] text-sm text-muted-foreground/70">
            {placeholder}
          </div>
        ) : null}
        <EditorContent editor={editor} key={contentKey} />
      </div>
    </div>
  );
}
