export type RichTextNode = {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
  content?: RichTextNode[];
  text?: string;
};

export type RichTextDoc = {
  type: "doc";
  content: RichTextNode[];
};

export function createEmptyRichTextDoc(): RichTextDoc {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

export function serializeRichTextDoc(
  value: RichTextDoc | Record<string, unknown> | null | undefined,
): string {
  try {
    return JSON.stringify(value ?? createEmptyRichTextDoc());
  } catch {
    return JSON.stringify(createEmptyRichTextDoc());
  }
}

export function parseRichTextDoc(
  value: string | Record<string, unknown> | null | undefined,
): RichTextDoc {
  if (!value) return createEmptyRichTextDoc();

  try {
    const parsed =
      typeof value === "string"
        ? (JSON.parse(value) as Record<string, unknown>)
        : value;

    if (parsed?.type === "doc" && Array.isArray(parsed.content)) {
      return parsed as RichTextDoc;
    }
  } catch {
    return createEmptyRichTextDoc();
  }

  return createEmptyRichTextDoc();
}

export function normalizeRichTextJson(
  value: string | Record<string, unknown> | null | undefined,
): string {
  return serializeRichTextDoc(parseRichTextDoc(value));
}
