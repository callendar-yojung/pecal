import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaybeMobileApp } from '../../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../../src/contexts/ThemeContext';
import { defaultTaskRangeByDate } from '../../../src/lib/date';
import type { TaskStatus } from '../../../src/lib/types';
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

  if (!app) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>앱 초기화 중...</Text>
      </View>
    );
  }

  const { auth, data } = app;
  useEffect(() => {
    setRange(defaultTaskRangeByDate(initialDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.date]);

  if (!auth.session) return <Redirect href="/(auth)/login" />;
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
      if (!created) return;
      router.replace('/tasks');
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
      const result = await apiFetch<{ tag_id: number }>('/api/tags', auth.session, {
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
        onAllDayChange={setAllDay}
        onReminderMinutesChange={setReminderMinutes}
        onRruleChange={() => undefined}
        onContentChange={setContentJson}
        onSubmit={() => void submit()}
      />
    </ScrollView>
  );
}
