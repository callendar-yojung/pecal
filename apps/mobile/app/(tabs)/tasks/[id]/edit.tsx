import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import type { TaskAttachmentItem, TaskStatus } from '../../../../src/lib/types';
import { createStyles } from '../../../../src/styles/createStyles';
import { TaskEditorForm } from '../../../../src/components/task/TaskEditorForm';
import { apiFetch, getApiBaseUrl, invalidateApiCache } from '../../../../src/lib/api';

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
  const [allDay, setAllDay] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState('10');
  const [saving, setSaving] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
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
    if (!task) return;
    setTitle(task.title);
    setContentJson(task.content ?? '');
    setStartTime(task.start_time);
    setEndTime(task.end_time);
    setStatus(task.status ?? 'TODO');
    setColor(task.color ?? '#3B82F6');
    setSelectedTagIds(task.tag_ids ?? (task.tags ?? []).map((tag) => tag.tag_id));
    setAllDay(Boolean(task.is_all_day));
    setReminderMinutes(task.reminder_minutes ? String(task.reminder_minutes) : '10');
  }, [task]);

  useEffect(() => {
    if (!session || !Number.isFinite(taskId) || taskId <= 0) {
      setAttachments([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/tasks/attachments?task_id=${taskId}`, {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        });
        if (!response.ok) {
          if (!cancelled) setAttachments([]);
          return;
        }
        const data = (await response.json()) as { attachments?: TaskAttachmentItem[] };
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
    setSaving(true);
    try {
      await data.updateTask(taskId, {
        title,
        start_time: startTime,
        end_time: endTime,
        content: contentJson || null,
        status,
        color,
        tag_ids: selectedTagIds,
        is_all_day: allDay,
        reminder_minutes: reminderMinutes ? Number(reminderMinutes) : null,
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

  const attachmentItems = useMemo(() => attachments, [attachments]);

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

  return (
    <ScrollView
      style={s.content}
      contentContainerStyle={[s.contentContainer, { paddingTop: Math.max(12, insets.top + 8) }]}
    >
      <TaskEditorForm
        title={title}
        startTime={startTime}
        endTime={endTime}
        status={status}
        color={color}
        selectedTagIds={selectedTagIds}
        availableTags={data.tags}
        allDay={allDay}
        reminderMinutes={reminderMinutes}
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
        onSelectedTagIdsChange={setSelectedTagIds}
        onCreateTag={createTag}
        attachments={attachmentItems}
        uploadingAttachmentIds={uploadingAttachmentIds}
        attachmentMode="saved"
        onPickAttachment={() => void pickAndUploadAttachments()}
        onRemoveAttachment={(attachmentId) => void removeAttachment(attachmentId)}
        onAllDayChange={setAllDay}
        onReminderMinutesChange={setReminderMinutes}
        onRruleChange={() => undefined}
        onContentChange={setContentJson}
        onSubmit={() => void submit()}
        onDelete={remove}
      />
    </ScrollView>
  );
}
