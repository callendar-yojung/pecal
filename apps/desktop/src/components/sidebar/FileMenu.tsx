import { useTranslation } from 'react-i18next'
import { useViewStore } from '../../stores'

export function FileMenu() {
  const { t } = useTranslation()
  const { activeView, setView } = useViewStore()
  const isActive = activeView === 'files'

  return (
    <button
      onClick={() => setView(isActive ? 'calendar' : 'files')}
      className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm transition-colors ${
        isActive
          ? 'bg-white/75 dark:bg-gray-800/70 text-gray-900 dark:text-gray-100 ring-1 ring-black/5 dark:ring-white/10 shadow-sm font-medium'
          : 'text-gray-600 dark:text-gray-400 hover:bg-white/65 dark:hover:bg-gray-800/45 hover:text-gray-900 dark:hover:text-gray-200'
      }`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
      {t('sidebar.files')}
    </button>
  )
}
