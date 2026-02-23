import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useMobileApp } from '../../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../../src/contexts/ThemeContext';
import { createStyles } from '../../../src/styles/createStyles';
import { defaultTaskRangeByDate } from '../../../src/lib/date';
import type { TaskStatus } from '../../../src/lib/types';
import { TaskEditorForm } from '../../../src/components/task/TaskEditorForm';

export default function TaskCreatePage() {
  const { auth, data } = useMobileApp();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const router = useRouter();

  const initialRange = useMemo(() => defaultTaskRangeByDate(new Date()), []);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState(initialRange.start);
  const [endTime, setEndTime] = useState(initialRange.end);
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [allDay, setAllDay] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState('15');
  const [rrule, setRrule] = useState('');
  const [contentJson, setContentJson] = useState('');
  const [saving, setSaving] = useState(false);

  if (!auth.session) return <Redirect href="/(auth)/login" />;

  return (
    <ScrollView style={s.content} contentContainerStyle={s.contentContainer}>
      <View style={[s.panel, { borderRadius: 16, gap: 10 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[s.sectionTitle, { fontSize: 22 }]}>새 일정 등록</Text>
          <Pressable style={s.headerActionButton} onPress={() => router.back()}>
            <Text style={s.headerActionText}>취소</Text>
          </Pressable>
        </View>
        <Text style={s.itemMeta}>웹처럼 등록 페이지를 분리했습니다.</Text>
      </View>

      {!data.selectedWorkspace ? (
        <View style={s.centerScreen}>
          <Text style={s.emptyText}>워크스페이스를 선택하세요.</Text>
        </View>
      ) : (
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
          submitLabel="등록"
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
            try {
              setSaving(true);
              const success = await data.createTaskWithInput({
                title: title.trim(),
                start_time: startTime,
                end_time: endTime,
                content: contentJson || null,
                status,
                is_all_day: allDay,
                reminder_minutes: Number(reminderMinutes),
                rrule: rrule.trim() || null,
                color: '#3B82F6',
                tag_ids: [],
              });
              if (!success) return;
              router.replace('/tasks');
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
    </ScrollView>
  );
}
