import type { RichTextDoc, RichTextNode } from "./rich-text";
import { createEmptyRichTextDoc, parseRichTextDoc } from "./rich-text";

function inlineText(nodes?: RichTextNode[]): string {
  if (!Array.isArray(nodes)) return "";
  return nodes
    .map((node) => {
      if (!node) return "";
      if (node.type === "text") return node.text ?? "";
      return inlineText(node.content);
    })
    .join("");
}

export function isRichTextDocLike(
  value: string | Record<string, unknown> | null | undefined,
): boolean {
  if (!value) return false;
  try {
    const parsed =
      typeof value === "string"
        ? (JSON.parse(value) as Record<string, unknown>)
        : value;
    return parsed?.type === "doc" && Array.isArray(parsed.content);
  } catch {
    return false;
  }
}

function paragraph(value?: string): RichTextNode {
  return {
    type: "paragraph",
    content: value ? [{ type: "text", text: value }] : [],
  };
}

export function richTextDocToPlainText(
  doc: RichTextDoc | Record<string, unknown> | null | undefined,
  fallbackText = "",
): string {
  try {
    const parsed = (doc ?? createEmptyRichTextDoc()) as RichTextDoc;
    const blocks = Array.isArray(parsed.content) ? parsed.content : [];
    const text = blocks
      .map((block) => {
        if (!block || typeof block !== "object") return "";
        if (block.type === "paragraph") return inlineText(block.content);
        if (block.type === "heading") {
          const level = Number(block.attrs?.level ?? 1);
          const prefix = level === 1 ? "# " : level === 2 ? "## " : "### ";
          return prefix + inlineText(block.content);
        }
        if (block.type === "blockquote") {
          return "> " + inlineText(block.content?.[0]?.content);
        }
        if (block.type === "bulletList") {
          const items = Array.isArray(block.content) ? block.content : [];
          return items
            .map((item) => "- " + inlineText(item?.content?.[0]?.content))
            .join("\n");
        }
        if (block.type === "orderedList") {
          const items = Array.isArray(block.content) ? block.content : [];
          return items
            .map(
              (item, index) =>
                `${index + 1}. ${inlineText(item?.content?.[0]?.content)}`,
            )
            .join("\n");
        }
        if (block.type === "taskList") {
          const items = Array.isArray(block.content) ? block.content : [];
          return items
            .map((item) => {
              const checked = item?.attrs?.checked === true ? "x" : " ";
              return `- [${checked}] ${inlineText(item?.content?.[0]?.content)}`;
            })
            .join("\n");
        }
        if (block.type === "codeBlock") {
          const code = inlineText(block.content);
          return `\`\`\`\n${code}\n\`\`\``;
        }
        return inlineText(block.content);
      })
      .join("\n")
      .trim();

    return text || fallbackText;
  } catch {
    return fallbackText;
  }
}

export function richTextDocToPreviewText(
  value: string | Record<string, unknown> | null | undefined,
  fallbackText = "",
): string {
  try {
    const text = richTextDocToPlainText(parseRichTextDoc(value), fallbackText)
      .replace(/\s+/g, " ")
      .trim();
    return text || fallbackText;
  } catch {
    return fallbackText;
  }
}

export function plainTextToRichTextDoc(text: string): RichTextDoc {
  const lines = (text || "").split("\n");
  const content: RichTextNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] || "";

    if (!line.trim()) {
      content.push({ type: "paragraph" });
      index += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      content.push({
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: line.slice(4) }],
      });
      index += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      content.push({
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: line.slice(3) }],
      });
      index += 1;
      continue;
    }
    if (line.startsWith("# ")) {
      content.push({
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: line.slice(2) }],
      });
      index += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      content.push({ type: "blockquote", content: [paragraph(line.slice(2))] });
      index += 1;
      continue;
    }

    if (/^- \[[ xX]\] /.test(line)) {
      const items: RichTextNode[] = [];
      while (index < lines.length && /^- \[[ xX]\] /.test(lines[index] || "")) {
        const current = lines[index] || "";
        items.push({
          type: "taskItem",
          attrs: { checked: /^- \[[xX]\] /.test(current) },
          content: [paragraph(current.replace(/^- \[[ xX]\] /, ""))],
        });
        index += 1;
      }
      content.push({ type: "taskList", content: items });
      continue;
    }

    if (/^[-*] /.test(line)) {
      const items: RichTextNode[] = [];
      while (index < lines.length && /^[-*] /.test(lines[index] || "")) {
        items.push({
          type: "listItem",
          content: [paragraph((lines[index] || "").replace(/^[-*] /, ""))],
        });
        index += 1;
      }
      content.push({ type: "bulletList", content: items });
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const items: RichTextNode[] = [];
      while (index < lines.length && /^\d+\. /.test(lines[index] || "")) {
        items.push({
          type: "listItem",
          content: [paragraph((lines[index] || "").replace(/^\d+\. /, ""))],
        });
        index += 1;
      }
      content.push({ type: "orderedList", content: items });
      continue;
    }

    content.push(paragraph(line));
    index += 1;
  }

  return {
    type: "doc",
    content: content.length ? content : createEmptyRichTextDoc().content,
  };
}
