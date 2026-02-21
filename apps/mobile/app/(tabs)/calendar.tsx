import { Redirect, useRouter } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { useMobileApp } from '../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { createStyles } from '../../src/styles/createStyles';
import { CalendarScreen } from '../../src/screens/CalendarScreen';
import { defaultTaskRangeByDate } from '../../src/lib/date';

export default function CalendarTab() {
  const { auth, data } = useMobileApp();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const router = useRouter();

  if (!auth.session) return <Redirect href="/(auth)/login" />;

  return (
    <ScrollView style={s.content} contentContainerStyle={s.contentContainer}>
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
          onOpenTask={(taskId) => router.push(`/tasks/${taskId}`)}
          onShiftTask={data.shiftTaskTime}
          onResizeTask={data.resizeTaskDuration}
        />
      ) : null}
    </ScrollView>
  );
}
