import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

export function TitleBar() {
  const [isDesktopMode, setIsDesktopMode] = useState(false)
  const [showSlider, setShowSlider] = useState(false)
  const [opacity, setOpacity] = useState(100)
  const sliderRef = useRef<HTMLDivElement>(null)
  const appWindow = getCurrentWindow()

  useEffect(() => {
    invoke<boolean>('is_desktop_mode').then(setIsDesktopMode).catch(console.error)

    invoke<number>('get_window_opacity')
      .then((saved) => {
        setOpacity(saved)
        invoke('set_window_opacity', { opacity: saved / 100 })
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (!showSlider) return

    const handleOutsidePointerDown = (e: PointerEvent) => {
      if (sliderRef.current && !sliderRef.current.contains(e.target as Node)) {
        setShowSlider(false)
      }
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown, true)
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown, true)
  }, [showSlider])

  const handleOpacityChange = (value: number) => {
    setOpacity(value)
    invoke('set_window_opacity', { opacity: value / 100 }).catch(console.error)
    invoke('save_window_opacity', { opacity: value }).catch(console.error)
  }

  const handleToggleDesktopMode = async () => {
    try {
      const next = await invoke<boolean>('toggle_desktop_mode')
      setIsDesktopMode(next)
    } catch (err) {
      console.error('Failed to toggle desktop mode:', err)
    }
  }

  const handleStartDrag = () => {
    appWindow.startDragging().catch((err) => {
      console.error('Failed to start dragging:', err)
    })
  }

  return (
    <div className="h-8 bg-white/90 dark:bg-gray-800/90 flex items-center justify-between px-2 select-none border-b border-gray-200 dark:border-gray-700">
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 cursor-move"
      >
        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span data-tauri-drag-region>Pecal</span>
      </div>

      <div className="flex items-center gap-0.5">
        <div className="relative flex items-center" ref={sliderRef}>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setShowSlider((prev) => !prev)}
            className={`p-1.5 rounded transition-colors ${
              showSlider
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={`투명도 ${opacity}%`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 3a9 9 0 010 18" fill="currentColor" />
            </svg>
          </button>

          {showSlider && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute top-full right-0 mt-1 z-50 bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 flex items-center gap-2 w-44"
            >
              <svg className="w-3 h-3 text-gray-400 shrink-0 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2" />
              </svg>
              <input
                type="range"
                min={35}
                max={100}
                value={opacity}
                onChange={(e) => handleOpacityChange(Number(e.target.value))}
                className="flex-1 h-1 cursor-pointer accent-blue-500"
              />
              <svg className="w-3 h-3 text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
            </div>
          )}
        </div>

        <button
          onPointerDown={(e) => {
            e.stopPropagation()
            handleStartDrag()
          }}
          className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="이동"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3l4 4H8v3H6V7H3l4-4zm10 0l4 4h-3v3h-2V7h-3l4-4M7 21l4-4H8v-3H6v3H3l4 4m10 0l4-4h-3v-3h-2v3h-3l4 4" />
          </svg>
        </button>

        <button
          onClick={handleToggleDesktopMode}
          className={`p-1.5 rounded transition-colors ${
            isDesktopMode
              ? 'bg-blue-500 text-white'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title={isDesktopMode ? '일반 창 모드로 전환' : '바탕화면 고정 모드'}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </button>

        <button
          onClick={() => appWindow.minimize()}
          className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="최소화"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        <button
          onClick={() => appWindow.close()}
          className="p-1.5 text-gray-500 hover:bg-red-500 hover:text-white rounded transition-colors"
          title="닫기"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
