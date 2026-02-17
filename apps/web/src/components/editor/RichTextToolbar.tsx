"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  SquareCode,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Undo,
  Redo,
  Trash2,
  ChevronDown,
} from "lucide-react";

const FONT_SIZES = [
  "12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "40px",
];

interface RichTextToolbarProps {
  editor: Editor | null;
}

export default function RichTextToolbar({ editor }: RichTextToolbarProps) {
  if (!editor) return null;

  const currentFontSize =
      (editor.getAttributes("textStyle")?.fontSize as string | undefined) || "16px";

  const preventBlur = (event: React.MouseEvent) => {
    event.preventDefault();
  };

  const ToolbarButton = ({
                           onClick,
                           isActive = false,
                           children,
                           label,
                         }: {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    label?: string;
  }) => (
      <button
          type="button"
          onMouseDown={preventBlur}
          onClick={onClick}
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-all ${
              isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          title={label}
      >
        {children}
      </button>
  );

  const Separator = () => <div className="mx-1 h-6 w-[1px] bg-border" />;

  return (
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex flex-nowrap items-center gap-1 overflow-x-auto p-1.5 no-scrollbar">

          {/* Undo / Redo */}
          <div className="flex items-center">
            <ToolbarButton onClick={() => editor.chain().focus().undo().run()} label="Undo">
              <Undo className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().redo().run()} label="Redo">
              <Redo className="h-4 w-4" />
            </ToolbarButton>
          </div>

          <Separator />

          {/* Headings & Font Size */}
          <div className="flex items-center gap-2 px-1">
            <div className="relative flex items-center">
              <select
                  value={
                    editor.isActive("heading", { level: 1 }) ? "h1" :
                        editor.isActive("heading", { level: 2 }) ? "h2" :
                            editor.isActive("heading", { level: 3 }) ? "h3" : "paragraph"
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "paragraph") editor.chain().focus().setParagraph().run();
                    else {
                      const level = Number(val.replace("h", "")) as 1 | 2 | 3;
                      editor.chain().focus().toggleHeading({ level }).run();
                    }
                  }}
                  className="h-8 w-24 appearance-none rounded-md border border-input bg-background pl-2 pr-8 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              >
                <option value="paragraph">본문</option>
                <option value="h1">제목 1</option>
                <option value="h2">제목 2</option>
                <option value="h3">제목 3</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-muted-foreground" />
            </div>

            <div className="relative flex items-center">
              <select
                  value={currentFontSize}
                  onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
                  className="h-8 w-20 appearance-none rounded-md border border-input bg-background pl-2 pr-8 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              >
                {FONT_SIZES.map((size) => (
                    <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-muted-foreground" />
            </div>
          </div>

          <Separator />

          {/* Basic Formatting */}
          <div className="flex items-center">
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive("bold")}
                label="Bold"
            >
              <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive("italic")}
                label="Italic"
            >
              <Italic className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                isActive={editor.isActive("underline")}
                label="Underline"
            >
              <Underline className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleStrike().run()}
                isActive={editor.isActive("strike")}
                label="Strike"
            >
              <Strikethrough className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                isActive={editor.isActive("highlight")}
                label="Highlight"
            >
              <Highlighter className="h-4 w-4" />
            </ToolbarButton>

            <div className="ml-1 flex items-center" title="Text Color">
              <input
                  type="color"
                  value={editor.getAttributes("textStyle")?.color || "#111827"}
                  onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                  className="h-6 w-6 cursor-pointer overflow-hidden rounded-full border border-border p-0 bg-transparent"
              />
            </div>
          </div>

          <Separator />

          {/* Lists & Tasks */}
          <div className="flex items-center">
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive("bulletList")}
                label="Bullet List"
            >
              <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive("orderedList")}
                label="Ordered List"
            >
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                isActive={editor.isActive("taskList")}
                label="Task List"
            >
              <CheckSquare className="h-4 w-4" />
            </ToolbarButton>
          </div>

          <Separator />

          {/* Alignment */}
          <div className="flex items-center">
            <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign("left").run()}
                isActive={editor.isActive({ textAlign: "left" })}
                label="Align Left"
            >
              <AlignLeft className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign("center").run()}
                isActive={editor.isActive({ textAlign: "center" })}
                label="Align Center"
            >
              <AlignCenter className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign("right").run()}
                isActive={editor.isActive({ textAlign: "right" })}
                label="Align Right"
            >
              <AlignRight className="h-4 w-4" />
            </ToolbarButton>
          </div>

          <Separator />

          {/* Block Elements */}
          <div className="flex items-center">
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={editor.isActive("blockquote")}
                label="Blockquote"
            >
              <Quote className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleCode().run()}
                isActive={editor.isActive("code")}
                label="Inline Code"
            >
              <Code className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                isActive={editor.isActive("codeBlock")}
                label="Code Block"
            >
              <SquareCode className="h-4 w-4" />
            </ToolbarButton>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex items-center">
            <ToolbarButton
                onClick={() => {
                  const previousUrl = editor.getAttributes("link").href;
                  const url = window.prompt("URL", previousUrl || "");
                  if (url === null) return;
                  if (url === "") {
                    editor.chain().focus().unsetLink().run();
                    return;
                  }
                  editor.chain().focus().setLink({ href: url }).run();
                }}
                isActive={editor.isActive("link")}
                label="Add Link"
            >
              <LinkIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                label="Clear Formatting"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </ToolbarButton>
          </div>
        </div>

        <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      </div>
  );
}
