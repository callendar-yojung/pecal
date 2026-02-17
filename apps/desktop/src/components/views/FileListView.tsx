import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWorkspaceStore } from '../../stores'
import { fileApi } from '../../api'
import type { FileInfo, FilesPaginatedResponse } from '../../types'
import { getErrorMessage } from '../../utils/error'

const PAGE_SIZE = 20

type FilterType = 'all' | 'image' | 'document' | 'other'

function getFileIcon(mimeType: string | null): string {
  if (mimeType?.startsWith('image/')) return 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
  if (mimeType?.startsWith('video/')) return 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
  return 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z'
}

function getFileTypeLabel(mimeType: string | null): string {
  if (!mimeType) return 'File'
  if (mimeType.startsWith('image/')) return 'Image'
  if (mimeType.startsWith('video/')) return 'Video'
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'Excel'
  if (mimeType.includes('document') || mimeType.includes('word')) return 'Word'
  return 'File'
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

// ── 파일 상세 모달 ──────────────────────────────────────────────

function FileDetailModal({
  file,
  onClose,
  onDeleted,
}: {
  file: FileInfo
  onClose: () => void
  onDeleted: (fileId: number) => void
}) {
  const { t } = useTranslation()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const isImage = file.mime_type?.startsWith('image/') ?? false

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false)
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose, showDeleteConfirm])

  const handleOpenFile = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(file.file_path)
    } catch (err) {
      console.error('Failed to open file:', err)
      alert(t('file.downloadError'))
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await fileApi.deleteFile(file.file_id)
      onDeleted(file.file_id)
      onClose()
    } catch (err) {
      console.error('Failed to delete file:', err)
      alert(t('file.deleteError'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t('file.detail')}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Image preview */}
          {isImage && (
            <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <img
                src={file.file_path}
                alt={file.original_name}
                className="w-full max-h-56 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
          )}

          {/* Non-image file icon */}
          {!isImage && (
            <div className="flex flex-col items-center justify-center py-6 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
              <svg
                className="w-16 h-16 text-gray-300 dark:text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d={getFileIcon(file.mime_type)}
                />
              </svg>
              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                {getFileTypeLabel(file.mime_type)}
              </p>
            </div>
          )}

          {/* File info */}
          <div className="space-y-2">
            <InfoRow label={t('file.name')} value={file.original_name} />
            <InfoRow label={t('file.type')} value={getFileTypeLabel(file.mime_type)} />
            <InfoRow label={t('file.size')} value={file.file_size_formatted || formatFileSize(file.file_size)} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {t('file.delete')}
          </button>
          <button
            onClick={handleOpenFile}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {t('file.open')}
          </button>
        </div>

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 rounded-xl">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-xs mx-4 p-5">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {t('file.deleteConfirm')}
              </p>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                >
                  {t('event.cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {isDeleting ? t('file.deleting') : t('file.delete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-[220px] text-right">{value}</span>
    </div>
  )
}

// ── 파일 목록 뷰 ──────────────────────────────────────────────

export function FileListView() {
  const { t } = useTranslation()
  const { selectedWorkspaceId } = useWorkspaceStore()
  const [files, setFiles] = useState<FileInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState<FilterType>('all')
  const [stats, setStats] = useState({ total: 0, images: 0, documents: 0, others: 0 })
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null)
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [isBulkDownloading, setIsBulkDownloading] = useState(false)

  const fetchFiles = useCallback(async () => {
    if (!selectedWorkspaceId) {
      setFiles([])
      setTotal(0)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res: FilesPaginatedResponse = await fileApi.getFiles({
        workspace_id: selectedWorkspaceId,
        page,
        limit: PAGE_SIZE,
        type: filter === 'all' ? undefined : filter,
      })
      setFiles(res.files || [])
      setTotal(res.pagination?.total || 0)
      setTotalPages(res.pagination?.totalPages || 1)
      if (res.stats) setStats(res.stats)
    } catch (err) {
      console.error('Failed to fetch files:', err)
      setError(getErrorMessage(err, t('common.error')))
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [selectedWorkspaceId, page, filter, t])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  useEffect(() => {
    setPage(1)
    setSelectedFiles(new Set())
  }, [filter, selectedWorkspaceId])

  useEffect(() => {
    setSelectedFiles(new Set())
  }, [page])

  const toggleSelectMode = () => {
    setIsSelectMode((prev) => !prev)
    setSelectedFiles(new Set())
  }

  const toggleFileSelection = (fileId: number) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(fileId)) {
        next.delete(fileId)
      } else {
        next.add(fileId)
      }
      return next
    })
  }

  const selectAllCurrentPage = () => {
    setSelectedFiles(new Set(files.map((file) => file.file_id)))
  }

  const clearSelection = () => {
    setSelectedFiles(new Set())
  }

  const handleBulkDelete = async () => {
    if (!selectedWorkspaceId || selectedFiles.size === 0 || isBulkDeleting) return
    const confirmed = window.confirm(t('file.bulkDeleteConfirm'))
    if (!confirmed) return

    setIsBulkDeleting(true)
    try {
      const fileIds = Array.from(selectedFiles)
      const result = await fileApi.bulkDeleteFiles(selectedWorkspaceId, fileIds)
      await fetchFiles()
      setSelectedFiles(new Set())

      if (result.failed?.length > 0) {
        alert(t('file.bulkDeletePartial', { deleted: result.deleted.length, failed: result.failed.length }))
      }
    } catch (err) {
      console.error('Failed to bulk delete files:', err)
      alert(t('file.deleteError'))
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const handleBulkDownload = async () => {
    if (selectedFiles.size === 0 || isBulkDownloading) return
    setIsBulkDownloading(true)
    try {
      const { open } = await import('@tauri-apps/plugin-shell')
      const selectedList = files.filter((file) => selectedFiles.has(file.file_id))
      for (const file of selectedList) {
        try {
          await open(file.file_path)
        } catch (err) {
          console.error('Failed to open file for bulk download:', err)
        }
      }
    } finally {
      setIsBulkDownloading(false)
    }
  }

  const handleFileDeleted = (fileId: number) => {
    setFiles((prev) => prev.filter((f) => f.file_id !== fileId))
    setTotal((prev) => prev - 1)
    setStats((prev) => {
      const deleted = files.find((f) => f.file_id === fileId)
      if (!deleted) return prev
      const isImg = deleted.mime_type?.startsWith('image/')
      const isDoc = deleted.mime_type?.includes('document') || deleted.mime_type?.includes('word') ||
        deleted.mime_type?.includes('pdf') || deleted.mime_type?.includes('spreadsheet') || deleted.mime_type?.includes('excel')
      return {
        total: prev.total - 1,
        images: isImg ? prev.images - 1 : prev.images,
        documents: isDoc ? prev.documents - 1 : prev.documents,
        others: (!isImg && !isDoc) ? prev.others - 1 : prev.others,
      }
    })
  }

  if (!selectedWorkspaceId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">{t('workspace.select')}</p>
      </div>
    )
  }

  const FILTERS: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: t('file.filterAll'), count: stats.total },
    { key: 'image', label: t('file.filterImages'), count: stats.images },
    { key: 'document', label: t('file.filterDocuments'), count: stats.documents },
    { key: 'other', label: t('file.filterOthers'), count: stats.others },
  ]

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          {t('sidebar.files')}
          <span className="ml-2 text-sm font-normal text-gray-400">({total})</span>
        </h2>
        <button
          onClick={toggleSelectMode}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            isSelectMode
              ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          {isSelectMode ? t('file.exitSelectMode') : t('file.selectMode')}
        </button>
      </div>

      {isSelectMode && (
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={selectAllCurrentPage}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {t('file.selectAll')}
          </button>
          <button
            onClick={clearSelection}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {t('file.clearSelection')}
          </button>
          <button
            onClick={handleBulkDownload}
            disabled={selectedFiles.size === 0 || isBulkDownloading}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            {isBulkDownloading ? '...' : t('file.bulkDownload')}
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={selectedFiles.size === 0 || isBulkDeleting}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
          >
            {isBulkDeleting ? '...' : t('file.bulkDelete')}
          </button>
          <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
            {t('file.selectedCount', { count: selectedFiles.size })}
          </span>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filter === f.key
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 text-red-400">
            <p className="text-sm">{error}</p>
            <button
              onClick={fetchFiles}
              className="mt-3 px-4 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {t('task.retry')}
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="text-sm">{t('sidebar.noFiles')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {isSelectMode && (
                  <th className="text-left py-2 px-3 w-10">
                    <span className="sr-only">select</span>
                  </th>
                )}
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2 px-3">
                  {t('sidebar.fileName')}
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2 px-3 w-24">
                  {t('sidebar.fileType')}
                </th>
                <th className="text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2 px-3 w-28">
                  {t('file.size')}
                </th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr
                  key={file.file_id}
                  onClick={() => (isSelectMode ? toggleFileSelection(file.file_id) : setSelectedFile(file))}
                  className={`border-b border-gray-100 dark:border-gray-800 transition-colors cursor-pointer ${
                    selectedFiles.has(file.file_id)
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  {isSelectMode && (
                    <td className="py-2.5 px-3">
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.file_id)}
                        onChange={() => toggleFileSelection(file.file_id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </td>
                  )}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <svg
                        className="w-5 h-5 text-gray-400 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d={getFileIcon(file.mime_type)}
                        />
                      </svg>
                      <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                        {file.original_name}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {getFileTypeLabel(file.mime_type)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {file.file_size_formatted || formatFileSize(file.file_size)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[60px] text-center">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* File detail modal */}
      {selectedFile && (
        <FileDetailModal
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onDeleted={handleFileDeleted}
        />
      )}
    </div>
  )
}
