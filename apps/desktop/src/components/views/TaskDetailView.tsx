import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format, setHours, setMinutes } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '../common'
import RichTextEditor from '../editor/RichTextEditor'
import { useAuthStore, useCalendarStore, useViewStore, useWorkspaceStore } from '../../stores'
import { attachmentApi, tagApi, taskApi } from '../../api'
import type { Attachment, Tag } from '../../types'
import { parseApiDateTime } from '../../utils/datetime'
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

export function TaskDetailView() {
  const { t } = useTranslation()
  const { detailTask, closeTaskDetail, openTaskExport, openTaskEdit, openTaskDetail } = useViewStore()
  
  const { setEvents, events } = useCalendarStore()
  const { currentMode, selectedTeamId } = useWorkspaceStore()
  const { user } = useAuthStore()

  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [tags, setTags] = useState<Tag[]>([])
  const [isTagsLoading, setIsTagsLoading] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isAttachmentsLoading, setIsAttachmentsLoading] = useState(false)
  const [showDuplicatePanel, setShowDuplicatePanel] = useState(false)
  const [duplicateStartDate, setDuplicateStartDate] = useState<Date>(new Date())
  const [duplicateEndDate, setDuplicateEndDate] = useState<Date>(new Date())
  const [isDuplicating, setIsDuplicating] = useState(false)

  const ownerType = currentMode === 'TEAM' ? 'team' : 'personal'
  const ownerId = currentMode === 'TEAM' ? selectedTeamId : user?.memberId

  useEffect(() => {
    const loadTags = async () => {
      if (!ownerId || !detailTask) return
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
  }, [ownerType, ownerId, detailTask?.id])

  useEffect(() => {
    const loadAttachments = async () => {
      if (!detailTask) return
      setIsAttachmentsLoading(true)
      try {
        const res = await attachmentApi.getAttachments(detailTask.id)
        setAttachments(res.attachments || [])
      } catch (err) {
        console.error('Failed to load attachments:', err)
      } finally {
        setIsAttachmentsLoading(false)
      }
    }
    loadAttachments()
  }, [detailTask?.id])

  useEffect(() => {
    if (!detailTask) return
    const sourceStart = parseApiDateTime(detailTask.start_time)
    const sourceEnd = parseApiDateTime(detailTask.end_time)
    setDuplicateStartDate(sourceStart)
    setDuplicateEndDate(sourceEnd)
    setShowDuplicatePanel(false)
  }, [detailTask?.id, detailTask?.start_time, detailTask?.end_time])

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
    if (!detailTask) return
    openTaskEdit(detailTask)
  }

  const handleExport = () => {
    if (!detailTask) return
    openTaskExport(detailTask)
  }

  const handleDelete = async () => {
    if (!detailTask) return
    setIsDeleting(true)
    try {
      await taskApi.deleteTask(detailTask.id)
      setEvents(events.filter((event) => event.id !== detailTask.id))
      closeTaskDetail()
    } catch (err) {
      console.error('Failed to delete event:', err)
      alert(t('event.deleteFailed'))
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const buildDatetime = (date: Date, hour: number, minute: number) =>
    setMinutes(setHours(date, hour), minute)

  const toMysqlDatetime = (date: Date) => format(date, 'yyyy-MM-dd HH:mm:ss')

  const parseDateInput = (value: string) => {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const handleDuplicate = async () => {
    if (!detailTask || isDuplicating) return
    const sourceStart = parseApiDateTime(detailTask.start_time)
    const sourceEnd = parseApiDateTime(detailTask.end_time)
    if (Number.isNaN(sourceStart.getTime()) || Number.isNaN(sourceEnd.getTime())) {
      alert(t('event.duplicateFailed'))
      return
    }

    const clonedStart = buildDatetime(
      duplicateStartDate,
      sourceStart.getHours(),
      sourceStart.getMinutes()
    )
    const clonedEnd = buildDatetime(
      duplicateEndDate,
      sourceEnd.getHours(),
      sourceEnd.getMinutes()
    )

    if (clonedEnd.getTime() <= clonedStart.getTime()) {
      alert(t('event.invalidTimeRange'))
      return
    }

    setIsDuplicating(true)
    try {
      const backendStatusMap = {
        todo: 'TODO',
        in_progress: 'IN_PROGRESS',
        done: 'DONE',
      } as const

      const response = await taskApi.createTask({
        title: detailTask.title,
        content: detailTask.content,
        start_time: toMysqlDatetime(clonedStart),
        end_time: toMysqlDatetime(clonedEnd),
        color: detailTask.color || '#3b82f6',
        reminder_minutes: detailTask.reminder_minutes ?? null,
        tag_ids: detailTask.tag_ids || [],
        status: backendStatusMap[(detailTask.status || 'todo') as keyof typeof backendStatusMap],
        workspace_id: detailTask.workspace_id,
      })

      const duplicatedTask = {
        ...detailTask,
        id: response.taskId,
        start_time: clonedStart.toISOString(),
        end_time: clonedEnd.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      setEvents([...events, duplicatedTask])
      setShowDuplicatePanel(false)
      openTaskDetail(duplicatedTask)
    } catch (err) {
      console.error('Failed to duplicate task:', err)
      alert(t('event.duplicateFailed'))
    } finally {
      setIsDuplicating(false)
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

  const formatReminder = (minutes?: number | null) => {
    if (minutes === null || minutes === undefined) return '알림 없음'
    if (minutes <= 0) return '정시'
    if (minutes % 1440 === 0) return `${minutes / 1440}일 전`
    if (minutes % 60 === 0) return `${minutes / 60}시간 전`
    return `${minutes}분 전`
  }

  const selectedTags = useMemo(() => {
    if (!detailTask?.tag_ids?.length) return []
    return tags.filter((tag) => detailTask.tag_ids?.includes(tag.tag_id))
  }, [tags, detailTask?.tag_ids])

  if (!detailTask) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('taskDetail.noTask')}</p>
      </div>
    )
  }

  const formattedRange = `${formatDateTime(detailTask.start_time)} – ${formatDateTime(detailTask.end_time)}`

  return (
    <div className="flex-1 p-6 bg-white dark:bg-gray-900 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-3">
        <button
          onClick={closeTaskDetail}
          className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          {t('taskDetail.back')}
        </button>
        <Card>
          <CardHeader>
            <CardTitle>{detailTask.title}</CardTitle>
            <CardDescription>{formattedRange}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 p-4 space-y-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm">
                  <p className="text-gray-600 dark:text-gray-400">{t('event.startTime')}: {formatDateTime(detailTask.start_time)}</p>
                  <p className="text-gray-600 dark:text-gray-400">{t('event.endTime')}: {formatDateTime(detailTask.end_time)}</p>
                </div>
              </div>
              {detailTask.status && (
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{t('event.status')}: {getStatusLabel(detailTask.status)}</span>
                </div>
              )}
              {detailTask.color && (
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18m9-9H3" />
                  </svg>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span>{t('event.color')}:</span>
                    <span className="h-3 w-3 rounded-full border border-gray-200 dark:border-gray-700" style={{ backgroundColor: detailTask.color }} />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
                </svg>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  알림: {formatReminder(detailTask.reminder_minutes)}
                </span>
              </div>
            </div>

            {detailTask.tag_ids && detailTask.tag_ids.length > 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 p-4 space-y-2">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('tag.title')}</div>
                <div className="flex flex-wrap gap-2">
                  {isTagsLoading ? (
                    <span className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</span>
                  ) : selectedTags.length > 0 ? (
                    selectedTags.map((tag) => (
                      <Badge key={tag.tag_id} variant="outline" className="border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300">
                        <span className="mr-2 h-2.5 w-2.5 rounded-full border border-white/60" style={{ backgroundColor: tag.color }} />
                        {tag.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400">{t('tag.empty')}</span>
                  )}
                </div>
              </div>
            )}

            {detailTask.content && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 p-4 space-y-2">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('event.content')}</div>
                <RichTextEditor
                  initialContent={parseRichContent(detailTask.content)}
                  readOnly={true}
                  showToolbar={false}
                  contentKey={`detail-page-${detailTask.id}-${detailTask.updated_at}`}
                />
              </div>
            )}

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 p-4 space-y-2">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('file.title')}</div>
              {isAttachmentsLoading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
              ) : attachments.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">{t('file.empty')}</p>
              ) : (
                <div className="space-y-1">
                  {attachments.map((attachment) => (
                    <button
                      key={attachment.attachment_id}
                      type="button"
                      onClick={() => handleOpenFile(attachment.file_path)}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                    >
                      <span>{getFileIcon(attachment.mime_type)}</span>
                      <span className="truncate text-gray-700 dark:text-gray-300">{attachment.original_name}</span>
                      <span className="flex-shrink-0 text-gray-400 text-xs">({attachment.file_size_formatted})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {showDuplicatePanel && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 p-4 space-y-3">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('event.duplicateEvent')}</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{t('event.startTime')}</span>
                    <input
                      type="date"
                      value={format(duplicateStartDate, 'yyyy-MM-dd')}
                      onChange={(e) => {
                        const next = parseDateInput(e.target.value)
                        setDuplicateStartDate(next)
                        if (next > duplicateEndDate) setDuplicateEndDate(next)
                      }}
                      className="px-2 py-1.5 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{t('event.endTime')}</span>
                    <input
                      type="date"
                      value={format(duplicateEndDate, 'yyyy-MM-dd')}
                      onChange={(e) => {
                        const next = parseDateInput(e.target.value)
                        setDuplicateEndDate(next)
                        if (next < duplicateStartDate) setDuplicateStartDate(next)
                      }}
                      className="px-2 py-1.5 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setShowDuplicatePanel(false)} disabled={isDuplicating}>
                    {t('event.cancel')}
                  </Button>
                  <Button variant="primary" onClick={handleDuplicate} disabled={isDuplicating}>
                    {isDuplicating ? t('common.loading') : t('event.duplicate')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(true)}>
                {t('event.delete')}
              </Button>
              <Button variant="secondary" onClick={handleExport}>
                {t('event.export')}
              </Button>
              <Button variant="secondary" onClick={() => setShowDuplicatePanel((prev) => !prev)}>
                {t('event.duplicate')}
              </Button>
            </div>
            <Button variant="primary" onClick={handleEdit} className="min-w-[120px]">
              {t('event.edit')}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => !isDeleting && setShowDeleteConfirm(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <p className="text-sm text-gray-700 dark:text-gray-300">{t('event.deleteConfirm')}</p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
                {t('event.cancel')}
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? t('event.deleting') : t('event.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
