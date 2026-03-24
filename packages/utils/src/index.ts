export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export * from "./rich-text";
export * from "./rich-text-plain";
export * from "./rich-text-toolbar";
export * from "./korean-special-days";
