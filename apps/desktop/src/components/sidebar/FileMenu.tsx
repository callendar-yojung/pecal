import { useTranslation } from 'react-i18next'
import { useViewStore } from '../../stores'

export function FileMenu() {
  const { t } = useTranslation()
  const { activeView, setView } = useViewStore()
  const isActive = activeView === 'files'

  return (
    <button
      onClick={() => setView(isActive ? 'calendar' : 'files')}
      className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
        isActive
          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
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
