import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format, setHours, setMinutes } from 'date-fns'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button, Input, TaskColorPresetPicker } from '../common'
import { useAuthStore, useCalendarStore, useViewStore, useWorkspaceStore } from '../../stores'
import { Badge } from '@/components/ui/badge'
import type { TaskStatus, Tag } from '../../types'
import { tagApi, taskApi } from '../../api'
import RichTextEditor from '../editor/RichTextEditor'
import { EMPTY_RICH_CONTENT, serializeRichContent } from '../../utils/richText'
import { useTaskColorPresets } from '../../hooks'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const
const pad = (n: number) => String(n).padStart(2, '0')
const parseDateInput = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function TaskCreateView() {
  const { t } = useTranslation()
  const { createTaskDate, openTaskDetail, closeTaskCreate } = useViewStore()
  const { selectedWorkspaceId, currentMode, selectedTeamId } = useWorkspaceStore()
  const { user } = useAuthStore()
  const { events, setEvents } = useCalendarStore()

  const baseDate = createTaskDate ?? new Date()
  const [startDate, setStartDate] = useState<Date>(baseDate)
  const [endDate, setEndDate] = useState<Date>(baseDate)
  const [title, setTitle] = useState('')
  const [contentDoc, setContentDoc] = useState<Record<string, unknown>>(EMPTY_RICH_CONTENT)
  const [startHour, setStartHour] = useState(9)
  const [startMinute, setStartMinute] = useState(0)
  const [endHour, setEndHour] = useState(9)
  const [endMinute, setEndMinute] = useState(30)
  const [scheduleMode, setScheduleMode] = useState<'single' | 'recurring'>('single')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [color, setColor] = useState('#3b82f6')
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null)
  const [recurrenceStartDate, setRecurrenceStartDate] = useState(format(baseDate, 'yyyy-MM-dd'))
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(format(baseDate, 'yyyy-MM-dd'))
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([baseDate.getDay()])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [isTagsLoading, setIsTagsLoading] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#6366f1')
  const [isTagCreating, setIsTagCreating] = useState(false)
  const [dateRangeError, setDateRangeError] = useState('')

  const formattedDate = useMemo(
    () => `${format(startDate, 'yyyy-MM-dd')} ~ ${format(endDate, 'yyyy-MM-dd')}`,
    [startDate, endDate]
  )
  const ownerType = currentMode === 'TEAM' ? 'team' : 'personal'
  const ownerId = currentMode === 'TEAM' ? selectedTeamId : user?.memberId
  const { colorOptions, saveCustomColor } = useTaskColorPresets(user?.memberId)
  const isRecurring = scheduleMode === 'recurring'

  useEffect(() => {
    const loadTags = async () => {
      if (!ownerId) return
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
  }, [ownerId, ownerType])

  useEffect(() => {
    const selectedDate = createTaskDate ?? new Date()
    setStartDate(selectedDate)
    setEndDate(selectedDate)
    setRecurrenceStartDate(format(selectedDate, 'yyyy-MM-dd'))
    setRecurrenceEndDate(format(selectedDate, 'yyyy-MM-dd'))
    setRecurrenceWeekdays([selectedDate.getDay()])
    setScheduleMode('single')
  }, [createTaskDate])

  const buildDatetime = (date: Date, hour: number, minute: number) =>
    setMinutes(setHours(date, hour), minute)

  const normalizeDate = (value: string) => {
    const parsed = parseDateInput(value)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed
  }

  const handleStartDateChange = (value: string) => {
    const parsed = normalizeDate(value)
    if (!parsed) return
    setDateRangeError('')
    setStartDate(parsed)
    if (parsed > endDate) {
      setEndDate(parsed)
    }
  }

  const handleEndDateChange = (value: string) => {
    const parsed = normalizeDate(value)
    if (!parsed) return
    setDateRangeError('')
    if (parsed < startDate) {
      setStartDate(parsed)
    }
    setEndDate(parsed)
  }

  const toMysqlDatetime = (date: Date) =>
    format(date, 'yyyy-MM-dd HH:mm:ss')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWorkspaceId || !user || !title.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const backendStatusMap = {
        todo: 'TODO',
        in_progress: 'IN_PROGRESS',
        done: 'DONE',
      } as const
      const startDatetime = buildDatetime(startDate, startHour, startMinute)
      const endDatetime = buildDatetime(endDate, endHour, endMinute)
      setDateRangeError('')
      if (endDatetime.getTime() <= startDatetime.getTime()) {
        setDateRangeError(t('event.invalidTimeRange'))
        alert(t('event.invalidTimeRange'))
        return
      }
      if (isRecurring) {
        if (!recurrenceStartDate || !recurrenceEndDate || recurrenceWeekdays.length === 0) {
          alert('반복 일정의 기간과 요일을 선택해 주세요.')
          return
        }
        if (recurrenceStartDate > recurrenceEndDate) {
          alert('반복 종료일은 시작일보다 빠를 수 없습니다.')
          return
        }
      }
      const serializedContent = serializeRichContent(contentDoc)
      const recurringStart = isRecurring ? parseDateInput(recurrenceStartDate) : startDate
      const startDatetimeForPayload = buildDatetime(recurringStart, startHour, startMinute)
      const endDatetimeForPayload = buildDatetime(recurringStart, endHour, endMinute)
      if (endDatetimeForPayload.getTime() <= startDatetimeForPayload.getTime()) {
        alert(t('event.invalidTimeRange'))
        return
      }

      const response = await taskApi.createTask({
        title: title.trim(),
        content: serializedContent || undefined,
        start_time: toMysqlDatetime(startDatetimeForPayload),
        end_time: toMysqlDatetime(endDatetimeForPayload),
        color,
        reminder_minutes: reminderMinutes,
        tag_ids: selectedTagIds,
        status: backendStatusMap[status],
        recurrence: isRecurring
          ? {
              enabled: true,
              start_date: recurrenceStartDate,
              end_date: recurrenceEndDate,
              weekdays: recurrenceWeekdays,
            }
          : null,
        workspace_id: selectedWorkspaceId,
      })

      const createdTask = {
        id: response.taskId,
        title: title.trim(),
        content: serializedContent || undefined,
        color,
        reminder_minutes: reminderMinutes,
        recurrence: isRecurring
          ? {
              start_date: recurrenceStartDate,
              end_date: recurrenceEndDate,
              weekdays: recurrenceWeekdays,
            }
          : null,
        tag_ids: selectedTagIds,
        start_time: startDatetimeForPayload.toISOString(),
        end_time: endDatetimeForPayload.toISOString(),
        status,
        workspace_id: selectedWorkspaceId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: user.memberId,
        updated_by: user.memberId,
      }

      setEvents([...events, createdTask])
      openTaskDetail(createdTask)
    } catch (err: any) {
      const msg = err?.message || String(err)
      alert(`${t('event.createError')}\n\n${msg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

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

  if (!selectedWorkspaceId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">{t('workspace.select')}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 bg-white dark:bg-gray-900 overflow-y-auto">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>{t('event.create')}</CardTitle>
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

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 p-3 space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">등록 유형 선택</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">일반 일정 또는 반복 일정을 먼저 선택하세요.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setScheduleMode('single')}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    scheduleMode === 'single'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
                      : 'border-gray-300 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  일반 일정
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScheduleMode('recurring')
                    if (!recurrenceWeekdays.length) setRecurrenceWeekdays([new Date().getDay()])
                  }}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    scheduleMode === 'recurring'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
                      : 'border-gray-300 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  반복 일정
                </button>
              </div>
            </div>

            {scheduleMode !== 'recurring' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-gray-700 dark:text-gray-300">시작일</span>
                  <input
                    type="date"
                    value={format(startDate, 'yyyy-MM-dd')}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="px-2 py-1.5 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-gray-700 dark:text-gray-300">종료일</span>
                  <input
                    type="date"
                    value={format(endDate, 'yyyy-MM-dd')}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className="px-2 py-1.5 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
                  />
                </label>
              </div>
            ) : null}
            {dateRangeError ? (
              <p className="text-sm text-red-500 dark:text-red-400">{dateRangeError}</p>
            ) : null}

            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {scheduleMode === 'recurring' ? '반복 시작 시간' : '시작 시간'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {scheduleMode === 'recurring' ? '반복 일정 시작 시각' : '일정 시작 날짜와 시각'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} className="px-2 py-1.5 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm">
                {HOURS.map((h) => (
                  <option key={h} value={h}>{pad(h)}</option>
                ))}
              </select>
              <span>:</span>
              <select value={startMinute} onChange={(e) => setStartMinute(Number(e.target.value))} className="px-2 py-1.5 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm">
                {MINUTES.map((m) => (
                  <option key={m} value={m}>{pad(m)}</option>
                ))}
              </select>
              <span className="text-gray-400">~</span>
              <select value={endHour} onChange={(e) => setEndHour(Number(e.target.value))} className="px-2 py-1.5 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm">
                {HOURS.map((h) => (
                  <option key={h} value={h}>{pad(h)}</option>
                ))}
              </select>
              <span>:</span>
              <select value={endMinute} onChange={(e) => setEndMinute(Number(e.target.value))} className="px-2 py-1.5 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm">
                {MINUTES.map((m) => (
                  <option key={m} value={m}>{pad(m)}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
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
                onChange={(e) =>
                  setReminderMinutes(e.target.value === '' ? null : Number(e.target.value))
                }
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

            {scheduleMode === 'recurring' ? (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">반복 일정</label>
                </div>
                <>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    기간과 요일을 선택하면 해당 기간 동안 반복됩니다.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-gray-600 dark:text-gray-400">반복 시작일</span>
                      <input
                        type="date"
                        value={recurrenceStartDate}
                        onChange={(e) => {
                          const value = e.target.value
                          setRecurrenceStartDate(value)
                          if (recurrenceEndDate && value > recurrenceEndDate) {
                            setRecurrenceEndDate(value)
                          }
                        }}
                        className="px-2 py-1.5 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-gray-600 dark:text-gray-400">반복 종료일</span>
                      <input
                        type="date"
                        value={recurrenceEndDate}
                        min={recurrenceStartDate || undefined}
                        onChange={(e) => setRecurrenceEndDate(e.target.value)}
                        className="px-2 py-1.5 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAY_LABELS.map((label, dayIndex) => {
                      const selected = recurrenceWeekdays.includes(dayIndex)
                      return (
                        <button
                          key={`${label}-${dayIndex}`}
                          type="button"
                          onClick={() =>
                            setRecurrenceWeekdays((prev) =>
                              prev.includes(dayIndex)
                                ? prev.filter((day) => day !== dayIndex)
                                : [...prev, dayIndex].sort((a, b) => a - b)
                            )
                          }
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                            selected
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </>
              </div>
            ) : null}
            <TaskColorPresetPicker
              color={color}
              colorOptions={colorOptions}
              onColorChange={setColor}
              onSaveCustomColor={saveCustomColor}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('event.content')}
              </label>
              <RichTextEditor
                initialContent={contentDoc}
                onChange={setContentDoc}
                contentKey={`create-page-${format(startDate, 'yyyy-MM-dd')}-${format(endDate, 'yyyy-MM-dd')}`}
                showToolbar={true}
              />
            </div>

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
                          className={
                            selected
                              ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-200'
                              : 'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300'
                          }
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
          </CardContent>
          <CardFooter className="justify-between">
            <Button type="button" variant="secondary" onClick={closeTaskCreate}>
              {t('event.cancel')}
            </Button>
            <Button type="submit" variant="primary" className="min-w-[140px]" disabled={isSubmitting}>
              {isSubmitting ? t('workspace.creating') : t('event.save')}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
