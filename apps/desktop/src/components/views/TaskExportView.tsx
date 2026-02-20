import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { taskExportsApi, teamApi } from '../../api'
import { useViewStore } from '../../stores'
import type {
  MemberSearchResult,
  TaskExportItem,
  TaskExportVisibility,
} from '../../types'

const toDateTimeLocal = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

const toMysqlDatetime = (value: string) => {
  if (!value) return null
  return value.includes('T') ? `${value.replace('T', ' ')}:00` : value
}

export function TaskExportView() {
  const { t, i18n } = useTranslation()
  const { exportTask, closeTaskExport } = useViewStore()

  const [visibility, setVisibility] = useState<TaskExportVisibility>('public')
  const [newExpiresAt, setNewExpiresAt] = useState('')
  const [exportsList, setExportsList] = useState<TaskExportItem[]>([])
  const [selectedExportId, setSelectedExportId] = useState<number | null>(null)
  const [expiryDrafts, setExpiryDrafts] = useState<Record<number, string>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([])
  const [selectedMember, setSelectedMember] = useState<MemberSearchResult | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [working, setWorking] = useState<Record<number, boolean>>({})
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const locale = i18n.language === 'ko' ? 'ko' : 'en'
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'https://pecal.site').replace(/\/$/, '')

  const buildShareUrl = (token: string) => `${baseUrl}/${locale}/export/tasks/${token}`

  const fetchExports = async () => {
    if (!exportTask) return
    setLoading(true)
    setError(null)
    try {
      const response = await taskExportsApi.getExports(exportTask.id)
      const list = response.exports || []
      setExportsList(list)
      setSelectedExportId((prev) => prev ?? list[0]?.export_id ?? null)
      setExpiryDrafts((prev) => {
        const next = { ...prev }
        list.forEach((item) => {
          if (next[item.export_id] === undefined) {
            next[item.export_id] = toDateTimeLocal(item.expires_at)
          }
        })
        return next
      })
    } catch (err) {
      console.error('Failed to load exports:', err)
      setError(t('taskExport.loadError'))
      setExportsList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setSearchQuery('')
    setSelectedMember(null)
    setSearchResults([])
    setShowSearch(false)
  }, [selectedExportId])

  useEffect(() => {
    fetchExports()
  }, [exportTask?.id])

  useEffect(() => {
    const trimmed = searchQuery.trim()
    if (selectedMember && trimmed !== (selectedMember.nickname || selectedMember.email || '')) {
      setSelectedMember(null)
    }
    if (!trimmed || trimmed.length < 2 || !selectedExportId) {
      setSearchResults([])
      return
    }

    const timeoutId = window.setTimeout(async () => {
      setSearchLoading(true)
      try {
        const type = trimmed.includes('@') ? 'email' : 'nickname'
        const response = await teamApi.searchMembers(trimmed, type)
        setSearchResults(response.results || [])
        setShowSearch(true)
      } catch (err) {
        console.error('Failed to search members:', err)
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [searchQuery, selectedExportId, selectedMember])

  const handleCreateExport = async () => {
    if (!exportTask || creating) return
    setCreating(true)
    setError(null)
    try {
      const response = await taskExportsApi.createExport(
        exportTask.id,
        visibility,
        toMysqlDatetime(newExpiresAt)
      )
      setShareUrl(response.url || buildShareUrl(response.token))
      setNewExpiresAt('')
      await fetchExports()
    } catch (err) {
      console.error('Failed to create export:', err)
      setError(t('taskExport.createError'))
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
    } catch (err) {
      console.error('Failed to copy url:', err)
      setError(t('taskExport.copyError'))
    }
  }

  const withWorking = async (id: number, action: () => Promise<void>) => {
    setWorking((prev) => ({ ...prev, [id]: true }))
    try {
      await action()
    } finally {
      setWorking((prev) => ({ ...prev, [id]: false }))
    }
  }

  const handleRevoke = async (exportId: number) => {
    await withWorking(exportId, async () => {
      await taskExportsApi.updateExport(exportId, { revoke: true })
      await fetchExports()
    })
  }

  const handleVisibilityChange = async (exportId: number, next: TaskExportVisibility) => {
    await withWorking(exportId, async () => {
      await taskExportsApi.updateExport(exportId, { visibility: next })
      await fetchExports()
    })
  }

  const handleExpirySave = async (exportId: number) => {
    await withWorking(exportId, async () => {
      const value = expiryDrafts[exportId] || ''
      await taskExportsApi.updateExport(exportId, {
        expires_at: value ? toMysqlDatetime(value) : null,
      })
      await fetchExports()
    })
  }

  const handleAddAccess = async () => {
    if (!selectedExportId || !selectedMember) return
    await withWorking(selectedExportId, async () => {
      await taskExportsApi.addAccess(selectedExportId, selectedMember.member_id)
      setSearchQuery('')
      setSelectedMember(null)
      setSearchResults([])
      setShowSearch(false)
      await fetchExports()
    })
  }

  const handleRemoveAccess = async (memberId: number) => {
    if (!selectedExportId) return
    await withWorking(selectedExportId, async () => {
      await taskExportsApi.removeAccess(selectedExportId, memberId)
      await fetchExports()
    })
  }

  if (!exportTask) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('taskExport.noTask')}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('taskExport.title')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[480px]">
            {exportTask.title}
          </p>
        </div>
        <button
          onClick={closeTaskExport}
          className="px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          {t('event.cancel')}
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg px-3 py-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4 space-y-3">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('taskExport.create')}</div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as TaskExportVisibility)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          >
            <option value="public">{t('taskExport.public')}</option>
            <option value="restricted">{t('taskExport.restricted')}</option>
          </select>
          <input
            type="datetime-local"
            value={newExpiresAt}
            onChange={(e) => setNewExpiresAt(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          />
          <button
            onClick={handleCreateExport}
            disabled={creating}
            className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? '...' : t('taskExport.create')}
          </button>
        </div>
        {shareUrl && (
          <div className="flex items-center gap-2 text-xs">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
            />
            <button
              onClick={() => handleCopy(shareUrl)}
              className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {t('taskExport.copy')}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
        ) : exportsList.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('taskExport.empty')}</p>
        ) : (
          exportsList.map((item) => {
            const isWorking = !!working[item.export_id]
            const isRevoked = Boolean(item.revoked_at)
            const isRestricted = item.visibility === 'restricted'
            return (
              <div
                key={item.export_id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      #{item.export_id} · {isRevoked ? t('taskExport.revoked') : t('taskExport.active')}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(item.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(buildShareUrl(item.token))}
                      className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {t('taskExport.copy')}
                    </button>
                    {!isRevoked && (
                      <button
                        onClick={() => handleRevoke(item.export_id)}
                        disabled={isWorking}
                        className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                      >
                        {t('taskExport.revoke')}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    value={item.visibility}
                    disabled={isRevoked || isWorking}
                    onChange={(e) =>
                      handleVisibilityChange(item.export_id, e.target.value as TaskExportVisibility)
                    }
                    className="px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                  >
                    <option value="public">{t('taskExport.public')}</option>
                    <option value="restricted">{t('taskExport.restricted')}</option>
                  </select>
                  <input
                    type="datetime-local"
                    value={expiryDrafts[item.export_id] || ''}
                    disabled={isRevoked || isWorking}
                    onChange={(e) =>
                      setExpiryDrafts((prev) => ({ ...prev, [item.export_id]: e.target.value }))
                    }
                    className="px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                  />
                  <button
                    onClick={() => handleExpirySave(item.export_id)}
                    disabled={isRevoked || isWorking}
                    className="px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    {t('event.save')}
                  </button>
                </div>

                {isRestricted && !isRevoked && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      {t('taskExport.accessMembers')}
                    </div>
                    <div className="relative flex gap-2">
                      <input
                        value={selectedExportId === item.export_id ? searchQuery : ''}
                        onFocus={() => setSelectedExportId(item.export_id)}
                        onChange={(e) => {
                          setSelectedExportId(item.export_id)
                          setSearchQuery(e.target.value)
                        }}
                        placeholder={t('taskExport.searchMember')}
                        className="flex-1 px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                      />
                      <button
                        onClick={handleAddAccess}
                        disabled={selectedExportId !== item.export_id || !selectedMember || isWorking}
                        className="px-2 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {t('taskExport.add')}
                      </button>
                      {selectedExportId === item.export_id &&
                        showSearch &&
                        (searchLoading || searchResults.length > 0) && (
                          <div className="absolute z-10 left-0 right-0 top-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 max-h-36 overflow-auto">
                            {searchLoading ? (
                              <p className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400">
                                {t('common.loading')}
                              </p>
                            ) : (
                              searchResults.map((member) => {
                                const label =
                                  member.nickname || member.email || `#${member.member_id}`
                                return (
                                  <button
                                    key={member.member_id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedMember(member)
                                      setSearchQuery(label)
                                      setShowSearch(false)
                                    }}
                                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {label}
                                  </button>
                                )
                              })
                            )}
                          </div>
                        )}
                    </div>

                    {item.access_members.length === 0 ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('taskExport.noAccess')}</p>
                    ) : (
                      <div className="space-y-1">
                        {item.access_members.map((member) => {
                          const label = member.nickname || member.email || `#${member.member_id}`
                          return (
                            <div
                              key={member.member_id}
                              className="flex items-center justify-between px-2 py-1.5 rounded bg-gray-50 dark:bg-gray-800/60"
                            >
                              <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                                {label}
                              </span>
                              <button
                                onClick={() => handleRemoveAccess(member.member_id)}
                                disabled={isWorking}
                                className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                              >
                                {t('taskExport.remove')}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
