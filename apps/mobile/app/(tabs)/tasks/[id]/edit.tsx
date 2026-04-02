import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaybeMobileApp } from '../../../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../../../src/contexts/ThemeContext';
import {
  deleteTaskAttachment,
  ensureAttachmentAllowed,
  formatUploadLimitMessage,
  pickAttachments,
  pickImageAttachments,
  uploadTaskAttachment,
} from '../../../../src/lib/file-upload';
import { isUploadLimitError } from '../../../../src/lib/plan-limits';
import type { CategoryItem, TaskAttachmentItem, TaskStatus } from '../../../../src/lib/types';
import { createStyles } from '../../../../src/styles/createStyles';
import { TaskEditorForm } from '../../../../src/components/task/TaskEditorForm';
import { apiFetch, invalidateApiCache } from '../../../../src/lib/api';
import {
  loadTaskColorOptionsForMember,
  saveTaskColorPresetForMember,
} from '../../../../src/lib/task-color-presets';

function normalizeTaskStatus(status?: TaskStatus): 'TODO' | 'DONE' {
  return status === 'DONE' ? 'DONE' : 'TODO';
}

export default function TaskEditPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useMaybeMobileApp();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const taskId = Number(id);
  const [title, setTitle] = useState('');
  const [contentJson, setContentJson] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [color, setColor] = useState('#3B82F6');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [allDay, setAllDay] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState('');
  const [scheduleMode, setScheduleMode] = useState<'single' | 'recurring'>('single');
  const [recurrenceStartDate, setRecurrenceStartDate] = useState('');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  const [colorOptions, setColorOptions] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachmentItem[]>([]);
  const [uploadingAttachmentIds, setUploadingAttachmentIds] = useState<string[]>([]);

  if (!app) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>앱 초기화 중...</Text>
      </View>
    );
  }

  const { auth, data } = app;
  const session = auth.session;
  const task = data.tasks.find((item) => item.id === taskId) ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setColorOptions([]);
      return;
    }
    void (async () => {
      const options = await loadTaskColorOptionsForMember(session);
      if (!cancelled) setColorOptions(options);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    if (!session || !data.selectedWorkspace) {
      setCategories([]);
      return;
    }
    void (async () => {
      const ownerType = data.selectedWorkspace?.type;
      const ownerId = data.selectedWorkspace?.owner_id;
      if (!ownerType || !ownerId) return;
      const response = await apiFetch<{ categories?: CategoryItem[] }>(
        `/api/categories?owner_type=${ownerType}&owner_id=${ownerId}`,
        session,
      );
      if (!cancelled) setCategories(Array.isArray(response.categories) ? response.categories : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, data.selectedWorkspace]);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setContentJson(task.content ?? '');
    setStartTime(task.start_time);
    setEndTime(task.end_time);
    setStatus(normalizeTaskStatus(task.status));
    setColor(task.color ?? '#3B82F6');
    const sourceTagIds = task.tag_ids ?? (task.tags ?? []).map((tag) => tag.tag_id);
    setSelectedTagIds(sourceTagIds);
    setSelectedCategoryId(task.category_id ?? task.category?.category_id ?? null);
    setAllDay(Boolean(task.is_all_day));
    setReminderMinutes(task.reminder_minutes == null ? '' : String(task.reminder_minutes));
    const recurring = Boolean(task.recurrence && task.recurrence.weekdays?.length);
    setScheduleMode(recurring ? 'recurring' : 'single');
    setRecurrenceStartDate(task.recurrence?.start_date ?? task.start_time.slice(0, 10));
    setRecurrenceEndDate(task.recurrence?.end_date ?? task.end_time.slice(0, 10));
    setRecurrenceWeekdays(task.recurrence?.weekdays ?? [new Date(task.start_time).getDay()]);
  }, [task]);

  useEffect(() => {
    if (!session || !Number.isFinite(taskId) || taskId <= 0) {
      setAttachments([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<{ attachments?: TaskAttachmentItem[] }>(
          `/api/tasks/attachments?task_id=${taskId}`,
          session,
        );
        if (!cancelled) setAttachments(Array.isArray(data.attachments) ? data.attachments : []);
      } catch {
        if (!cancelled) setAttachments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, taskId]);

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!data.selectedWorkspace) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>워크스페이스를 선택하세요.</Text>
      </View>
    );
  }
  const workspace = data.selectedWorkspace;
  if (!Number.isFinite(taskId) || taskId <= 0 || !task) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>일정을 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const submit = async () => {
    if (saving) return;
    if (!title.trim()) {
      Alert.alert('입력 확인', '일정 제목을 입력하세요.');
      return;
    }
    const isRecurring = scheduleMode === 'recurring';
    if (isRecurring) {
      if (!recurrenceStartDate || !recurrenceEndDate) {
        Alert.alert('입력 확인', '반복 시작일과 종료일을 선택하세요.');
        return;
      }
      if (recurrenceStartDate > recurrenceEndDate) {
        Alert.alert('입력 확인', '반복 종료일은 반복 시작일보다 빠를 수 없습니다.');
        return;
      }
      if (!recurrenceWeekdays.length) {
        Alert.alert('입력 확인', '반복 요일을 1개 이상 선택하세요.');
        return;
      }
    }

    const startTimePart = (startTime.split('T')[1] ?? '09:00:00').slice(0, 8);
    const endTimePart = (endTime.split('T')[1] ?? '09:30:00').slice(0, 8);
    const payloadStart = isRecurring ? `${recurrenceStartDate}T${startTimePart || '09:00:00'}` : startTime;
    const payloadEnd = isRecurring ? `${recurrenceStartDate}T${endTimePart || '09:30:00'}` : endTime;
    const parsedReminderValue =
      reminderMinutes === '' ? null : Number(reminderMinutes);
    const reminderValue = Number.isFinite(parsedReminderValue)
      ? Math.trunc(parsedReminderValue as number)
      : null;
    setSaving(true);
    try {
      await data.updateTask(taskId, {
        title,
        start_time: payloadStart,
        end_time: payloadEnd,
        content: contentJson || null,
        status: normalizeTaskStatus(status),
        color,
        category_id: selectedCategoryId,
        tag_ids: selectedTagIds,
        is_all_day: allDay,
        reminder_minutes: reminderValue,
        recurrence: isRecurring
          ? {
              enabled: true,
              start_date: recurrenceStartDate,
              end_date: recurrenceEndDate,
              weekdays: recurrenceWeekdays,
            }
          : null,
      });
      router.replace(`/tasks/${taskId}`);
    } catch (error) {
      Alert.alert('오류', error instanceof Error ? error.message : '일정을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const ensureRange = (nextStart: string, nextEnd: string) => {
    const start = new Date(nextStart);
    const end = new Date(nextEnd);
    if (Number.isNaN(start.getTime())) return { start: nextStart, end: nextEnd };
    if (Number.isNaN(end.getTime()) || end <= start) {
      const adjusted = new Date(start);
      adjusted.setMinutes(adjusted.getMinutes() + 30);
      return {
        start: nextStart,
        end: `${adjusted.getFullYear()}-${String(adjusted.getMonth() + 1).padStart(2, '0')}-${String(adjusted.getDate()).padStart(2, '0')}T${String(adjusted.getHours()).padStart(2, '0')}:${String(adjusted.getMinutes()).padStart(2, '0')}:${String(adjusted.getSeconds()).padStart(2, '0')}`,
      };
    }
    return { start: nextStart, end: nextEnd };
  };

  const createTag = async (name: string, tagColor: string) => {
    setCreatingTag(true);
    try {
      const result = await apiFetch<{ tag_id: number }>('/api/tags', session, {
        method: 'POST',
        body: JSON.stringify({
          name,
          color: tagColor,
          owner_type: workspace.type,
          owner_id: workspace.owner_id,
        }),
      });
      setSelectedTagIds((prev) => (prev.includes(result.tag_id) ? prev : [...prev, result.tag_id]));
      invalidateApiCache(`tags:${workspace.type}:${workspace.owner_id}`);
      await data.loadDashboard(workspace);
    } finally {
      setCreatingTag(false);
    }
  };

  const attachmentItems = attachments;

  const pickAndUploadAttachments = async () => {
    const handlePicked = async (picked: Awaited<ReturnType<typeof pickAttachments>>) => {
      if (!picked.length) return;
      for (const asset of picked) {
        const limit = await ensureAttachmentAllowed(session, workspace, asset.size);
        if (!limit.allowed) {
          Alert.alert(
            '업로드 제한',
            formatUploadLimitMessage({
              reason: limit.reason,
              maxFileSizeBytes: limit.maxFileSizeBytes,
              usedBytes: limit.usedBytes,
              limitBytes: limit.limitBytes,
              planName: limit.planName,
            }),
          );
          continue;
        }
        setUploadingAttachmentIds((prev) => [...prev, asset.localId]);
        try {
          const uploaded = await uploadTaskAttachment({
            session,
            workspace,
            taskId,
            attachment: asset,
          });
          setAttachments((prev) => [uploaded, ...prev.filter((item) => item.file_id !== uploaded.file_id)]);
        } finally {
          setUploadingAttachmentIds((prev) => prev.filter((id) => id !== asset.localId));
        }
      }
    };

    const openPicker = (mode: 'image' | 'file') => {
      void (async () => {
        try {
          const picked = mode === 'image' ? await pickImageAttachments() : await pickAttachments();
          await handlePicked(picked);
        } catch (error) {
          if (isUploadLimitError(error)) {
            const details = (error as { details?: Record<string, unknown> }).details ?? {};
            Alert.alert(
              '업로드 제한',
              formatUploadLimitMessage({
                reason: typeof details.error === 'string' ? details.error : '파일 업로드 제한에 걸렸습니다.',
                maxFileSizeBytes: Number(details.max_file_size_bytes ?? 0),
                usedBytes: Number(details.used_bytes ?? 0),
                limitBytes: Number(details.limit_bytes ?? 0),
                planName: '현재 플랜',
              }),
            );
            return;
          }
          Alert.alert('오류', error instanceof Error ? error.message : '파일을 업로드하지 못했습니다.');
        }
      })();
    };

    Alert.alert('첨부 추가', '추가할 항목을 선택하세요.', [
      { text: '취소', style: 'cancel' },
      { text: '이미지', onPress: () => openPicker('image') },
      { text: '파일', onPress: () => openPicker('file') },
    ]);
  };

  const removeAttachment = async (attachmentId: number | string) => {
    const numericId = Number(attachmentId);
    if (!Number.isFinite(numericId) || numericId <= 0) return;
    try {
      await deleteTaskAttachment({ session, attachmentId: numericId });
      setAttachments((prev) => prev.filter((item) => item.attachment_id !== numericId));
    } catch (error) {
      Alert.alert('오류', error instanceof Error ? error.message : '첨부파일을 삭제하지 못했습니다.');
    }
  };

  const remove = async () => {
    Alert.alert('일정 삭제', '이 일정을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await data.deleteTask(taskId);
              router.replace('/tasks');
            } catch (error) {
              Alert.alert('오류', error instanceof Error ? error.message : '일정을 삭제하지 못했습니다.');
            }
          })();
        },
      },
    ]);
  };

  const saveCustomColor = async (value: string) => {
    if (!session) return null;
    const { saved, options } = await saveTaskColorPresetForMember(session, value);
    setColorOptions(options);
    return saved;
  };

  const createCategory = async (name: string, categoryColor: string) => {
    const result = await apiFetch<{ category_id: number }>('/api/categories', session, {
      method: 'POST',
      body: JSON.stringify({
        name,
        color: categoryColor,
        owner_type: workspace.type,
        owner_id: workspace.owner_id,
      }),
    });
    setSelectedCategoryId(result.category_id);
    setCategories((prev) => {
      if (prev.some((item) => item.category_id === result.category_id)) return prev;
      return [...prev, { category_id: result.category_id, name, color: categoryColor }];
    });
  };

  const updateCategory = async (categoryId: number, name: string, categoryColor: string) => {
    await apiFetch(`/api/categories/${categoryId}`, session, {
      method: 'PATCH',
      body: JSON.stringify({ name, color: categoryColor }),
    });
    setCategories((prev) =>
      prev.map((item) =>
        item.category_id === categoryId ? { ...item, name, color: categoryColor } : item
      )
    );
  };

  const deleteCategory = async (categoryId: number) => {
    await apiFetch(`/api/categories/${categoryId}`, session, { method: 'DELETE' });
    setCategories((prev) => prev.filter((item) => item.category_id !== categoryId));
    setSelectedCategoryId((prev) => (prev === categoryId ? null : prev));
  };

  return (
    <ScrollView
      style={s.content}
      contentContainerStyle={[s.contentContainer, { paddingTop: Math.max(12, insets.top + 8) }]}
    >
      {scheduleMode === 'recurring' ? (
        <View style={[s.panel, { borderRadius: 16, gap: 6, marginBottom: 10 }]}>
          <Text style={s.formTitle}>반복 일정 수정</Text>
          <Text style={s.itemMeta}>기간/요일/반복 시간을 수정하는 전용 화면입니다.</Text>
        </View>
      ) : null}
      <TaskEditorForm
        scheduleMode={scheduleMode}
        title={title}
        startTime={startTime}
        endTime={endTime}
        status={status}
        color={color}
        selectedCategoryId={selectedCategoryId}
        availableCategories={categories}
        colorOptions={colorOptions}
        selectedTagIds={selectedTagIds}
        availableTags={data.tags}
        allDay={allDay}
        reminderMinutes={reminderMinutes}
        showRecurrenceControls={scheduleMode === 'recurring'}
        hideRecurrenceToggle={scheduleMode === 'recurring'}
        recurrenceEnabled={scheduleMode === 'recurring'}
        recurrenceStartDate={recurrenceStartDate}
        recurrenceEndDate={recurrenceEndDate}
        recurrenceWeekdays={recurrenceWeekdays}
        rrule=""
        contentJson={contentJson}
        saving={saving}
        creatingTag={creatingTag}
        submitLabel="일정 저장"
        onTitleChange={setTitle}
        onStartTimeChange={(value) => {
          const next = ensureRange(value, endTime);
          setStartTime(next.start);
          setEndTime(next.end);
        }}
        onEndTimeChange={(value) => {
          const next = ensureRange(startTime, value);
          setStartTime(next.start);
          setEndTime(next.end);
        }}
        onStatusChange={setStatus}
        onColorChange={setColor}
        onSaveCustomColor={saveCustomColor}
        onCategoryChange={setSelectedCategoryId}
        onCreateCategory={createCategory}
        onUpdateCategory={updateCategory}
        onDeleteCategory={deleteCategory}
        onSelectedTagIdsChange={setSelectedTagIds}
        onCreateTag={createTag}
        attachments={attachmentItems}
        uploadingAttachmentIds={uploadingAttachmentIds}
        attachmentMode="saved"
        onPickAttachment={() => void pickAndUploadAttachments()}
        onRemoveAttachment={(attachmentId) => void removeAttachment(attachmentId)}
        onAllDayChange={setAllDay}
        onReminderMinutesChange={setReminderMinutes}
        onRecurrenceStartDateChange={setRecurrenceStartDate}
        onRecurrenceEndDateChange={setRecurrenceEndDate}
        onRecurrenceWeekdaysChange={setRecurrenceWeekdays}
        onRruleChange={() => undefined}
        onContentChange={setContentJson}
        onSubmit={() => void submit()}
        onDelete={remove}
      />
    </ScrollView>
  );
}
