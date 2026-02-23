import { useMemo } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useMobileApp } from '../../../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../../../src/contexts/ThemeContext';
import { createStyles } from '../../../../src/styles/createStyles';
import { formatDateTime } from '../../../../src/lib/date';
import { SharedRichTextWebView } from '../../../../src/components/editor/SharedRichTextWebView';

export default function TaskDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { auth, data } = useMobileApp();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const router = useRouter();

  const taskId = Number(id);
  const task = useMemo(() => data.tasks.find((item) => item.id === taskId), [data.tasks, taskId]);

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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Text style={[s.sectionTitle, { fontSize: 22, flex: 1 }]}>{task.title}</Text>
          <Pressable style={s.headerActionButton} onPress={() => router.replace(`/tasks/${taskId}/edit`)}>
            <Text style={s.headerActionText}>수정</Text>
          </Pressable>
        </View>
        <Text style={s.itemMeta}>{formatDateTime(task.start_time)} - {formatDateTime(task.end_time)}</Text>
        <Text style={s.itemMeta}>상태: {task.status ?? 'TODO'}</Text>
        <Text style={s.itemMeta}>종일: {task.is_all_day ? '예' : '아니오'}</Text>
        <Text style={s.itemMeta}>알림: {task.reminder_minutes ?? 0}분 전</Text>
        <Text style={s.itemMeta}>반복: {task.rrule ?? '-'}</Text>
        <Text style={s.itemMeta}>색상: {task.color ?? '#3B82F6'}</Text>
      </View>

      <View style={[s.panel, { borderRadius: 16, gap: 10 }]}>
        <Text style={s.formTitle}>일정 상세</Text>
        <SharedRichTextWebView
          valueJson={task.content ?? ''}
          valueText=""
          placeholder="태스크 상세 내용을 입력하세요."
          readOnly
          minHeight={220}
          onChange={() => {}}
        />
      </View>

      <View style={s.row}>
        <Pressable
          style={s.secondaryButtonHalf}
          onPress={() => router.replace('/tasks')}
        >
          <Text style={s.secondaryButtonText}>목록으로</Text>
        </Pressable>
        <Pressable
          style={s.primaryButtonHalf}
          onPress={() => router.replace(`/tasks/${taskId}/edit`)}
        >
          <Text style={s.primaryButtonText}>수정 페이지 열기</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
