import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { format, setHours, setMinutes } from 'date-fns'
import { Button, Input, TaskColorPresetPicker } from '../common'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useCalendarStore, useWorkspaceStore, useAuthStore, useViewStore } from '../../stores'
import { taskApi, tagApi, fileApi, attachmentApi } from '../../api'
import type { TaskStatus, Tag, Attachment } from '../../types'
import { parseApiDateTime } from '../../utils/datetime'
import RichTextEditor from '../editor/RichTextEditor'
import { EMPTY_RICH_CONTENT, parseRichContent, serializeRichContent } from '../../utils/richText'
import { useTaskColorPresets } from '../../hooks'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
const pad = (n: number) => String(n).padStart(2, '0')
const parseDateInput = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

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

export function TaskEditView() {
  const { t, i18n } = useTranslation()
  const { editTask, closeTaskEdit, openTaskDetail } = useViewStore()
  const { setEvents, events } = useCalendarStore()
  const { currentMode, selectedTeamId } = useWorkspaceStore()
  const { user } = useAuthStore()

  const [title, setTitle] = useState('')
  const [contentDoc, setContentDoc] = useState<Record<string, unknown>>(EMPTY_RICH_CONTENT)
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [startHour, setStartHour] = useState(9)
  const [startMinute, setStartMinute] = useState(0)
  const [endHour, setEndHour] = useState(10)
  const [endMinute, setEndMinute] = useState(0)
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [color, setColor] = useState('#3b82f6')
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(10)
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])

  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const buildDatetime = (date: Date, hour: number, minute: number) =>
    setMinutes(setHours(date, hour), minute)

  const toMysqlDatetime = (date: Date) =>
    format(date, 'yyyy-MM-dd HH:mm:ss')

  useEffect(() => {
    if (editTask) {
      const start = parseApiDateTime(editTask.start_time)
      const end = parseApiDateTime(editTask.end_time)
      setTitle(editTask.title)
      setContentDoc(parseRichContent(editTask.content))
      setStartDate(start)
      setEndDate(end)
      setStartHour(start.getHours())
      setStartMinute(start.getMinutes())
      setEndHour(end.getHours())
      setEndMinute(end.getMinutes())
      setStatus(editTask.status || 'todo')
      setColor(editTask.color || '#3b82f6')
      setReminderMinutes(
        typeof editTask.reminder_minutes === 'number'
          ? editTask.reminder_minutes
          : null
      )
      setSelectedTagIds(editTask.tag_ids || [])
    }
  }, [editTask])

  useEffect(() => {
    const loadAttachments = async () => {
      if (!editTask) return
      try {
        const res = await attachmentApi.getAttachments(editTask.id)
        setAttachments(res.attachments || [])
      } catch (err) {
        console.error('Failed to load attachments:', err)
      }
    }
    loadAttachments()
  }, [editTask])

  const ownerType = currentMode === 'TEAM' ? 'team' : 'personal'
  const ownerId = currentMode === 'TEAM' ? selectedTeamId : user?.memberId
  const { colorOptions, saveCustomColor } = useTaskColorPresets(user?.memberId)

  useEffect(() => {
    const loadTags = async () => {
      if (!ownerId) return
      try {
        const response = await tagApi.getTags(ownerType, ownerId)
        setTags(response.tags)
      } catch (err) {
        console.error('Failed to load tags:', err)
      }
    }
    loadTags()
  }, [ownerType, ownerId])

  if (!editTask) return (
    <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <p className="text-gray-500">{t('taskDetail.noTask')}</p>
    </div>
  )

  const startDatetime = buildDatetime(startDate, startHour, startMinute)
  const endDatetime = buildDatetime(endDate, endHour, endMinute)

  const dayNames = i18n.language === 'ko' ? KO_DAYS : EN_DAYS
  const formattedDate =
    i18n.language === 'ko'
      ? `${format(startDate, 'yyyy')}년 ${format(startDate, 'M')}월 ${format(startDate, 'd')}일 (${dayNames[startDate.getDay()]}) ~ ${format(endDate, 'yyyy')}년 ${format(endDate, 'M')}월 ${format(endDate, 'd')}일 (${dayNames[endDate.getDay()]})`
      : `${dayNames[startDate.getDay()]}, ${format(startDate, 'MMMM d, yyyy')} ~ ${dayNames[endDate.getDay()]}, ${format(endDate, 'MMMM d, yyyy')}`

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !ownerId) return
    setUploadingFile(true)
    try {
      await fileApi.uploadFile(file, ownerType, ownerId, editTask.id)
      const res = await attachmentApi.getAttachments(editTask.id)
      setAttachments(res.attachments || [])
    } catch (err: any) {
      console.error('File upload error:', err)
      alert(err?.message || t('file.uploadError'))
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
      const serializedContent = serializeRichContent(contentDoc)
      const updateData = {
        task_id: editTask.id,
        title: title.trim(),
        content: serializedContent || undefined,
        start_time: toMysqlDatetime(startDatetime),
        end_time: toMysqlDatetime(endDatetime),
        color,
        reminder_minutes: reminderMinutes,
        tag_ids: selectedTagIds,
        status: backendStatusMap[status],
      }
      await taskApi.updateTask(updateData)
      const updatedTask = {
        ...editTask,
        title: title.trim(),
        content: serializedContent || undefined,
        color,
        reminder_minutes: reminderMinutes,
        tag_ids: selectedTagIds,
        start_time: startDatetime.toISOString(),
        end_time: endDatetime.toISOString(),
        status,
        updated_at: new Date().toISOString(),
      }
      setEvents(events.map((e) => e.id === editTask.id ? updatedTask : e))
      openTaskDetail(updatedTask)
    } catch (err: any) {
      console.error('Failed to update event:', err)
      alert(`일정 수정에 실패했습니다.

${err?.message || String(err)}`)
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

  return (
    <div className="flex-1 p-6 bg-white dark:bg-gray-900 overflow-y-auto">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>{t('event.editEvent')}</CardTitle>
            <CardDescription>{formattedDate}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label={t('event.title')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('event.title')}
              required
              autoFocus
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-gray-700 dark:text-gray-300">시작일</span>
                <input
                  type="date"
                  value={format(startDate, 'yyyy-MM-dd')}
                  onChange={(e) => setStartDate(parseDateInput(e.target.value))}
                  className={timeSelectClass}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-gray-700 dark:text-gray-300">종료일</span>
                <input
                  type="date"
                  value={format(endDate, 'yyyy-MM-dd')}
                  onChange={(e) => setEndDate(parseDateInput(e.target.value))}
                  className={timeSelectClass}
                />
              </label>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} className={timeSelectClass}>
                {HOURS.map((h) => <option key={h} value={h}>{pad(h)}</option>)}
              </select>
              <span>:</span>
              <select value={startMinute} onChange={(e) => setStartMinute(Number(e.target.value))} className={timeSelectClass}>
                {MINUTES.map((m) => <option key={m} value={m}>{pad(m)}</option>)}
              </select>
              <span className="text-gray-400">~</span>
              <select value={endHour} onChange={(e) => setEndHour(Number(e.target.value))} className={timeSelectClass}>
                {HOURS.map((h) => <option key={h} value={h}>{pad(h)}</option>)}
              </select>
              <span>:</span>
              <select value={endMinute} onChange={(e) => setEndMinute(Number(e.target.value))} className={timeSelectClass}>
                {MINUTES.map((m) => <option key={m} value={m}>{pad(m)}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-10 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-0.5 cursor-pointer"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="px-2 py-1.5 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
              >
                <option value="todo">{t('status.todo')}</option>
                <option value="in_progress">{t('status.inProgress')}</option>
                <option value="done">{t('status.done')}</option>
              </select>
              <select
                value={reminderMinutes === null ? '' : String(reminderMinutes)}
                onChange={(e) => setReminderMinutes(e.target.value === '' ? null : Number(e.target.value))}
                className="px-2 py-1.5 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
              >
                <option value="">알림 없음</option>
                <option value="0">정시</option>
                <option value="5">5분 전</option>
                <option value="10">10분 전</option>
                <option value="15">15분 전</option>
                <option value="30">30분 전</option>
                <option value="60">1시간 전</option>
                <option value="1440">1일 전</option>
              </select>
            </div>
            <TaskColorPresetPicker
              color={color}
              colorOptions={colorOptions}
              onColorChange={setColor}
              onSaveCustomColor={saveCustomColor}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('event.content')}</label>
              <RichTextEditor
                initialContent={contentDoc}
                onChange={setContentDoc}
                contentKey={`edit-page-${editTask.id}-${editTask.updated_at}`}
                showToolbar={true}
              />
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 p-3 space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('tag.title')}</label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.tag_id)
                  return (
                    <button key={tag.tag_id} type="button" onClick={() => toggleTag(tag.tag_id)} className="focus:outline-none">
                      <Badge variant={selected ? 'secondary' : 'outline'}>
                        <span className="mr-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                        {tag.name}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('file.title')}</label>
                <input ref={fileInputRef} type="file" onChange={handleFileUpload} disabled={uploadingFile} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-blue-500">
                  {uploadingFile ? t('file.uploading') : t('file.add')}
                </button>
              </div>
              <div className="space-y-1">
                {attachments.map((att) => (
                  <div key={att.attachment_id} className="flex items-center justify-between text-xs">
                    <span className="truncate text-gray-700 dark:text-gray-300">{getFileIcon(att.mime_type)} {att.original_name}</span>
                    <button type="button" onClick={() => handleDeleteAttachment(att.attachment_id)} className="text-red-400">삭제</button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button type="button" variant="secondary" onClick={closeTaskEdit}>
              {t('event.cancel')}
            </Button>
            <Button type="submit" variant="primary" className="min-w-[140px]" disabled={isSubmitting}>
              {isSubmitting ? t('workspace.creating') : t('event.save')}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )}
