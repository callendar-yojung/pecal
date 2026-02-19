import { useTranslation } from 'react-i18next'
import { useViewStore } from '../../stores'

export function TaskMenu() {
  const { t } = useTranslation()
  const { activeView, setView } = useViewStore()
  const isActive = activeView === 'tasks'

  return (
    <button
      onClick={() => setView(isActive ? 'calendar' : 'tasks')}
      className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm transition-colors ${
        isActive
          ? 'bg-white/75 dark:bg-gray-800/70 text-gray-900 dark:text-gray-100 ring-1 ring-black/5 dark:ring-white/10 shadow-sm font-medium'
          : 'text-gray-600 dark:text-gray-400 hover:bg-white/65 dark:hover:bg-gray-800/45 hover:text-gray-900 dark:hover:text-gray-200'
      }`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
      {t('sidebar.tasks')}
    </button>
  )
}
