import React from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useApp } from '@/lib/app-context';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { AppNotification } from '@/lib/types';

const NOTIF_ICONS: Record<string, string> = {
  schedule: 'calendar.fill',
  memo: 'note.text',
  file: 'doc.fill',
  team: 'person.2.fill',
};

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export function NotificationPanel() {
  const { state, dispatch, workspaceNotifications, unreadCount } = useApp();
  const colors = useColors();

  if (!state.notificationPanelOpen) return null;

  const handleMarkRead = (id: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id });
  };

  const handleMarkAllRead = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' });
  };

  const renderItem = ({ item }: { item: AppNotification }) => (
    <Pressable
      style={({ pressed }) => [
        styles.notifItem,
        { borderBottomColor: colors.border },
        !item.isRead && { backgroundColor: colors.surface2 },
        pressed && { opacity: 0.7 },
      ]}
      onPress={() => handleMarkRead(item.id)}
    >
      <View style={[styles.notifIcon, { backgroundColor: colors.surface }]}>
        <IconSymbol
          name={NOTIF_ICONS[item.type] as any}
          size={18}
          color={item.isRead ? colors.muted : colors.primary}
        />
      </View>
      <View style={styles.notifContent}>
        <Text style={[styles.notifTitle, { color: colors.foreground }, !item.isRead && { fontWeight: '700' }]}>
          {item.title}
        </Text>
        <Text style={[styles.notifBody, { color: colors.muted }]} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={[styles.notifTime, { color: colors.muted }]}>{timeAgo(item.createdAt)}</Text>
      </View>
      {!item.isRead && (
        <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
      )}
    </Pressable>
  );

  return (
    <View style={[styles.panel, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      {/* Panel Header */}
      <View style={[styles.panelHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.panelTitle, { color: colors.foreground }]}>알림</Text>
        <View style={styles.panelActions}>
          {unreadCount > 0 && (
            <Pressable
              style={({ pressed }) => [styles.markAllBtn, pressed && { opacity: 0.7 }]}
              onPress={handleMarkAllRead}
            >
              <Text style={[styles.markAllText, { color: colors.primary }]}>모두 읽음</Text>
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
            onPress={() => dispatch({ type: 'TOGGLE_NOTIFICATION_PANEL' })}
          >
            <IconSymbol name="xmark" size={18} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      {/* Notification List */}
      {workspaceNotifications.length === 0 ? (
        <View style={styles.empty}>
          <IconSymbol name="bell" size={36} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>알림이 없습니다</Text>
        </View>
      ) : (
        <FlatList
          data={workspaceNotifications}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          style={styles.list}
          scrollEnabled={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderBottomWidth: 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 90,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  panelActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    maxHeight: 280,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notifContent: {
    flex: 1,
    gap: 2,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  notifBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  notifTime: {
    fontSize: 11,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
  },
});
