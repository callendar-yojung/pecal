import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiClient } from '../../api'
import { useWorkspaceStore } from '../../stores'
import RichTextEditor from '../editor/RichTextEditor'
import { EMPTY_RICH_CONTENT } from '../../utils/richText'

interface ServerMemoItem {
  memo_id: number
  owner_type: 'personal' | 'team'
  owner_id: number
  member_id: number
  title: string
  content_json: string
  is_favorite: number
  created_at: string
  updated_at: string
}

interface LegacyMemoItem {
  id: string
  workspace_id: number
  title: string
  content: string | Record<string, unknown>
  updated_at: string
}

interface MemosResponse {
  memos: ServerMemoItem[]
  total: number
}

const LEGACY_STORAGE_KEY = 'desktop_calendar_memos_v1'
const MIGRATION_PREFIX = 'desktop_calendar_memos_migrated_v2'

function parseLegacyMemos(): LegacyMemoItem[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as LegacyMemoItem[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function saveLegacyMemos(memos: LegacyMemoItem[]) {
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(memos))
}

function legacyContentToDoc(content: LegacyMemoItem['content']): Record<string, unknown> {
  if (content && typeof content === 'object') {
    return content
  }
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: String(content || '') }] }],
  }
}

function parseMemoContent(contentJson: string): Record<string, unknown> {
  if (!contentJson?.trim()) return EMPTY_RICH_CONTENT
  try {
    const parsed = JSON.parse(contentJson) as Record<string, unknown>
    return parsed
  } catch {
    return EMPTY_RICH_CONTENT
  }
}

export function MemoView() {
  const { t } = useTranslation()
  const { selectedWorkspaceId, workspaces } = useWorkspaceStore()

  const [memos, setMemos] = useState<ServerMemoItem[]>([])
  const [activeMemoId, setActiveMemoId] = useState<number | null>(null)
  const [listCollapsed, setListCollapsed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [memoTitle, setMemoTitle] = useState('')
  const [memoContent, setMemoContent] = useState<Record<string, unknown>>(EMPTY_RICH_CONTENT)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipAutosaveRef = useRef(false)

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.workspace_id === selectedWorkspaceId) ?? null,
    [workspaces, selectedWorkspaceId]
  )

  const ownerType = selectedWorkspace?.type ?? null
  const ownerId = selectedWorkspace?.owner_id ?? null

  const fetchMemos = useCallback(async () => {
    if (!ownerType || !ownerId) {
      setMemos([])
      setActiveMemoId(null)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({
        owner_type: ownerType,
        owner_id: String(ownerId),
        page: '1',
        page_size: '50',
        sort: 'latest',
      })

      const data = await apiClient.get<MemosResponse>(`/api/memos?${query.toString()}`)
      setMemos(data.memos ?? [])
    } catch (err) {
      console.error('Failed to fetch memos:', err)
      setError(t('common.error'))
      setMemos([])
    } finally {
      setIsLoading(false)
    }
  }, [ownerId, ownerType, t])

  const migrateLegacyMemos = useCallback(async () => {
    if (!selectedWorkspaceId || !ownerType || !ownerId) return

    const migrationKey = `${MIGRATION_PREFIX}:${selectedWorkspaceId}`
    if (localStorage.getItem(migrationKey) === '1') return

    const legacyAll = parseLegacyMemos()
    const targets = legacyAll.filter((memo) => memo.workspace_id === selectedWorkspaceId)
    if (targets.length === 0) {
      localStorage.setItem(migrationKey, '1')
      return
    }

    const succeededIds = new Set<string>()

    for (const legacyMemo of targets) {
      try {
        await apiClient.post<{ success: boolean; memo_id: number }>('/api/memos', {
          owner_type: ownerType,
          owner_id: ownerId,
          title: legacyMemo.title?.trim() || t('memo.untitled'),
          content: legacyContentToDoc(legacyMemo.content),
        })
        succeededIds.add(legacyMemo.id)
      } catch (err) {
        console.error('Legacy memo migration failed:', err)
      }
    }

    if (succeededIds.size > 0) {
      const remained = legacyAll.filter((memo) => !(memo.workspace_id === selectedWorkspaceId && succeededIds.has(memo.id)))
      saveLegacyMemos(remained)
    }

    if (succeededIds.size === targets.length) {
      localStorage.setItem(migrationKey, '1')
    }
  }, [ownerId, ownerType, selectedWorkspaceId, t])

  useEffect(() => {
    const run = async () => {
      if (!ownerType || !ownerId) return
      await migrateLegacyMemos()
      await fetchMemos()
    }
    run()
  }, [fetchMemos, migrateLegacyMemos, ownerId, ownerType])

  useEffect(() => {
    if (memos.length === 0) {
      setActiveMemoId(null)
      return
    }
    if (!activeMemoId || !memos.some((memo) => memo.memo_id === activeMemoId)) {
      setActiveMemoId(memos[0].memo_id)
    }
  }, [memos, activeMemoId])

  const activeMemo = useMemo(
    () => memos.find((memo) => memo.memo_id === activeMemoId) ?? null,
    [memos, activeMemoId]
  )

  useEffect(() => {
    if (!activeMemo) return
    skipAutosaveRef.current = true
    setMemoTitle(activeMemo.title || t('memo.untitled'))
    setMemoContent(parseMemoContent(activeMemo.content_json))
  }, [activeMemo, t])

  const persistActiveMemo = useCallback(async () => {
    if (!activeMemoId || !ownerType || !ownerId) return
    setIsSaving(true)
    try {
      await apiClient.put<{ success: boolean }>(`/api/memos/${activeMemoId}`, {
        owner_type: ownerType,
        owner_id: ownerId,
        title: memoTitle.trim() || t('memo.untitled'),
        content: memoContent,
      })
      setMemos((prev) =>
        prev
          .map((memo) =>
            memo.memo_id === activeMemoId
              ? {
                  ...memo,
                  title: memoTitle.trim() || t('memo.untitled'),
                  content_json: JSON.stringify(memoContent),
                  updated_at: new Date().toISOString(),
                }
              : memo
          )
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      )
    } catch (err) {
      console.error('Failed to save memo:', err)
    } finally {
      setIsSaving(false)
    }
  }, [activeMemoId, memoContent, memoTitle, ownerId, ownerType, t])

  useEffect(() => {
    if (!activeMemo) return
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false
      return
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = setTimeout(() => {
      void persistActiveMemo()
    }, 500)

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [activeMemo, memoTitle, memoContent, persistActiveMemo])

  const createMemo = async () => {
    if (!ownerType || !ownerId) return
    try {
      const created = await apiClient.post<{ success: boolean; memo_id: number }>('/api/memos', {
        owner_type: ownerType,
        owner_id: ownerId,
        title: t('memo.untitled'),
        content: EMPTY_RICH_CONTENT,
      })
      await fetchMemos()
      if (created.memo_id) {
        setActiveMemoId(created.memo_id)
      }
    } catch (err) {
      console.error('Failed to create memo:', err)
      setError(t('common.error'))
    }
  }

  const deleteActiveMemo = async () => {
    if (!activeMemo || !ownerType || !ownerId) return
    try {
      await apiClient.delete<{ success: boolean }>(
        `/api/memos/${activeMemo.memo_id}?owner_type=${ownerType}&owner_id=${ownerId}`
      )
      await fetchMemos()
      setActiveMemoId(null)
    } catch (err) {
      console.error('Failed to delete memo:', err)
      setError(t('common.error'))
    }
  }

  if (!selectedWorkspaceId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">{t('workspace.select')}</p>
      </div>
    )
  }

  return (
    <div className="relative flex-1 flex bg-white dark:bg-gray-900 overflow-hidden">
      <aside
        className={`border-r border-gray-200 dark:border-gray-700 overflow-y-auto transition-all duration-200 ${
          listCollapsed ? 'w-0 p-0 border-r-0 overflow-hidden' : 'w-72 p-4'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('memo.title')}</h2>
          <button
            onClick={() => void createMemo()}
            className="px-2 py-1 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            {t('memo.new')}
          </button>
        </div>

        {isLoading ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">Loading...</p>
        ) : error ? (
          <p className="text-xs text-red-500">{error}</p>
        ) : memos.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('memo.empty')}</p>
        ) : (
          <div className="space-y-2">
            {memos.map((memo) => {
              const active = memo.memo_id === activeMemoId
              return (
                <button
                  key={memo.memo_id}
                  onClick={() => setActiveMemoId(memo.memo_id)}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                    active
                      ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20'
                      : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {memo.title || t('memo.untitled')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {new Date(memo.updated_at).toLocaleString()}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </aside>

      <button
        onClick={() => setListCollapsed((prev) => !prev)}
        className="absolute z-20 w-7 h-7 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm top-1/2 -translate-y-1/2"
        style={{ left: listCollapsed ? '0.5rem' : '17rem' }}
        title={listCollapsed ? t('memo.expandList') : t('memo.collapseList')}
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-300 ${listCollapsed ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <section className="min-w-0 flex-1 overflow-y-auto p-4">
        {activeMemo ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
              <input
                value={memoTitle}
                onChange={(e) => setMemoTitle(e.target.value)}
                placeholder={t('memo.titlePlaceholder')}
                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {isSaving ? 'Saving...' : ''}
              </div>
              <button
                onClick={() => void deleteActiveMemo()}
                className="w-full shrink-0 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 md:w-auto dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                {t('memo.delete')}
              </button>
            </div>

            <RichTextEditor
              initialContent={memoContent}
              onChange={(content) => setMemoContent(content)}
              contentKey={activeMemo.memo_id}
              showToolbar={true}
            />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('memo.selectOrCreate')}</p>
          </div>
        )}
      </section>
    </div>
  )
}
