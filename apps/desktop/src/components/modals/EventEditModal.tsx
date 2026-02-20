import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { format, setHours, setMinutes } from 'date-fns'
import { Modal, Button, Input } from '../common'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useModalStore, useCalendarStore, useWorkspaceStore, useAuthStore } from '../../stores'
import { taskApi, tagApi, fileApi, attachmentApi } from '../../api'
import type { TaskStatus, Tag, Attachment } from '../../types'
import { parseApiDateTime } from '../../utils/datetime'
import RichTextEditor from '../editor/RichTextEditor'
import { EMPTY_RICH_CONTENT, parseRichContent, serializeRichContent } from '../../utils/richText'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
const pad = (n: number) => String(n).padStart(2, '0')

const KO_DAYS = ['일', '월', '화', '수', '목', '금', '토']
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return '📄'
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.includes('pdf')) return '📕'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return '📦'
  return '📄'
}

export function EventEditModal() {
  const { t, i18n } = useTranslation()
  const { openedModal, selectedEvent, closeModal } = useModalStore()
  const { setEvents, events } = useCalendarStore()
  const { currentMode, selectedTeamId } = useWorkspaceStore()
  const { user } = useAuthStore()

  const [title, setTitle] = useState('')
  const [contentDoc, setContentDoc] = useState<Record<string, unknown>>(EMPTY_RICH_CONTENT)
  const [eventDate, setEventDate] = useState<Date>(new Date())
  const [startHour, setStartHour] = useState(9)
  const [startMinute, setStartMinute] = useState(0)
  const [endHour, setEndHour] = useState(10)
  const [endMinute, setEndMinute] = useState(0)
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [color, setColor] = useState('#3b82f6')
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [isTagsLoading, setIsTagsLoading] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#6366f1')
  const [isTagCreating, setIsTagCreating] = useState(false)

  // 첨부파일 상태
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loadingAttachments, setLoadingAttachments] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const buildDatetime = (date: Date, hour: number, minute: number) =>
    setMinutes(setHours(date, hour), minute)

  const toMysqlDatetime = (date: Date) =>
    format(date, 'yyyy-MM-dd HH:mm:ss')

  useEffect(() => {
    if (selectedEvent && openedModal === 'EDIT') {
      const start = parseApiDateTime(selectedEvent.start_time)
      const end = parseApiDateTime(selectedEvent.end_time)
      setTitle(selectedEvent.title)
      setContentDoc(parseRichContent(selectedEvent.content))
      setEventDate(start)
      setStartHour(start.getHours())
      setStartMinute(start.getMinutes())
      setEndHour(end.getHours())
      setEndMinute(end.getMinutes())
      setStatus(selectedEvent.status || 'todo')
      setColor(selectedEvent.color || '#3b82f6')
      setSelectedTagIds(selectedEvent.tag_ids || [])
      setNewTagName('')
      setNewTagColor('#6366f1')
      setUploadError(null)
    }
  }, [selectedEvent, openedModal])

  // 첨부파일 로드
  useEffect(() => {
    const loadAttachments = async () => {
      if (!selectedEvent || openedModal !== 'EDIT') return
      setLoadingAttachments(true)
      try {
        const res = await attachmentApi.getAttachments(selectedEvent.id)
        setAttachments(res.attachments || [])
      } catch (err) {
        console.error('Failed to load attachments:', err)
      } finally {
        setLoadingAttachments(false)
      }
    }
    loadAttachments()
  }, [selectedEvent, openedModal])

  const ownerType = currentMode === 'TEAM' ? 'team' : 'personal'
  const ownerId = currentMode === 'TEAM' ? selectedTeamId : user?.memberId

  useEffect(() => {
    const loadTags = async () => {
      if (!ownerId || openedModal !== 'EDIT') return
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

  if (openedModal !== 'EDIT' || !selectedEvent) return null

  const startDatetime = buildDatetime(eventDate, startHour, startMinute)
  const endDatetime = buildDatetime(eventDate, endHour, endMinute)

  const dayNames = i18n.language === 'ko' ? KO_DAYS : EN_DAYS
  const formattedDate =
    i18n.language === 'ko'
      ? `${format(eventDate, 'yyyy')}년 ${format(eventDate, 'M')}월 ${format(eventDate, 'd')}일 (${dayNames[eventDate.getDay()]})`
      : `${dayNames[eventDate.getDay()]}, ${format(eventDate, 'MMMM d, yyyy')}`

  // 파일 선택 즉시 업로드 (task_id 포함 → 백엔드가 자동 연결)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !ownerId) return

    setUploadingFile(true)
    setUploadError(null)

    try {
      await fileApi.uploadFile(file, ownerType, ownerId, selectedEvent.id)
      // 업로드 후 첨부파일 목록 새로고침
      const res = await attachmentApi.getAttachments(selectedEvent.id)
      setAttachments(res.attachments || [])
    } catch (err: any) {
      console.error('File upload error:', err)
      setUploadError(err?.message || t('file.uploadError'))
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteAttachment = async (attachmentId: number) => {
    try {
      await attachmentApi.deleteAttachment(attachmentId)
      setAttachments(prev => prev.filter(a => a.attachment_id !== attachmentId))
    } catch (err) {
      console.error('Delete attachment error:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || isSubmitting) return
    if (endDatetime.getTime() <= startDatetime.getTime()) {
      alert(t('event.invalidTimeRange'))
      return
    }

    setIsSubmitting(true)

    try {
      const backendStatusMap = {
        todo: 'TODO',
        in_progress: 'IN_PROGRESS',
        done: 'DONE',
      } as const

      const backendStatus = backendStatusMap[status]

      const serializedContent = serializeRichContent(contentDoc)

      const updateData = {
        task_id: selectedEvent.id,
        title: title.trim(),
        content: serializedContent || undefined,
        start_time: toMysqlDatetime(startDatetime),
        end_time: toMysqlDatetime(endDatetime),
        color,
        tag_ids: selectedTagIds,
        status: backendStatus,
      }

      await taskApi.updateTask(updateData)

      setEvents(
        events.map((e) =>
          e.id === selectedEvent.id
            ? {
                ...e,
                title: title.trim(),
                content: serializedContent || undefined,
                color,
                tag_ids: selectedTagIds,
                start_time: startDatetime.toISOString(),
                end_time: endDatetime.toISOString(),
                status,
                updated_at: new Date().toISOString(),
              }
            : e
        )
      )

      closeModal()
    } catch (err: any) {
      console.error('Failed to update event:', err)
      const errorMessage = err?.message || err?.toString() || '알 수 없는 오류'
      alert(`일정 수정에 실패했습니다.\n\n상세 오류: ${errorMessage}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const timeSelectClass =
    'px-2 py-1.5 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm tabular-nums'

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !ownerId || isTagCreating) return
    const createdName = newTagName.trim()
    const createdColor = newTagColor

    setIsTagCreating(true)
    try {
      await tagApi.createTag({
        name: createdName,
        color: createdColor,
        owner_type: ownerType,
        owner_id: ownerId,
      })

      setNewTagName('')
      const response = await tagApi.getTags(ownerType, ownerId)
      setTags(response.tags)
      const createdTag = response.tags.find(
        (tag) => tag.name === createdName && tag.color === createdColor
      )
      if (createdTag) {
        setSelectedTagIds((prev) =>
          prev.includes(createdTag.tag_id) ? prev : [...prev, createdTag.tag_id]
        )
      }
    } catch (err) {
      console.error('Failed to create tag:', err)
      alert(t('tag.createError'))
    } finally {
      setIsTagCreating(false)
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={closeModal}
      title={t('event.editEvent')}
      showHeader={false}
      containerClassName="bg-transparent shadow-none"
      contentClassName="p-0"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>{t('event.editEvent')}</CardTitle>
            <CardDescription>{formattedDate}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 p-3 space-y-3">
              <Input
                label={t('event.title')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('event.title')}
                required
                autoFocus
              />

              {/* 시간 선택 */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <select value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} className={timeSelectClass}>
                    {HOURS.map((h) => (
                      <option key={h} value={h}>{pad(h)}</option>
                    ))}
                  </select>
                  <span className="text-gray-500 dark:text-gray-400 font-medium">:</span>
                  <select value={startMinute} onChange={(e) => setStartMinute(Number(e.target.value))} className={timeSelectClass}>
                    {MINUTES.map((m) => (
                      <option key={m} value={m}>{pad(m)}</option>
                    ))}
                  </select>
                </div>
                <span className="text-gray-400 dark:text-gray-500">~</span>
                <div className="flex items-center gap-1">
                  <select value={endHour} onChange={(e) => setEndHour(Number(e.target.value))} className={timeSelectClass}>
                    {HOURS.map((h) => (
                      <option key={h} value={h}>{pad(h)}</option>
                    ))}
                  </select>
                  <span className="text-gray-500 dark:text-gray-400 font-medium">:</span>
                  <select value={endMinute} onChange={(e) => setEndMinute(Number(e.target.value))} className={timeSelectClass}>
                    {MINUTES.map((m) => (
                      <option key={m} value={m}>{pad(m)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 색상 + 상태 한 줄 */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('event.color')}</label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-8 w-10 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-0.5 cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('event.status')}</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="flex-1 px-2 py-1.5 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="todo">{t('status.todo')}</option>
                    <option value="in_progress">{t('status.inProgress')}</option>
                    <option value="done">{t('status.done')}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('event.content')}
                </label>
                <RichTextEditor
                  initialContent={contentDoc}
                  onChange={setContentDoc}
                  contentKey={`edit-${selectedEvent.id}-${selectedEvent.updated_at}`}
                  showToolbar={true}
                />
              </div>
            </div>

            {/* 태그 */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 p-3 space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('tag.title')}</label>
              {isTagsLoading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
              ) : tags.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('tag.empty')}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const selected = selectedTagIds.includes(tag.tag_id)
                    return (
                      <button key={tag.tag_id} type="button" onClick={() => toggleTag(tag.tag_id)} className="focus:outline-none">
                        <Badge
                          variant={selected ? 'secondary' : 'outline'}
                          className={selected
                            ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-200'
                            : 'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300'}
                        >
                          <span className="mr-1.5 h-2 w-2 rounded-full border border-white/60" style={{ backgroundColor: tag.color }} />
                          {tag.name}
                        </Badge>
                      </button>
                    )
                  })}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder={t('tag.namePlaceholder')}
                  className="flex-1 min-w-0 px-2 py-1.5 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="h-8 w-10 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-0.5"
                />
                <Button type="button" size="sm" onClick={handleCreateTag} disabled={!newTagName.trim() || isTagCreating}>
                  {isTagCreating ? '...' : t('tag.add')}
                </Button>
              </div>
            </div>

            {/* 첨부파일 */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('file.title')}</label>
                <input ref={fileInputRef} type="file" onChange={handleFileUpload} disabled={uploadingFile} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-500 transition-colors disabled:opacity-50"
                >
                  {uploadingFile ? t('file.uploading') : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {t('file.add')}
                    </>
                  )}
                </button>
              </div>
              {loadingAttachments ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
              ) : attachments.length > 0 ? (
                <div className="space-y-1">
                  {attachments.map((att) => (
                    <div key={att.attachment_id} className="flex items-center justify-between px-2 py-1.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-xs">
                      <a
                        href={att.file_path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 min-w-0 hover:text-blue-500 transition-colors"
                      >
                        <span>{getFileIcon(att.mime_type)}</span>
                        <span className="truncate text-gray-700 dark:text-gray-300">{att.original_name}</span>
                        <span className="flex-shrink-0 text-gray-400">({att.file_size_formatted})</span>
                      </a>
                      <button type="button" onClick={() => handleDeleteAttachment(att.attachment_id)} className="ml-2 text-red-400 hover:text-red-600 flex-shrink-0">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button type="button" variant="secondary" onClick={closeModal}>
              {t('event.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="min-w-[140px]"
              disabled={isSubmitting || uploadingFile}
            >
              {t('event.save')}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Modal>
  )
}
