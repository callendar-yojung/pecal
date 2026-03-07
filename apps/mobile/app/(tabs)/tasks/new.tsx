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
  const [allDay, setAllDay] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState('10');
  const [saving, setSaving] = useState(false);

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
        allDay={allDay}
        reminderMinutes={reminderMinutes}
        rrule=""
        contentJson={contentJson}
        saving={saving}
        submitLabel="일정 만들기"
        onTitleChange={setTitle}
        onStartTimeChange={(value) => setRange((prev) => ({ ...prev, start: value }))}
        onEndTimeChange={(value) => setRange((prev) => ({ ...prev, end: value }))}
        onStatusChange={setStatus}
        onAllDayChange={setAllDay}
        onReminderMinutesChange={setReminderMinutes}
        onRruleChange={() => undefined}
        onContentChange={setContentJson}
        onSubmit={() => void submit()}
      />
    </ScrollView>
  );
}
