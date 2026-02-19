import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useWorkspaceStore, useModalStore } from '../../stores'

export function ModeSelector() {
  const { t } = useTranslation()
  const {
    currentMode,
    selectedTeamId,
    teams,
    setMode,
    moveTeam,
    isDropdownOpen,
    toggleDropdown,
    closeDropdown,
  } = useWorkspaceStore()

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        closeDropdown()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [closeDropdown])

  // 현재 선택된 팀 정보
  const currentTeam = selectedTeamId
      ? teams.find((t) => t.id === selectedTeamId)
      : null

  // 모드 표시 텍스트
  const getModeLabel = () => {
    if (currentMode === 'PERSONAL') {
      return t('mode.personal')
    }
    return currentTeam?.name || t('mode.team')
  }

  return (
      <div className="relative" ref={dropdownRef}>
        {/* 현재 모드 버튼 */}
        <button
            onClick={toggleDropdown}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200/80 dark:border-gray-700/80 px-3 py-2.5 bg-white/75 dark:bg-gray-800/65 hover:bg-white/90 dark:hover:bg-gray-800/80 transition-colors backdrop-blur"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
                className={`h-9 w-9 rounded-lg flex items-center justify-center text-white font-semibold ${
                    currentMode === 'PERSONAL'
                        ? 'bg-gray-500'
                        : 'bg-gray-700'
                }`}
            >
              {currentMode === 'PERSONAL' ? 'P' : 'T'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                {getModeLabel()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {currentMode === 'PERSONAL'
                    ? t('mode.personalWorkspace')
                    : t('mode.teamWorkspace')}
              </p>
            </div>
          </div>
          <span className={`transition text-gray-400 ${isDropdownOpen ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>

        {/* 드롭다운 메뉴 */}
        {isDropdownOpen && (
            <div className="absolute z-50 mt-2 w-full rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-white/90 dark:bg-gray-800/90 shadow-xl backdrop-blur">
              {/* 개인 모드 */}
              <div className="p-2">
                <p className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  {t('mode.personal')}
                </p>
                <button
                    onClick={() => {
                      setMode('PERSONAL')
                      closeDropdown()
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors ${
                        currentMode === 'PERSONAL'
                            ? 'bg-white/80 dark:bg-gray-700/70 text-gray-900 dark:text-gray-100 ring-1 ring-black/5 dark:ring-white/10'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-white/65 dark:hover:bg-gray-700/55'
                    }`}
                >
                  <div className="h-6 w-6 rounded bg-gray-500 flex items-center justify-center text-white text-xs font-semibold">
                    P
                  </div>
                  <span className="text-sm">{t('mode.personal')}</span>
                </button>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700" />

              {/* 팀 모드 */}
              <div className="p-2">
                <p className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  {t('mode.team')}
                </p>
                {teams.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">
                      {t('mode.noTeams')}
                    </p>
                ) : (
                    teams.map((team, index) => (
                      <div
                        key={team.id}
                        className={`group w-full flex items-center gap-1 rounded-lg transition-colors ${
                          currentMode === 'TEAM' && selectedTeamId === team.id
                            ? 'bg-white/80 dark:bg-gray-700/70 text-gray-900 dark:text-gray-100 ring-1 ring-black/5 dark:ring-white/10'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-white/65 dark:hover:bg-gray-700/55'
                        }`}
                      >
                        <button
                          onClick={() => {
                            setMode('TEAM', team.id)
                            closeDropdown()
                          }}
                          className="flex-1 flex items-center gap-2 px-3 py-2 text-left rounded-lg"
                        >
                          <div className="h-6 w-6 rounded bg-gray-700 flex items-center justify-center text-white text-xs font-semibold">
                            T
                          </div>
                          <span className="text-sm truncate">{team.name}</span>
                        </button>
                        <div className="pr-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              moveTeam(team.id, 'up')
                            }}
                            disabled={index === 0}
                            className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={t('mode.moveTeamUp')}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              moveTeam(team.id, 'down')
                            }}
                            disabled={index === teams.length - 1}
                            className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={t('mode.moveTeamDown')}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700" />

              {/* 팀 생성 버튼 */}
              <button
                  onClick={() => {
                    closeDropdown()
                    useModalStore.getState().openTeamCreateModal()
                  }}
                  className="w-full px-5 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-white/65 dark:hover:bg-gray-700/50 transition-colors"
              >
                + {t('mode.createTeam')}
              </button>
            </div>
        )}
      </div>
  )
}
