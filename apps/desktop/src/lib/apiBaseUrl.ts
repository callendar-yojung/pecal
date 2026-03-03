export function resolveApiBaseUrl(rawValue: string | undefined, fallback: string): string {
  const normalizedFallback = fallback.replace(/\/$/, '')

  if (!rawValue) {
    return normalizedFallback
  }

  const trimmed = rawValue.trim()
  if (!trimmed) {
    return normalizedFallback
  }

  try {
    const url = new URL(trimmed)
    if (/trabien\.com$/i.test(url.hostname)) {
      return 'https://pecal.site'
    }
    return trimmed.replace(/\/$/, '')
  } catch {
    return normalizedFallback
  }
}

