import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useApp } from '@/lib/app-context';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { Schedule } from '@/lib/types';

const STATUS_LABEL: Record<string, string> = {
  TODO: '예정',
  IN_PROGRESS: '진행중',
  DONE: '완료',
};

const STATUS_COLOR: Record<string, string> = {
  TODO: '#6B7280',
  IN_PROGRESS: '#5B6CF6',
  DONE: '#10B981',
};

function CountCard({
  icon, label, count, color, onPress,
}: {
  icon: string; label: string; count: number; color: string; onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.countCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
      ]}
      onPress={onPress}
    >
      <View style={[styles.countIconBg, { backgroundColor: color + '20' }]}>
        <IconSymbol name={icon as any} size={22} color={color} />
      </View>
      <Text style={[styles.countNumber, { color: colors.foreground }]}>{count}</Text>
      <Text style={[styles.countLabel, { color: colors.muted }]}>{label}</Text>
    </Pressable>
  );
}

function ScheduleItem({ item }: { item: Schedule }) {
  const colors = useColors();
  return (
    <View style={[styles.scheduleItem, { borderLeftColor: item.color, backgroundColor: colors.surface }]}>
      <View style={styles.scheduleItemContent}>
        <Text style={[styles.scheduleItemTitle, { color: colors.foreground }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.scheduleItemTime, { color: colors.muted }]}>
          {item.startTime ? `${item.startTime}${item.endTime ? ` - ${item.endTime}` : ''}` : '종일'}
        </Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + '20' }]}>
        <Text style={[styles.statusBadgeText, { color: STATUS_COLOR[item.status] }]}>
          {STATUS_LABEL[item.status]}
        </Text>
      </View>
    </View>
  );
}

export default function OverviewScreen() {
  const { workspaceSchedules, workspaceMemos, workspaceFiles, workspaceNotifications, unreadCount, currentWorkspace } = useApp();
  const colors = useColors();

  const today = new Date().toISOString().split('T')[0];
  const todaySchedules = workspaceSchedules.filter(s => s.date === today);
  const upcomingSchedules = workspaceSchedules
    .filter(s => s.date >= today && s.status !== 'DONE')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const todoCount = workspaceSchedules.filter(s => s.status !== 'DONE').length;

  return (
    <ScreenContainer edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <View style={styles.greeting}>
          <Text style={[styles.greetingDate, { color: colors.muted }]}>
            {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
          </Text>
          <Text style={[styles.greetingTitle, { color: colors.foreground }]}>
            {currentWorkspace?.name ?? '워크스페이스'}
          </Text>
        </View>

        {/* Count Cards */}
        <View style={styles.cardsGrid}>
          <CountCard
            icon="list.bullet"
            label="진행중 일정"
            count={todoCount}
            color="#5B6CF6"
            onPress={() => router.push('/(tabs)/schedule' as any)}
          />
          <CountCard
            icon="note.text"
            label="메모"
            count={workspaceMemos.length}
            color="#10B981"
            onPress={() => router.push('/(tabs)/memo' as any)}
          />
          <CountCard
            icon="doc.fill"
            label="파일"
            count={workspaceFiles.length}
            color="#F97316"
            onPress={() => router.push('/(tabs)/files' as any)}
          />
          <CountCard
            icon="bell.badge.fill"
            label="읽지 않은 알림"
            count={unreadCount}
            color="#EF4444"
            onPress={() => {}}
          />
        </View>

        {/* Today's Schedule */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>오늘의 일정</Text>
            <Pressable onPress={() => router.push('/(tabs)/schedule' as any)}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>전체보기</Text>
            </Pressable>
          </View>
          {todaySchedules.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <IconSymbol name="calendar" size={28} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>오늘 일정이 없습니다</Text>
            </View>
          ) : (
            todaySchedules.map(s => <ScheduleItem key={s.id} item={s} />)
          )}
        </View>

        {/* Upcoming */}
        {upcomingSchedules.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>예정된 일정</Text>
                <Pressable onPress={() => router.push('/(tabs)/schedule' as any)}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>전체보기</Text>
            </Pressable>
          </View>
            {upcomingSchedules.map(s => <ScheduleItem key={s.id} item={s} />)}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    gap: 20,
    paddingBottom: 32,
  },
  greeting: {
    gap: 2,
  },
  greetingDate: {
    fontSize: 13,
    fontWeight: '500',
  },
  greetingTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  countCard: {
    width: '47%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  countIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countNumber: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1,
  },
  countLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  scheduleItemContent: {
    flex: 1,
    gap: 2,
  },
  scheduleItemTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  scheduleItemTime: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
  },
});
