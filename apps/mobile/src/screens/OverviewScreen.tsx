import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useThemeMode } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { createStyles } from '../styles/createStyles';
import type { TaskItem } from '../lib/types';

type Props = {
  tasks: TaskItem[];
  onPressTask?: (taskId: number) => void;
};

type TaskWithDate = TaskItem & {
  __start: Date | null;
  __end: Date | null;
};

function parseDate(value?: string | null) {
  if (!value) return null;
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTime(value: Date | null) {
  if (!value) return '--:--';
  const hh = String(value.getHours()).padStart(2, '0');
  const mm = String(value.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatCountdown(target: Date, now: Date, t: (key: string, params?: Record<string, string | number>) => string) {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return t('overviewTimelineStartingNow');
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return t('overviewTimelineStartsInMinutes', { minutes });
  if (minutes <= 0) return t('overviewTimelineStartsInHours', { hours });
  return t('overviewTimelineStartsInHoursMinutes', { hours, minutes });
}

export function OverviewScreen({ tasks, onPressTask }: Props) {
  const { colors } = useThemeMode();
  const { locale, t } = useI18n();
  const s = createStyles(colors);
  const now = new Date();

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const todayTasks = useMemo(() => {
    return tasks
      .map((task) => {
        const start = parseDate(task.start_time);
        const end = parseDate(task.end_time) ?? start;
        return { ...task, __start: start, __end: end } as TaskWithDate;
      })
      .filter((task) => {
        const start = task.__start;
        const end = task.__end;
        if (!start || !end) return false;
        return end >= todayStart && start <= todayEnd;
      })
      .sort((a, b) => {
        const aTime = a.__start?.getTime() ?? 0;
        const bTime = b.__start?.getTime() ?? 0;
        return aTime - bTime;
      });
  }, [tasks, todayEnd, todayStart]);

  const totalCount = todayTasks.length;
  const completedCount = todayTasks.filter((task) => task.status === 'DONE').length;
  const remainingCount = Math.max(0, totalCount - completedCount);

  const currentTaskId = todayTasks.find((task) => {
    const start = task.__start;
    const end = task.__end;
    if (!start || !end) return false;
    const nowTime = now.getTime();
    return start.getTime() <= nowTime && end.getTime() >= nowTime;
  })?.id;

  const nextTask = todayTasks.find((task) => {
    const start = task.__start;
    if (!start) return false;
    return start.getTime() > now.getTime();
  });

  const localizedTopDate = now.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <View style={{ gap: 12 }}>
      <View style={[s.panel, { borderRadius: 18, gap: 6 }]}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>{localizedTopDate}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>
          {t('overviewTopSummary', { total: totalCount, completed: completedCount, remaining: remainingCount })}
        </Text>
      </View>

      <View style={[s.panel, { borderRadius: 18, gap: 10 }]}>
        <Text style={[s.formTitle, { fontSize: 16 }]}>{t('overviewTimelineTitle')}</Text>
        {nextTask?.__start ? (
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
            {formatCountdown(nextTask.__start, now, t)}
          </Text>
        ) : (
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('overviewTimelineNoUpcoming')}</Text>
        )}
        <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
          {todayTasks.length === 0 ? (
            <View style={{ padding: 12 }}>
              <Text style={s.itemMeta}>{t('overviewTimelineNoEvents')}</Text>
            </View>
          ) : (
            todayTasks.map((task, idx) => {
              const isCurrent = currentTaskId === task.id;
              return (
                <Pressable
                  key={task.id}
                  onPress={() => onPressTask?.(task.id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor: isCurrent ? `${colors.primary}14` : colors.card,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>
                    {`${formatTime(task.__start)} - ${formatTime(task.__end)}`}
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: isCurrent ? '800' : '700' }}>{task.title}</Text>
                </Pressable>
              );
            })
          )}
        </View>
      </View>

    </View>
  );
}
