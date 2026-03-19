import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaybeMobileApp } from '../../../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../../../src/contexts/ThemeContext';
import { toLocalDateTimeString } from '../../../../src/lib/date';
import { createStyles } from '../../../../src/styles/createStyles';
import type { TaskStatus } from '../../../../src/lib/types';

function normalizeDateTime(value: string) {
  if (!value) return new Date(NaN);
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  return new Date(normalized);
}

function dateKey(value: Date) {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function TaskDuplicatePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useMaybeMobileApp();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const taskId = Number(id);
  const [saving, setSaving] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);

  if (!app) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>앱 초기화 중...</Text>
      </View>
    );
  }

  const { auth, data } = app;
  const session = auth.session;
  const task = useMemo(() => data.tasks.find((item) => item.id === taskId) ?? null, [data.tasks, taskId]);
  const sourceStart = normalizeDateTime(task?.start_time ?? '');
  const sourceEnd = normalizeDateTime(task?.end_time ?? '');

  const [selectedStartDate, setSelectedStartDate] = useState<Date>(
    Number.isNaN(sourceStart.getTime()) ? new Date() : sourceStart,
  );
  const [selectedEndDate, setSelectedEndDate] = useState<Date>(
    Number.isNaN(sourceEnd.getTime()) ? new Date() : sourceEnd,
  );

  if (!session) return <Redirect href="/(auth)/login" />;
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

  const handleDateChange = (event: DateTimePickerEvent, picked?: Date) => {
    if (event.type === 'dismissed') {
      setPickerTarget(null);
      return;
    }
    if (picked) {
      if (pickerTarget === 'start') {
        setSelectedStartDate(picked);
        setSelectedEndDate((prev) => {
          const nextStartOnly = new Date(picked.getFullYear(), picked.getMonth(), picked.getDate());
          const currentEndOnly = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate());
          if (nextStartOnly > currentEndOnly) {
            return picked;
          }
          return prev;
        });
      } else if (pickerTarget === 'end') {
        setSelectedEndDate(picked);
      }
    }
    setPickerTarget(null);
  };

  const duplicateTask = async () => {
    if (saving) return;
    if (Number.isNaN(sourceStart.getTime()) || Number.isNaN(sourceEnd.getTime())) {
      Alert.alert('오류', '기존 일정 시간이 올바르지 않아 복제할 수 없습니다.');
      return;
    }

    const clonedStartDate = new Date(
      selectedStartDate.getFullYear(),
      selectedStartDate.getMonth(),
      selectedStartDate.getDate(),
      sourceStart.getHours(),
      sourceStart.getMinutes(),
      sourceStart.getSeconds(),
    );
    const clonedEndDate = new Date(
      selectedEndDate.getFullYear(),
      selectedEndDate.getMonth(),
      selectedEndDate.getDate(),
      sourceEnd.getHours(),
      sourceEnd.getMinutes(),
      sourceEnd.getSeconds(),
    );

    if (clonedEndDate <= clonedStartDate) {
      Alert.alert('오류', '종료 일시는 시작 일시보다 늦어야 합니다.');
      return;
    }

    setSaving(true);
    try {
      const created = await data.createTaskWithInput({
        title: task.title,
        start_time: toLocalDateTimeString(clonedStartDate),
        end_time: toLocalDateTimeString(clonedEndDate),
        content: task.content ?? null,
        status: (task.status ?? 'TODO') as TaskStatus,
        color: task.color ?? '#3B82F6',
        tag_ids: task.tag_ids ?? (task.tags ?? []).map((tag) => Number(tag.tag_id)),
        description: task.description ?? null,
        assignee_id: task.assignee_id ?? null,
        is_all_day: Boolean(task.is_all_day),
        reminder_minutes: task.reminder_minutes ?? null,
      });
      if (!created.success) return;
      if (created.taskId) {
        router.replace(`/tasks/${created.taskId}`);
        return;
      }
      router.replace('/tasks');
    } catch (error) {
      Alert.alert('오류', error instanceof Error ? error.message : '일정을 복제하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={s.content}
      contentContainerStyle={[s.contentContainer, { paddingTop: Math.max(12, insets.top + 8) }]}
    >
      <View style={[s.panel, { gap: 12 }]}>
        <Text style={s.formTitle}>일정 복제</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>
          시작 날짜와 종료 날짜를 선택하면, 원본 시작/종료 시각을 유지한 새 일정이 생성됩니다.
        </Text>

        <View style={{ gap: 6 }}>
          <Text style={s.formTitle}>원본 일정</Text>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{task.title}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {task.start_time} - {task.end_time}
          </Text>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={s.formTitle}>복제 시작 날짜</Text>
          <Pressable
            onPress={() => setPickerTarget('start')}
            style={[
              s.input,
              { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
            ]}
          >
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{dateKey(selectedStartDate)}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>날짜 선택</Text>
          </Pressable>
          {pickerTarget === 'start' ? (
            <DateTimePicker
              value={selectedStartDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
            />
          ) : null}
        </View>

        <View style={{ gap: 6 }}>
          <Text style={s.formTitle}>복제 종료 날짜</Text>
          <Pressable
            onPress={() => setPickerTarget('end')}
            style={[
              s.input,
              { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
            ]}
          >
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{dateKey(selectedEndDate)}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>날짜 선택</Text>
          </Pressable>
          {pickerTarget === 'end' ? (
            <DateTimePicker
              value={selectedEndDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
            />
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable style={s.secondaryButtonHalf} onPress={() => router.back()}>
            <Text style={s.secondaryButtonText}>취소</Text>
          </Pressable>
          <Pressable style={s.primaryButtonHalf} onPress={() => void duplicateTask()}>
            <Text style={s.primaryButtonText}>{saving ? '복제 중...' : '이 날짜로 복제'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
