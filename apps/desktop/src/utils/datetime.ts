export function normalizeApiDateTime(value: string): string {
  const raw = String(value || '').trim()
  if (!raw) return raw
  if (raw.includes('T')) return raw
  if (raw.includes(' ')) return raw.replace(' ', 'T')
  return raw
}

export function parseApiDateTime(value: string): Date {
  const normalized = normalizeApiDateTime(value)
  const parsed = new Date(normalized)
  if (!Number.isNaN(parsed.getTime())) return parsed

  const fallback = new Date(value)
  if (!Number.isNaN(fallback.getTime())) return fallback

  return new Date(0)
}

