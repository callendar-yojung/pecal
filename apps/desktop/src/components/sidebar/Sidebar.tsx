import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ModeSelector } from './ModeSelector'
import { WorkspaceList } from './WorkspaceList'
import { TaskMenu } from './TaskMenu'
import { FileMenu } from './FileMenu'
import { notificationsApi } from '../../api'
import { useAuthStore, useModalStore, useViewStore, useWorkspaceStore } from '../../stores'

function SidebarFooter() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { openSettingsModal, openNotificationsModal, openedModal } = useModalStore()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return
    let mounted = true

    const fetchUnread = async () => {
      try {
        const response = await notificationsApi.getUnreadCount()
        if (mounted) {
          setUnreadCount(Number(response.count || 0))
        }
      } catch (err) {
        console.error('Failed to fetch unread notifications:', err)
      }
    }

    fetchUnread()
    const intervalId = window.setInterval(fetchUnread, 30000)
    return () => {
      mounted = false
      window.clearInterval(intervalId)
    }
  }, [user, openedModal])

  if (!user) return null

  return (
    <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium shrink-0">
          {user.nickname?.charAt(0) || 'U'}
        </div>
        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
          {user.nickname}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={openNotificationsModal}
          className="relative p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title={t('notification.title')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0h6z"
            />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={openSettingsModal}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title={t('settings.title')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function SidebarNav() {
  const { t } = useTranslation()
  const { activeView, setView } = useViewStore()
  const { user } = useAuthStore()
  const { currentMode, selectedTeamId, teams } = useWorkspaceStore()
  const selectedTeam = selectedTeamId
    ? teams.find((team) => team.id === selectedTeamId) ?? null
    : null
  const isTeamAdmin = Boolean(
    user &&
    currentMode === 'TEAM' &&
    selectedTeam &&
    Number(selectedTeam.created_by) === Number(user.memberId)
  )

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2 mb-1">
        {t('sidebar.menu')}
      </h3>
      <button
        onClick={() => setView('overview')}
        className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
          activeView === 'overview'
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
        {t('sidebar.overview')}
      </button>
      {/* Calendar */}
      <button
        onClick={() => setView('calendar')}
        className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
          activeView === 'calendar'
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {t('sidebar.calendar')}
      </button>
      <TaskMenu />
      <FileMenu />
      <button
        onClick={() => setView('memo')}
        className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
          activeView === 'memo'
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12h6m-6 4h6M7 4h8l4 4v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
        </svg>
        {t('sidebar.memo')}
      </button>
      {isTeamAdmin && (
        <button
          onClick={() => setView('team_manage')}
          className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
            activeView === 'team_manage'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a4 4 0 00-5-3.87M17 20H7m10 0v-2c0-.65-.08-1.29-.24-1.89M7 20H2v-2a4 4 0 015-3.87M7 20v-2c0-.65.08-1.29.24-1.89m0 0a5 5 0 019.52 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          {t('sidebar.teamManage')}
        </button>
      )}
    </div>
  )
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true'
  })

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar_collapsed', String(next))
  }

  return (
    <div className="relative flex-shrink-0 flex">
      <aside
        className={`h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          collapsed ? 'w-0 border-r-0' : 'w-64'
        }`}
      >
        <div className="w-64 min-w-[256px] flex flex-col h-full">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Pecal
            </h1>
            <ModeSelector />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <WorkspaceList />
            <SidebarNav />
          </div>

          <SidebarFooter />
        </div>
      </aside>

      {/* 접기/펼기 토글 버튼 */}
      <button
        onClick={toggleCollapsed}
        className="absolute -right-3.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
        title={collapsed ? '사이드바 열기' : '사이드바 접기'}
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </div>
  )
}
