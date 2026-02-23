import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useMobileApp } from '../../../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../../../src/contexts/ThemeContext';
import { createStyles } from '../../../../src/styles/createStyles';
import type { TaskStatus } from '../../../../src/lib/types';
import { TaskEditorForm } from '../../../../src/components/task/TaskEditorForm';

export default function TaskEditPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { auth, data } = useMobileApp();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const router = useRouter();

  const taskId = Number(id);
  const task = useMemo(() => data.tasks.find((item) => item.id === taskId), [data.tasks, taskId]);

  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [allDay, setAllDay] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState('15');
  const [rrule, setRrule] = useState('');
  const [contentJson, setContentJson] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setStartTime(task.start_time);
    setEndTime(task.end_time);
    setStatus(task.status ?? 'TODO');
    setAllDay(!!task.is_all_day);
    setReminderMinutes(task.reminder_minutes ? String(task.reminder_minutes) : '15');
    setRrule(task.rrule ?? '');
    setContentJson(task.content ?? '');
  }, [task]);

  if (!auth.session) return <Redirect href="/(auth)/login" />;

  if (!task) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>일정을 찾을 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.content} contentContainerStyle={s.contentContainer}>
      <View style={[s.panel, { borderRadius: 16, gap: 10 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[s.sectionTitle, { fontSize: 22 }]}>일정 수정</Text>
          <Pressable style={s.headerActionButton} onPress={() => router.back()}>
            <Text style={s.headerActionText}>닫기</Text>
          </Pressable>
        </View>
        <Text style={s.itemMeta}>{task.title}</Text>
      </View>

      <TaskEditorForm
        title={title}
        startTime={startTime}
        endTime={endTime}
        status={status}
        allDay={allDay}
        reminderMinutes={reminderMinutes}
        rrule={rrule}
        contentJson={contentJson}
        saving={saving}
        submitLabel="저장"
        onTitleChange={setTitle}
        onStartTimeChange={setStartTime}
        onEndTimeChange={setEndTime}
        onStatusChange={setStatus}
        onAllDayChange={setAllDay}
        onReminderMinutesChange={setReminderMinutes}
        onRruleChange={setRrule}
        onContentChange={setContentJson}
        onSubmit={async () => {
          if (saving) return;
          if (!title.trim()) {
            data.setError('일정 제목을 입력하세요.');
            return;
          }
          if (new Date(startTime) >= new Date(endTime)) {
            data.setError('종료 시간이 시작 시간보다 늦어야 합니다.');
            return;
          }
          try {
            setSaving(true);
            await data.updateTask(taskId, {
              title: title.trim(),
              start_time: startTime,
              end_time: endTime,
              content: contentJson || null,
              status,
              is_all_day: allDay,
              reminder_minutes: Number(reminderMinutes),
              rrule: rrule.trim() || null,
            });
            router.replace(`/tasks/${taskId}`);
          } finally {
            setSaving(false);
          }
        }}
        onDelete={async () => {
          if (saving) return;
          try {
            setSaving(true);
            await data.deleteTask(taskId);
            router.replace('/tasks');
          } finally {
            setSaving(false);
          }
        }}
      />
    </ScrollView>
  );
}
