import { useCallback, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useMobileApp } from '../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { createStyles } from '../../src/styles/createStyles';
import { CalendarScreen } from '../../src/screens/CalendarScreen';
import { defaultTaskRangeByDate } from '../../src/lib/date';

function toDateParam(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function CalendarTab() {
  const { auth, data } = useMobileApp();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    if (!data.selectedWorkspace) return;
    setRefreshing(true);
    try {
      await data.loadDashboard(data.selectedWorkspace);
    } finally {
      setRefreshing(false);
    }
  }, [data]);

  if (!auth.session) return <Redirect href="/(auth)/login" />;

  return (
    <View style={s.content}>
      {data.error || auth.error ? <Text style={s.errorText}>{data.error || auth.error}</Text> : null}
      {!data.selectedWorkspace ? <Text style={s.emptyText}>워크스페이스를 선택하세요.</Text> : null}
      {data.selectedWorkspace ? (
        <CalendarScreen
          selectedDate={data.calendarSelectedDate}
          tasksByDate={data.tasksByDate}
          tags={data.tags}
          activeTaskId={data.activeScheduleId}
          onSelectDate={(date) => data.setCalendarSelectedDate(date)}
          onSelectTask={(taskId) => {
            data.setActiveScheduleId(taskId);
            router.push(`/tasks/${taskId}`);
          }}
          onGoToday={() => data.setCalendarSelectedDate(new Date())}
          onOpenTaskFromDate={(date) => {
            data.setTaskRange(defaultTaskRangeByDate(date));
          }}
          onCreateTaskFromDate={(date) => {
            const dateParam = toDateParam(date);
            router.push(`/tasks/new?date=${dateParam}`);
          }}
          onOpenTask={(taskId) => router.push(`/tasks/${taskId}`)}
          onShiftTask={data.shiftTaskTime}
          onResizeTask={data.resizeTaskDuration}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      ) : null}
    </View>
  );
}
