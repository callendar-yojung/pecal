export type RichContent = Record<string, unknown>

export const EMPTY_RICH_CONTENT: RichContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

function isDocShape(value: unknown): value is RichContent {
  return Boolean(value && typeof value === 'object' && (value as { type?: unknown }).type === 'doc')
}

export function parseRichContent(raw?: string | null): RichContent {
  if (!raw) return EMPTY_RICH_CONTENT

  try {
    const parsed = JSON.parse(raw) as unknown
    if (isDocShape(parsed)) return parsed
  } catch {
    // plain text fallback
  }

  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: raw }] }],
  }
}

function hasTextNode(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false
  const n = node as { type?: unknown; text?: unknown; content?: unknown[] }
  if (n.type === 'text' && typeof n.text === 'string' && n.text.trim().length > 0) return true
  if (!Array.isArray(n.content)) return false
  return n.content.some((child) => hasTextNode(child))
}

export function isRichContentEmpty(content: RichContent): boolean {
  return !hasTextNode(content)
}

export function serializeRichContent(content: RichContent): string {
  if (isRichContentEmpty(content)) return ''
  return JSON.stringify(content)
}
