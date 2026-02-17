import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ask } from '@tauri-apps/plugin-dialog'
import { useWorkspaceStore, useAuthStore } from '../../stores'
import { workspaceApi } from '../../api'

export function WorkspaceList() {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const {
    currentMode,
    selectedTeamId,
    workspaces,
    selectedWorkspaceId,
    selectWorkspace,
    addWorkspace,
    updateWorkspaceInStore,
    removeWorkspace,
    moveWorkspace,
    isLoading,
  } = useWorkspaceStore()

  const [isAdding, setIsAdding] = useState(false)
  const [name, setName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  const handleSelectWorkspace = async (workspaceId: number) => {
    selectWorkspace(workspaceId)
  }

  /** 워크스페이스 생성 */
  const createWorkspace = async () => {
    if (!name.trim() || isCreating) return

    // TEAM인데 팀 선택 안 됐으면 컷
    if (currentMode === 'TEAM' && !selectedTeamId) {
      alert('팀을 먼저 선택하세요')
      return
    }

    // 로그인 체크
    if (!user) {
      alert('로그인이 필요합니다')
      return
    }

    setIsCreating(true)
    try {
      const response = await workspaceApi.createWorkspace({
        name: name.trim(),
        type: currentMode === 'PERSONAL' ? 'personal' : 'team',
        owner_id:
            currentMode === 'PERSONAL'
                ? user.memberId   // 👈 개인 = memberId (useAuthStore에서 가져옴)
                : selectedTeamId!,           // 👈 팀 = teamId
      })

      if (response.workspace) {
        addWorkspace(response.workspace)
        await handleSelectWorkspace(response.workspace.workspace_id)
      }

      setName('')
      setIsAdding(false)
    } catch (e) {
      console.error('Failed to create workspace:', e)
      alert(e instanceof Error ? e.message : (t('workspace.createError') || '워크스페이스 생성에 실패했습니다'))
    } finally {
      setIsCreating(false)
    }
  }

  /** 워크스페이스 삭제 */
  const deleteWorkspace = async (workspaceId: number, workspaceName: string) => {
    if (deletingId) return // 이미 삭제 중이면 무시

    // Tauri dialog를 사용한 확인 메시지
    const confirmed = await ask(
      `${t('workspace.deleteConfirmMessage')}\n\n"${workspaceName}"`,
      {
        title: t('workspace.deleteConfirm'),
        okLabel: t('workspace.delete'),
        cancelLabel: t('event.cancel'),
      }
    )

    if (!confirmed) return

    setDeletingId(workspaceId)
    try {
      await workspaceApi.deleteWorkspace(workspaceId)
      removeWorkspace(workspaceId)
    } catch (e) {
      console.error('Failed to delete workspace:', e)
      alert(t('workspace.deleteError') || '워크스페이스 삭제에 실패했습니다')
    } finally {
      setDeletingId(null)
    }
  }

  /** 워크스페이스 이름 수정 */
  const startEditing = (workspaceId: number, currentName: string) => {
    setEditingId(workspaceId)
    setEditName(currentName)
  }

  const submitRename = async () => {
    if (!editingId || !editName.trim()) {
      setEditingId(null)
      return
    }
    try {
      await workspaceApi.updateWorkspace(editingId, editName.trim())
      updateWorkspaceInStore(editingId, editName.trim())
    } catch (e) {
      console.error('Failed to rename workspace:', e)
    } finally {
      setEditingId(null)
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      submitRename()
    } else if (e.key === 'Escape') {
      setEditingId(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      createWorkspace()
    } else if (e.key === 'Escape') {
      setIsAdding(false)
      setName('')
    }
  }

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus()
    }
  }, [isAdding])

  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus()
      editInputRef.current?.select()
    }
  }, [editingId])

  const getModeTitle = () => {
    if (currentMode === 'PERSONAL') {
      return t('workspace.personal')
    }
    return t('workspace.team')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
      <div className="space-y-3">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {getModeTitle()}
          </h3>
          <button
              onClick={() => {
                if (isAdding) {
                  setIsAdding(false)
                  setName('')
                } else {
                  setIsAdding(true)
                }
              }}
              className="p-1 rounded-lg text-gray-500 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={t('workspace.create')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isAdding ? "M20 12H4" : "M12 4v16m8-8H4"} />
            </svg>
          </button>
        </div>

        {/* 워크스페이스 생성 입력 */}
        {isAdding && (
            <div className="px-2 pb-2 border-b border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
                <input
                    ref={inputRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('workspace.enterName') || '워크스페이스 이름'}
                    disabled={isCreating}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <button
                    onClick={createWorkspace}
                    disabled={!name.trim() || isCreating}
                    className="px-3 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreating ? '...' : '✓'}
                </button>
                <button
                    onClick={() => {
                      setIsAdding(false)
                      setName('')
                    }}
                    disabled={isCreating}
                    className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
        )}

        {/* 워크스페이스 목록 */}
        {workspaces.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              {t('workspace.empty')}
            </div>
        ) : (
            <div className="flex flex-col gap-1">
              {workspaces.map((ws) => (
                  <div
                      key={ws.workspace_id}
                      className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedWorkspaceId === ws.workspace_id
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                  >
                    {editingId === ws.workspace_id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            ws.type === 'personal' ? 'bg-green-500' : 'bg-purple-500'
                          }`}
                        />
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={handleEditKeyDown}
                          onBlur={submitRename}
                          className="flex-1 px-1.5 py-0.5 text-sm border border-blue-400 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSelectWorkspace(ws.workspace_id)}
                        onDoubleClick={(e) => {
                          e.preventDefault()
                          startEditing(ws.workspace_id, ws.name)
                        }}
                        className="flex-1 flex items-center gap-2 text-left"
                      >
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            ws.type === 'personal' ? 'bg-green-500' : 'bg-purple-500'
                          }`}
                        />
                        <span className="truncate">{ws.name}</span>
                      </button>
                    )}

                    {/* 위치 이동 & 삭제 버튼 */}
                    {editingId !== ws.workspace_id && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                        {/* 위로 이동 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            moveWorkspace(ws.workspace_id, 'up')
                          }}
                          disabled={workspaces.indexOf(ws) === 0}
                          className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={t('workspace.moveUp')}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        {/* 아래로 이동 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            moveWorkspace(ws.workspace_id, 'down')
                          }}
                          disabled={workspaces.indexOf(ws) === workspaces.length - 1}
                          className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={t('workspace.moveDown')}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {/* 삭제 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteWorkspace(ws.workspace_id, ws.name)
                          }}
                          disabled={deletingId === ws.workspace_id}
                          className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                          title={t('workspace.delete')}
                        >
                          {deletingId === ws.workspace_id ? (
                            <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
              ))}
            </div>
        )}
      </div>
  )
}
