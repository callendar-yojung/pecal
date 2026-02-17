"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { lowlight } from "lowlight/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import markdown from "highlight.js/lib/languages/markdown";
import sql from "highlight.js/lib/languages/sql";
import yaml from "highlight.js/lib/languages/yaml";
import { Extension } from "@tiptap/core";
import RichTextToolbar from "./RichTextToolbar";
import { FontSize } from "./FontSize";

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
  initialContent?: Record<string, any>;
  onChange?: (content: Record<string, any>) => void;
  contentKey?: string | number;
  readOnly?: boolean;
  showToolbar?: boolean;
}

export default function RichTextEditor({
  initialContent,
  onChange,
  contentKey,
  readOnly = false,
  showToolbar = true,
}: RichTextEditorProps) {
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
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: initialContent ?? { type: "doc", content: [{ type: "paragraph" }] },
    editable: !readOnly,
    editorProps: {
      attributes: {
        class:
          "min-h-[300px] w-full bg-transparent px-4 py-3 text-sm text-foreground focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON());
    },
  });

  useEffect(() => {
    if (!editor || !initialContent) return;
    editor.commands.setContent(initialContent, false);
  }, [editor, contentKey]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {showToolbar && <RichTextToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
