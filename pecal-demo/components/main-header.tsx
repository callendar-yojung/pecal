import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, FlatList, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useApp, genId } from '@/lib/app-context';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { Workspace } from '@/lib/types';
import { TeamCreateModal } from './team-create-modal';

export function MainHeader() {
  const { state, dispatch, currentWorkspace, unreadCount } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);

  const handleNotificationToggle = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch({ type: 'TOGGLE_NOTIFICATION_PANEL' });
  };

  const handleSelectWorkspace = (id: string) => {
    dispatch({ type: 'SET_WORKSPACE', payload: id });
    setWsDropdownOpen(false);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
    router.replace('/login' as any);
  };

  return (
    <>
      <View style={[styles.header, {
        paddingTop: insets.top + 8,
        backgroundColor: colors.background,
        borderBottomColor: colors.border,
      }]}>
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={[styles.logoIcon, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoText}>P</Text>
          </View>
          <Text style={[styles.appTitle, { color: colors.foreground }]}>Pecal</Text>
        </View>

        {/* Workspace Selector */}
        <Pressable
          style={({ pressed }) => [
            styles.workspaceSelector,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => setWsDropdownOpen(true)}
        >
          <View style={[
            styles.wsTypeDot,
            { backgroundColor: currentWorkspace?.type === 'team' ? colors.primary : colors.success }
          ]} />
          <Text style={[styles.wsName, { color: colors.foreground }]} numberOfLines={1}>
            {currentWorkspace?.name ?? '워크스페이스'}
          </Text>
          <IconSymbol name="chevron.down" size={14} color={colors.muted} />
        </Pressable>

        {/* Right Actions */}
        <View style={styles.rightActions}>
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
            onPress={handleNotificationToggle}
          >
            <IconSymbol
              name={unreadCount > 0 ? 'bell.badge.fill' : 'bell'}
              size={22}
              color={unreadCount > 0 ? colors.primary : colors.foreground}
            />
            {unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.error }]}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Workspace Dropdown Modal */}
      <Modal
        visible={wsDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setWsDropdownOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setWsDropdownOpen(false)}>
          <View style={[styles.dropdown, {
            backgroundColor: colors.card,
            borderColor: colors.border,
            top: insets.top + 60,
          }]}>
            <Text style={[styles.dropdownTitle, { color: colors.muted }]}>워크스페이스</Text>
            {state.workspaces.map(ws => (
              <Pressable
                key={ws.id}
                style={({ pressed }) => [
                  styles.dropdownItem,
                  { borderBottomColor: colors.border },
                  ws.id === state.currentWorkspaceId && { backgroundColor: colors.surface2 },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => handleSelectWorkspace(ws.id)}
              >
                <View style={[
                  styles.wsIcon,
                  { backgroundColor: ws.type === 'team' ? colors.primary : colors.success }
                ]}>
                  <IconSymbol
                    name={ws.type === 'team' ? 'person.2.fill' : 'person.fill'}
                    size={14}
                    color="#fff"
                  />
                </View>
                <View style={styles.wsInfo}>
                  <Text style={[styles.wsItemName, { color: colors.foreground }]}>{ws.name}</Text>
                  <Text style={[styles.wsItemMeta, { color: colors.muted }]}>
                    {ws.type === 'personal' ? '개인' : `팀 · ${ws.memberCount}명`}
                    {ws.plan === 'pro' && ' · PRO'}
                  </Text>
                </View>
                {ws.id === state.currentWorkspaceId && (
                  <IconSymbol name="checkmark" size={16} color={colors.primary} />
                )}
              </Pressable>
            ))}
            <Pressable
              style={({ pressed }) => [styles.createTeamBtn, pressed && { opacity: 0.7 }]}
              onPress={() => { setWsDropdownOpen(false); setTeamModalOpen(true); }}
            >
              <IconSymbol name="plus.circle.fill" size={18} color={colors.primary} />
              <Text style={[styles.createTeamText, { color: colors.primary }]}>팀 만들기</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.7 }]}
              onPress={() => { setWsDropdownOpen(false); handleLogout(); }}
            >
              <IconSymbol name="arrow.right" size={16} color={colors.error} />
              <Text style={[styles.logoutText, { color: colors.error }]}>로그아웃</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <TeamCreateModal
        visible={teamModalOpen}
        onClose={() => setTeamModalOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    zIndex: 100,
  },
  logoArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 10,
  },
  logoIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  workspaceSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginHorizontal: 8,
  },
  wsTypeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  wsName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dropdown: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  dropdownTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  wsIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wsInfo: {
    flex: 1,
  },
  wsItemName: {
    fontSize: 15,
    fontWeight: '600',
  },
  wsItemMeta: {
    fontSize: 12,
    marginTop: 1,
  },
  createTeamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  createTeamText: {
    fontSize: 15,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
