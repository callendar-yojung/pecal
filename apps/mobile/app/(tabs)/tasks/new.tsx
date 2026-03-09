import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaybeMobileApp } from '../../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../../src/contexts/ThemeContext';
import { defaultTaskRangeByDate } from '../../../src/lib/date';
import {
  ensureAttachmentAllowed,
  formatUploadLimitMessage,
  pickAttachments,
  pickImageAttachments,
  uploadTaskAttachment,
  type PickedAttachment,
} from '../../../src/lib/file-upload';
import { isUploadLimitError } from '../../../src/lib/plan-limits';
import type { TaskAttachmentItem, TaskStatus } from '../../../src/lib/types';
import { createStyles } from '../../../src/styles/createStyles';
import { TaskEditorForm } from '../../../src/components/task/TaskEditorForm';
import { apiFetch, invalidateApiCache } from '../../../src/lib/api';

export default function TaskCreatePage() {
  const params = useLocalSearchParams<{ date?: string }>();
  const app = useMaybeMobileApp();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const initialDate =
    typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? new Date(`${params.date}T09:00:00`)
      : new Date();
  const [title, setTitle] = useState('');
  const [contentJson, setContentJson] = useState('');
  const [range, setRange] = useState(defaultTaskRangeByDate(initialDate));
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [color, setColor] = useState('#3B82F6');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [allDay, setAllDay] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState('10');
  const [saving, setSaving] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PickedAttachment[]>([]);
  const [uploadingLocalIds, setUploadingLocalIds] = useState<string[]>([]);

  if (!app) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>앱 초기화 중...</Text>
      </View>
    );
  }

  const { auth, data } = app;
  const session = auth.session;
  useEffect(() => {
    setRange(defaultTaskRangeByDate(initialDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.date]);

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!data.selectedWorkspace) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>워크스페이스를 선택하세요.</Text>
      </View>
    );
  }
  const workspace = data.selectedWorkspace;

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const created = await data.createTaskWithInput({
        title,
        start_time: range.start,
        end_time: range.end,
        content: contentJson || null,
        status,
        color,
        tag_ids: selectedTagIds,
        is_all_day: allDay,
        reminder_minutes: reminderMinutes ? Number(reminderMinutes) : null,
      });
      if (!created.success) return;
      if (created.taskId && pendingAttachments.length > 0) {
        setUploadingLocalIds(pendingAttachments.map((item) => item.localId));
        for (const attachment of pendingAttachments) {
          await uploadTaskAttachment({
            session,
            workspace,
            taskId: created.taskId,
            attachment,
          });
        }
      } else if (!created.taskId && pendingAttachments.length > 0) {
        Alert.alert('첨부파일 보류', '오프라인으로 일정이 임시 저장되어 첨부파일은 아직 업로드되지 않았습니다.');
      }
      router.replace('/tasks');
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
      } else {
        Alert.alert('오류', error instanceof Error ? error.message : '일정을 저장하지 못했습니다.');
      }
    } finally {
      setUploadingLocalIds([]);
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

  const attachmentItems = useMemo(
    () =>
      pendingAttachments.map((item) => ({
        attachment_id: item.localId,
        file_id: item.localId,
        original_name: item.name,
        file_size: item.size,
        file_size_formatted: undefined,
        preview_uri: item.uri,
        mime_type: item.mimeType,
      })),
    [pendingAttachments],
  );

  const pickNewAttachments = async () => {
    const handlePicked = async (picked: PickedAttachment[]) => {
      if (!picked.length) return;
      const accepted: typeof picked = [];
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
        accepted.push(asset);
      }
      if (!accepted.length) return;
      setPendingAttachments((prev) => {
        const seen = new Set(prev.map((item) => item.localId));
        return [...prev, ...accepted.filter((item) => !seen.has(item.localId))];
      });
    };

    const openPicker = (mode: 'image' | 'file') => {
      void (async () => {
        try {
          const picked = mode === 'image' ? await pickImageAttachments() : await pickAttachments();
          await handlePicked(picked);
        } catch (error) {
          Alert.alert('오류', error instanceof Error ? error.message : '파일을 선택하지 못했습니다.');
        }
      })();
    };

    Alert.alert('첨부 추가', '추가할 항목을 선택하세요.', [
      { text: '취소', style: 'cancel' },
      { text: '이미지', onPress: () => openPicker('image') },
      { text: '파일', onPress: () => openPicker('file') },
    ]);
  };

  const removePendingAttachment = (attachmentId: number | string) =>
    setPendingAttachments((prev) => prev.filter((item) => item.localId !== String(attachmentId)));

  return (
    <ScrollView
      style={s.content}
      contentContainerStyle={[s.contentContainer, { paddingTop: Math.max(12, insets.top + 8) }]}
    >
      <TaskEditorForm
        title={title}
        startTime={range.start}
        endTime={range.end}
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
        submitLabel="일정 만들기"
        onTitleChange={setTitle}
        onStartTimeChange={(value) => setRange((prev) => ensureRange(value, prev.end))}
        onEndTimeChange={(value) => setRange((prev) => ensureRange(prev.start, value))}
        onStatusChange={setStatus}
        onColorChange={setColor}
        onSelectedTagIdsChange={setSelectedTagIds}
        onCreateTag={createTag}
        attachments={attachmentItems}
        uploadingAttachmentIds={uploadingLocalIds}
        attachmentMode="pending"
        onPickAttachment={() => void pickNewAttachments()}
        onRemoveAttachment={removePendingAttachment}
        onAllDayChange={setAllDay}
        onReminderMinutesChange={setReminderMinutes}
        onRruleChange={() => undefined}
        onContentChange={setContentJson}
        onSubmit={() => void submit()}
      />
    </ScrollView>
  );
}
