export async function openExternal(url: string) {
  try {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(url)
  } catch (error) {
    console.error('Failed to open external url via tauri shell:', error)
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
