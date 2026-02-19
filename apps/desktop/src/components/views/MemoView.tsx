import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWorkspaceStore } from '../../stores'
import RichTextEditor from '../editor/RichTextEditor'
import { EMPTY_RICH_CONTENT } from '../../utils/richText'

interface MemoItem {
  id: string
  workspace_id: number
  title: string
  content: Record<string, unknown>
  updated_at: string
}

interface LegacyMemoItem {
  id: string
  workspace_id: number
  title: string
  content: string | Record<string, unknown>
  updated_at: string
}

const STORAGE_KEY = 'desktop_calendar_memos_v1'

function loadMemos(): MemoItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as LegacyMemoItem[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((memo) => ({
      ...memo,
      content:
        memo.content && typeof memo.content === 'object'
          ? memo.content
          : {
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: String(memo.content || '') }] }],
            },
    }))
  } catch {
    return []
  }
}

function saveMemos(memos: MemoItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memos))
}

export function MemoView() {
  const { t } = useTranslation()
  const { selectedWorkspaceId } = useWorkspaceStore()
  const [allMemos, setAllMemos] = useState<MemoItem[]>(() => loadMemos())
  const [activeMemoId, setActiveMemoId] = useState<string | null>(null)
  const [listCollapsed, setListCollapsed] = useState(false)

  const workspaceMemos = useMemo(() => {
    if (!selectedWorkspaceId) return []
    return allMemos
      .filter((memo) => memo.workspace_id === selectedWorkspaceId)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }, [allMemos, selectedWorkspaceId])

  useEffect(() => {
    if (workspaceMemos.length === 0) {
      setActiveMemoId(null)
      return
    }
    if (!activeMemoId || !workspaceMemos.some((memo) => memo.id === activeMemoId)) {
      setActiveMemoId(workspaceMemos[0].id)
    }
  }, [workspaceMemos, activeMemoId])

  const activeMemo = workspaceMemos.find((memo) => memo.id === activeMemoId) ?? null

  const createMemo = () => {
    if (!selectedWorkspaceId) return
    const now = new Date().toISOString()
    const memo: MemoItem = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      workspace_id: selectedWorkspaceId,
      title: t('memo.untitled'),
      content: EMPTY_RICH_CONTENT,
      updated_at: now,
    }
    const next = [memo, ...allMemos]
    setAllMemos(next)
    saveMemos(next)
    setActiveMemoId(memo.id)
  }

  const patchActiveMemo = (patch: Partial<Pick<MemoItem, 'title' | 'content'>>) => {
    if (!activeMemo) return
    const next = allMemos.map((memo) =>
      memo.id === activeMemo.id
        ? {
            ...memo,
            ...patch,
            updated_at: new Date().toISOString(),
          }
        : memo
    )
    setAllMemos(next)
    saveMemos(next)
  }

  const deleteActiveMemo = () => {
    if (!activeMemo) return
    const next = allMemos.filter((memo) => memo.id !== activeMemo.id)
    setAllMemos(next)
    saveMemos(next)
    setActiveMemoId(null)
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
            onClick={createMemo}
            className="px-2 py-1 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            {t('memo.new')}
          </button>
        </div>

        {workspaceMemos.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('memo.empty')}</p>
        ) : (
          <div className="space-y-2">
            {workspaceMemos.map((memo) => {
              const active = memo.id === activeMemoId
              return (
                <button
                  key={memo.id}
                  onClick={() => setActiveMemoId(memo.id)}
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
                value={activeMemo.title}
                onChange={(e) => patchActiveMemo({ title: e.target.value })}
                placeholder={t('memo.titlePlaceholder')}
                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                onClick={deleteActiveMemo}
                className="w-full shrink-0 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 md:w-auto dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                {t('memo.delete')}
              </button>
            </div>

            <RichTextEditor
              initialContent={activeMemo.content}
              onChange={(content) => patchActiveMemo({ content })}
              contentKey={activeMemo.id}
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
