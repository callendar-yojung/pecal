export const RICH_TEXT_FONT_SIZES = [
  "12px",
  "14px",
  "16px",
  "18px",
  "20px",
  "24px",
  "28px",
  "32px",
  "40px",
] as const;

export const RICH_TEXT_HEADING_OPTIONS = [
  { value: "paragraph", labelKo: "본문", labelEn: "Paragraph" },
  { value: "h1", labelKo: "제목 1", labelEn: "Heading 1" },
  { value: "h2", labelKo: "제목 2", labelEn: "Heading 2" },
  { value: "h3", labelKo: "제목 3", labelEn: "Heading 3" },
] as const;

export const RICH_TEXT_TOOLBAR_ACTIONS = {
  history: ["undo", "redo"],
  inline: ["bold", "italic", "underline", "strike", "highlight"],
  lists: ["ul", "ol", "task"],
  align: ["left", "center", "right"],
  blocks: ["quote", "code", "codeblock", "link", "clear"],
} as const;

export type RichTextToolbarAction =
  | (typeof RICH_TEXT_TOOLBAR_ACTIONS.history)[number]
  | (typeof RICH_TEXT_TOOLBAR_ACTIONS.inline)[number]
  | (typeof RICH_TEXT_TOOLBAR_ACTIONS.lists)[number]
  | (typeof RICH_TEXT_TOOLBAR_ACTIONS.align)[number]
  | (typeof RICH_TEXT_TOOLBAR_ACTIONS.blocks)[number];
