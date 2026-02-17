import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'pink'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (theme) => {
        set({ theme })
        updateDocumentClass(theme)
      },
      toggleTheme: () => {
        const themeOrder: Theme[] = ['light', 'dark', 'pink']
        const current = get().theme
        const currentIndex = themeOrder.indexOf(current)
        const newTheme = themeOrder[(currentIndex + 1) % themeOrder.length]
        set({ theme: newTheme })
        updateDocumentClass(newTheme)
      },
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        if (state) {
          updateDocumentClass(state.theme)
        }
      },
    }
  )
)

function updateDocumentClass(theme: Theme) {
  document.documentElement.classList.remove('dark', 'pink')
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  }
  if (theme === 'pink') {
    document.documentElement.classList.add('pink')
  }
}