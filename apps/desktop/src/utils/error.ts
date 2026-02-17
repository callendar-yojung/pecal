export function getErrorMessage(error: unknown, fallback = '오류가 발생했습니다'): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  if (error && typeof error === 'object') {
    const maybeError = error as { message?: unknown; error?: unknown; status?: unknown }

    if (typeof maybeError.message === 'string' && maybeError.message.trim()) {
      return maybeError.message
    }

    if (typeof maybeError.error === 'string' && maybeError.error.trim()) {
      return maybeError.error
    }

    if (typeof maybeError.status === 'number') {
      return `API Error: ${maybeError.status}`
    }

    try {
      const serialized = JSON.stringify(error)
      if (serialized && serialized !== '{}') {
        return serialized
      }
    } catch {
      // ignore serialization error
    }
  }

  return fallback
}
