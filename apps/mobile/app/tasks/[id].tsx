import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useMobileApp } from '../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { createStyles } from '../../src/styles/createStyles';
import { formatDateTime } from '../../src/lib/date';
import type { TaskStatus } from '../../src/lib/types';
import { SharedRichTextWebView } from '../../src/components/editor/SharedRichTextWebView';

export default function TaskDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useMobileApp();
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
        <Text style={[s.sectionTitle, { fontSize: 22 }]}>{task.title}</Text>
        <Text style={s.itemMeta}>{formatDateTime(task.start_time)} - {formatDateTime(task.end_time)}</Text>
        <Text style={s.itemMeta}>상태: {task.status ?? 'TODO'}</Text>
        <Text style={s.itemMeta}>색상: {task.color ?? '#3B82F6'}</Text>
      </View>

      <View style={[s.panel, { borderRadius: 16, gap: 10 }]}>
        <Text style={s.formTitle}>일정 상세/수정</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="제목" style={s.input} placeholderTextColor={colors.textMuted} />
        <TextInput value={startTime} onChangeText={setStartTime} placeholder="시작시간(ISO)" style={s.input} placeholderTextColor={colors.textMuted} />
        <TextInput value={endTime} onChangeText={setEndTime} placeholder="종료시간(ISO)" style={s.input} placeholderTextColor={colors.textMuted} />
        <SharedRichTextWebView
          valueJson={contentJson}
          valueText=""
          placeholder="태스크 상세 내용을 입력하세요."
          minHeight={220}
          onChange={(json) => setContentJson(json)}
        />

        <View style={s.row}>
          {(['TODO', 'IN_PROGRESS', 'DONE'] as const).map((item) => (
            <Pressable
              key={item}
              onPress={() => setStatus(item)}
              style={[s.workspacePill, { marginRight: 0, paddingVertical: 7, paddingHorizontal: 10 }, status === item ? s.workspacePillActive : null]}
            >
              <Text style={[s.workspacePillText, status === item ? s.workspacePillTextActive : null]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <View style={s.row}>
          <Pressable
            onPress={() => setAllDay((prev) => !prev)}
            style={[s.workspacePill, { marginRight: 0, paddingVertical: 7, paddingHorizontal: 10 }, allDay ? s.workspacePillActive : null]}
          >
            <Text style={[s.workspacePillText, allDay ? s.workspacePillTextActive : null]}>종일 일정</Text>
          </Pressable>
          {[5, 10, 15, 30, 60].map((min) => (
            <Pressable
              key={min}
              onPress={() => setReminderMinutes(String(min))}
              style={[s.workspacePill, { marginRight: 0, paddingVertical: 7, paddingHorizontal: 10 }, reminderMinutes === String(min) ? s.workspacePillActive : null]}
            >
              <Text style={[s.workspacePillText, reminderMinutes === String(min) ? s.workspacePillTextActive : null]}>{min}m 알림</Text>
            </Pressable>
          ))}
        </View>
        <TextInput value={rrule} onChangeText={setRrule} placeholder="RRULE (예: FREQ=WEEKLY;INTERVAL=1)" style={s.input} placeholderTextColor={colors.textMuted} />

        <View style={s.row}>
          <Pressable
            style={s.primaryButtonHalf}
            onPress={async () => {
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
                router.back();
              } finally {
                setSaving(false);
              }
            }}
          >
            <Text style={s.primaryButtonText}>{saving ? '저장 중...' : '저장'}</Text>
          </Pressable>
          <Pressable
            style={s.secondaryButtonHalf}
            onPress={async () => {
              if (saving) return;
              try {
                setSaving(true);
                await data.deleteTask(taskId);
                router.replace('/(tabs)/tasks');
              } finally {
                setSaving(false);
              }
            }}
          >
            <Text style={[s.secondaryButtonText, { color: '#EF4444' }]}>삭제</Text>
          </Pressable>
        </View>
      </View>

      <View style={s.row}>
        <Pressable style={s.secondaryButtonHalf} onPress={() => data.setActiveScheduleId(task.id)}>
          <Text style={s.secondaryButtonText}>캘린더에서 보기</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
