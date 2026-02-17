import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../stores'

export function UserProfile() {
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()

  if (!user) return null

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium shrink-0">
          {user.nickname?.charAt(0) || 'U'}
        </div>
        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
          {user.nickname}
        </span>
      </div>
      <button
        onClick={logout}
        className="p-2 text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors shrink-0"
        title={t('auth.logout')}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
      </button>
    </div>
  )
}