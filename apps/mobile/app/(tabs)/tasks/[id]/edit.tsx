import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaybeMobileApp } from '../../../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../../../src/contexts/ThemeContext';
import type { TaskStatus } from '../../../../src/lib/types';
import { createStyles } from '../../../../src/styles/createStyles';
import { TaskEditorForm } from '../../../../src/components/task/TaskEditorForm';

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
  const task = data.tasks.find((item) => item.id === taskId) ?? null;

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setContentJson(task.content ?? '');
    setStartTime(task.start_time);
    setEndTime(task.end_time);
    setStatus(task.status ?? 'TODO');
    setAllDay(Boolean(task.is_all_day));
    setReminderMinutes(task.reminder_minutes ? String(task.reminder_minutes) : '10');
  }, [task]);

  if (!auth.session) return <Redirect href="/(auth)/login" />;
  if (!data.selectedWorkspace) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>워크스페이스를 선택하세요.</Text>
      </View>
    );
  }
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
        allDay={allDay}
        reminderMinutes={reminderMinutes}
        rrule=""
        contentJson={contentJson}
        saving={saving}
        submitLabel="일정 저장"
        onTitleChange={setTitle}
        onStartTimeChange={setStartTime}
        onEndTimeChange={setEndTime}
        onStatusChange={setStatus}
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
