import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { Modal, Button } from '../common'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useModalStore, useCalendarStore, useWorkspaceStore, useAuthStore, useViewStore } from '../../stores'
import { taskApi, tagApi, attachmentApi } from '../../api'
import type { Tag, Attachment } from '../../types'
import { parseApiDateTime } from '../../utils/datetime'
import RichTextEditor from '../editor/RichTextEditor'
import { parseRichContent } from '../../utils/richText'

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return '📄'
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.includes('pdf')) return '📕'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return '📦'
  return '📄'
}

export function EventDetailModal() {
  const { t } = useTranslation()
  const { openedModal, selectedEvent, closeModal, openEditModal } = useModalStore()
  const { openTaskExport } = useViewStore()
  const { setEvents, events } = useCalendarStore()
  const { currentMode, selectedTeamId } = useWorkspaceStore()
  const { user } = useAuthStore()

  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [tags, setTags] = useState<Tag[]>([])
  const [isTagsLoading, setIsTagsLoading] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isAttachmentsLoading, setIsAttachmentsLoading] = useState(false)

  const ownerType = currentMode === 'TEAM' ? 'team' : 'personal'
  const ownerId = currentMode === 'TEAM' ? selectedTeamId : user?.memberId

  useEffect(() => {
    const loadTags = async () => {
      if (!ownerId || openedModal !== 'DETAIL') return
      setIsTagsLoading(true)
      try {
        const response = await tagApi.getTags(ownerType, ownerId)
        setTags(response.tags)
      } catch (err) {
        console.error('Failed to load tags:', err)
      } finally {
        setIsTagsLoading(false)
      }
    }

    loadTags()
  }, [openedModal, ownerType, ownerId])

  useEffect(() => {
    const loadAttachments = async () => {
      if (!selectedEvent || openedModal !== 'DETAIL') return
      setIsAttachmentsLoading(true)
      try {
        const res = await attachmentApi.getAttachments(selectedEvent.id)
        setAttachments(res.attachments || [])
      } catch (err) {
        console.error('Failed to load attachments:', err)
      } finally {
        setIsAttachmentsLoading(false)
      }
    }
    loadAttachments()
  }, [selectedEvent, openedModal])

  const handleOpenFile = async (url: string) => {
    try {
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(url)
    } catch (err) {
      console.error('Failed to open file:', err)
      alert(t('file.downloadError'))
    }
  }

  const handleEdit = () => {
    if (selectedEvent) openEditModal(selectedEvent)
  }

  const handleExport = () => {
    if (!selectedEvent) return
    openTaskExport(selectedEvent)
    closeModal()
  }

  const handleDelete = async () => {
    if (!selectedEvent) return
    setIsDeleting(true)

    try {
      await taskApi.deleteTask(selectedEvent.id)
      setEvents(events.filter((e) => e.id !== selectedEvent.id))
      setShowDeleteConfirm(false)
      closeModal()
    } catch (err: any) {
      console.error('Failed to delete event:', err)
      alert(t('event.deleteFailed'))
    } finally {
      setIsDeleting(false)
    }
  }

  const formatDateTime = (dateStr: string) => {
    const date = parseApiDateTime(dateStr)
    return format(date, 'yyyy-MM-dd HH:mm')
  }

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'todo':
        return t('status.todo')
      case 'in_progress':
        return t('status.inProgress')
      case 'done':
        return t('status.done')
      default:
        return '-'
    }
  }

  const selectedTags = useMemo(() => {
    if (!selectedEvent?.tag_ids?.length) return []
    return tags.filter((tag) => selectedEvent.tag_ids?.includes(tag.tag_id))
  }, [tags, selectedEvent?.tag_ids])

  if (openedModal !== 'DETAIL' || !selectedEvent) return null

  const formattedRange =
    `${formatDateTime(selectedEvent.start_time)} – ${formatDateTime(selectedEvent.end_time)}`

  return (
    <Modal
      isOpen={true}
      onClose={closeModal}
      title={t('event.detail')}
      showHeader={false}
      containerClassName="bg-transparent shadow-none"
      contentClassName="p-0"
    >
      <Card>
        <CardHeader>
          <CardTitle>{selectedEvent.title}</CardTitle>
          <CardDescription>{formattedRange}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 p-4 space-y-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-gray-400 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm">
                <p className="text-gray-600 dark:text-gray-400">
                  {t('event.startTime')}: {formatDateTime(selectedEvent.start_time)}
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  {t('event.endTime')}: {formatDateTime(selectedEvent.end_time)}
                </p>
              </div>
            </div>

            {selectedEvent.status && (
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('event.status')}: {getStatusLabel(selectedEvent.status)}
                </span>
              </div>
            )}

            {selectedEvent.color && (
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v18m9-9H3"
                  />
                </svg>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span>{t('event.color')}:</span>
                  <span
                    className="h-3 w-3 rounded-full border border-gray-200 dark:border-gray-700"
                    style={{ backgroundColor: selectedEvent.color }}
                  />
                </div>
              </div>
            )}
          </div>

          {selectedEvent.tag_ids && selectedEvent.tag_ids.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 p-4 space-y-2">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('tag.title')}
              </div>
              <div className="flex flex-wrap gap-2">
                {isTagsLoading ? (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {t('common.loading')}
                  </span>
                ) : selectedTags.length > 0 ? (
                  selectedTags.map((tag) => (
                    <Badge
                      key={tag.tag_id}
                      variant="outline"
                      className="border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300"
                    >
                      <span
                        className="mr-2 h-2.5 w-2.5 rounded-full border border-white/60"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {t('tag.empty')}
                  </span>
                )}
              </div>
            </div>
          )}

          {selectedEvent.content && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 p-4 space-y-2">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('event.content')}
              </div>
              <RichTextEditor
                initialContent={parseRichContent(selectedEvent.content)}
                readOnly={true}
                showToolbar={false}
                contentKey={`detail-${selectedEvent.id}-${selectedEvent.updated_at}`}
              />
            </div>
          )}

          {/* 첨부파일 */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 p-4 space-y-2">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('file.title')}
            </div>
            {isAttachmentsLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
            ) : attachments.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">{t('file.empty')}</p>
            ) : (
              <div className="space-y-1">
                {attachments.map((att) => (
                  <button
                    key={att.attachment_id}
                    type="button"
                    onClick={() => handleOpenFile(att.file_path)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <span>{getFileIcon(att.mime_type)}</span>
                    <span className="truncate text-gray-700 dark:text-gray-300">{att.original_name}</span>
                    <span className="flex-shrink-0 text-gray-400 text-xs">({att.file_size_formatted})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(true)}>
              {t('event.delete')}
            </Button>
            <Button variant="secondary" onClick={handleExport}>
              {t('event.export')}
            </Button>
          </div>
          <Button variant="primary" onClick={handleEdit} className="min-w-[120px]">
            {t('event.edit')}
          </Button>
        </CardFooter>
      </Card>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !isDeleting && setShowDeleteConfirm(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t('event.deleteConfirm')}
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                {t('event.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? t('event.deleting') : t('event.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
