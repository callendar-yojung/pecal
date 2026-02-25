import { Redirect, Slot, usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ComponentProps } from 'react';
import { useMobileApp } from '../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { useI18n } from '../../src/contexts/I18nContext';
import { createStyles } from '../../src/styles/createStyles';
import { WorkspaceMenu } from '../../src/components/common/WorkspaceMenu';
import { TeamCreateModal } from '../../src/components/team/TeamCreateModal';

export default function TabsLayout() {
  const { auth, data } = useMobileApp();
  const { colors, mode, toggleMode } = useThemeMode();
  const { t, locale, setLocale } = useI18n();
  const [flushingQueue, setFlushingQueue] = useState(false);
  const { width } = useWindowDimensions();
  const isCompact = width < 980;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(width < 980);
  const s = createStyles(colors);
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const navItems: Array<{
    key: 'overview' | 'tasks' | 'calendar' | 'memo' | 'files';
    route: string;
    label: string;
    icon: ComponentProps<typeof Ionicons>['name'];
  }> = [
    { key: 'overview', route: '/(tabs)/overview', label: t('tabOverview'), icon: 'home-outline' },
    { key: 'tasks', route: '/(tabs)/tasks', label: t('tabTasks'), icon: 'checkbox-outline' },
    { key: 'calendar', route: '/(tabs)/calendar', label: t('tabCalendar'), icon: 'calendar-outline' },
    { key: 'memo', route: '/(tabs)/memo', label: t('tabMemo'), icon: 'document-text-outline' },
    { key: 'files', route: '/(tabs)/files', label: t('tabFiles'), icon: 'folder-outline' },
  ];

  const isRouteActive = (route: string) => {
    const normalized = route.replace('/(tabs)', '');
    return pathname === route || pathname === normalized || pathname.startsWith(`${normalized}/`);
  };

  const activeNav = navItems.find((item) => isRouteActive(item.route)) ?? navItems[0];
  const compactTabBottom = 0;
  const compactTabReservedSpace = 68 + insets.bottom;

  if (auth.loading) return null;
  if (!auth.session) return <Redirect href="/(auth)/login" />;

  const sharedOverlays = (
    <>
      {data.showNotifications ? (
        <View style={s.notificationBox}>
          {data.notifications.slice(0, 4).map((notification) => (
            <View key={notification.notification_id} style={s.notificationRow}>
              <Text style={s.itemTitle}>{notification.title ?? t('notifications')}</Text>
              <Text style={s.itemMeta}>{notification.message ?? '-'}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {data.offlineQueueCount > 0 ? (
        <View style={s.queueBanner}>
          <Text style={s.queueBannerText}>
            {t('queuePending', { count: data.offlineQueueCount })}
          </Text>
          <Pressable
            style={s.queueBannerButton}
            onPress={async () => {
              if (flushingQueue) return;
              try {
                setFlushingQueue(true);
                await data.flushPendingQueue();
              } finally {
                setFlushingQueue(false);
              }
            }}
          >
            <Text style={s.queueBannerButtonText}>
              {flushingQueue ? t('queueFlushing') : t('queueRetry')}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View style={s.header}>
        <Pressable style={s.logoArea} onPress={() => router.replace('/(tabs)/overview')}>
          <View style={[s.logoIcon, { backgroundColor: colors.primary }]}>
            <Text style={s.logoText}>P</Text>
          </View>
          <Text style={s.appTitle}>{t('appName')}</Text>
        </Pressable>
        <Pressable
          style={s.modeDropdownButton}
          onPress={() => data.setWorkspacePickerOpen(!data.workspacePickerOpen)}
        >
          <View
            style={[
              s.wsTypeDot,
              { backgroundColor: data.selectedWorkspace?.type === 'team' ? colors.primary : '#10B981' },
            ]}
          />
          <Text style={s.modeDropdownText} numberOfLines={1}>
            {data.modeLabel}
          </Text>
          <Text style={s.modeDropdownChevron}>{data.workspacePickerOpen ? '▲' : '▼'}</Text>
        </Pressable>
      </View>

      <WorkspaceMenu
        open={data.workspacePickerOpen}
        onClose={() => data.setWorkspacePickerOpen(false)}
        onSelectWorkspace={(workspaceId) => data.setSelectedWorkspaceId(workspaceId)}
        onOpenCreateTeam={() => {
          data.setTeamCreateOpen(true);
          data.setTeamCreateStep('details');
        }}
        onLogout={auth.logout}
        workspaces={data.workspaces}
        teams={data.teams}
        teamWorkspaces={data.teamWorkspaces}
        selectedWorkspaceId={data.selectedWorkspaceId}
        selectedWorkspaceType={data.selectedWorkspace?.type}
        selectedWorkspaceOwnerId={data.selectedWorkspace?.owner_id}
      />

      <TeamCreateModal
        open={data.teamCreateOpen}
        step={data.teamCreateStep}
        teamName={data.teamName}
        teamDescription={data.teamDescription}
        creatingTeam={data.creatingTeam}
        onTeamNameChange={data.setTeamName}
        onTeamDescriptionChange={data.setTeamDescription}
        onClose={() => data.setTeamCreateOpen(false)}
        onCreate={data.createTeam}
        onSelectPlan={data.selectPlan}
      />

      {isCompact ? (
        <View style={{ flex: 1 }}>
          {sharedOverlays}
          <View style={{ flex: 1, minHeight: 0, paddingBottom: compactTabReservedSpace }}>
            <Slot />
          </View>

          <View
            style={[
              s.bottomTabs,
              {
                bottom: compactTabBottom,
                paddingBottom: Math.max(8, insets.bottom),
              },
            ]}
          >
            {navItems.map((item) => {
              const active = isRouteActive(item.route);
              return (
                <Pressable
                  key={item.key}
                  onPress={() => router.replace(item.route)}
                  style={[
                    s.bottomTabButton,
                    active ? s.bottomTabButtonActive : null,
                  ]}
                >
                  <View style={s.bottomTabIconWrap}>
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={active ? colors.text : colors.textMuted}
                    />
                  </View>
                  <Text
                    style={[
                      s.bottomTabText,
                      active ? s.bottomTabTextActive : null,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={s.appBody}>
          <View style={[s.leftSidebar, sidebarCollapsed ? s.leftSidebarCollapsed : null]}>
            <View style={s.sidebarTopRow}>
              {!sidebarCollapsed ? <Text style={s.sidebarTopLabel}>{t('appName')}</Text> : null}
              <Pressable
                style={s.sidebarToggleButton}
                onPress={() => setSidebarCollapsed((prev) => !prev)}
              >
                <Ionicons
                  name={sidebarCollapsed ? 'chevron-forward' : 'chevron-back'}
                  size={15}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            <Pressable
              style={[
                s.sidebarWorkspaceSwitcher,
                sidebarCollapsed ? s.sidebarWorkspaceSwitcherCollapsed : null,
              ]}
              onPress={() => data.setWorkspacePickerOpen(!data.workspacePickerOpen)}
            >
              <View
                style={[
                  s.wsTypeDot,
                  { backgroundColor: data.selectedWorkspace?.type === 'team' ? colors.primary : '#10B981' },
                ]}
              />
              {!sidebarCollapsed ? (
                <View style={s.sidebarWorkspaceSwitcherTextWrap}>
                  <Text style={s.sidebarWorkspaceSwitcherTitle} numberOfLines={1}>
                    {data.modeLabel}
                  </Text>
                  <Text style={s.sidebarWorkspaceSwitcherSub} numberOfLines={1}>
                    {data.selectedWorkspace?.name ?? t('noWorkspace')}
                  </Text>
                </View>
              ) : null}
              {!sidebarCollapsed ? (
                <Ionicons
                  name={data.workspacePickerOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.textMuted}
                />
              ) : null}
            </Pressable>

            <View style={s.sidebarNav}>
              {navItems.map((item) => {
                const active = isRouteActive(item.route);
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => router.replace(item.route)}
                    style={[
                      s.sidebarNavButton,
                      sidebarCollapsed ? s.sidebarNavButtonCollapsed : null,
                      active ? s.sidebarNavButtonActive : null,
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={active ? colors.primary : colors.textMuted}
                    />
                    {!sidebarCollapsed ? (
                      <Text style={[s.sidebarNavText, active ? s.sidebarNavTextActive : null]}>
                        {item.label}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <View style={s.sidebarDivider} />
            {!sidebarCollapsed ? <Text style={s.sidebarSectionTitle}>{t('workspaceList')}</Text> : null}

            <ScrollView
              style={s.sidebarWorkspaceScroll}
              contentContainerStyle={s.sidebarWorkspaceContainer}
              showsVerticalScrollIndicator={false}
            >
              {data.workspaces.map((workspace) => (
                <Pressable
                  key={workspace.workspace_id}
                  onPress={() => data.setSelectedWorkspaceId(workspace.workspace_id)}
                  style={[
                    s.sidebarWorkspaceItem,
                    sidebarCollapsed ? s.sidebarWorkspaceItemCollapsed : null,
                    data.selectedWorkspaceId === workspace.workspace_id ? s.sidebarWorkspaceItemActive : null,
                  ]}
                >
                  <View
                    style={[
                      s.wsTypeDot,
                      {
                        backgroundColor:
                          workspace.type === 'team' ? colors.primary : '#10B981',
                      },
                    ]}
                  />
                  {!sidebarCollapsed ? (
                    <Text
                      numberOfLines={1}
                      style={[
                        s.sidebarWorkspaceText,
                        data.selectedWorkspaceId === workspace.workspace_id ? s.sidebarWorkspaceTextActive : null,
                      ]}
                    >
                      {workspace.name}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={s.sidebarMainContent}>
            <View style={s.mainTopBar}>
              <View>
                <Text style={s.mainTopTitle}>{activeNav.label}</Text>
                <Text style={s.mainTopSubtitle}>
                  {auth.session.nickname} · {data.selectedWorkspace?.name ?? t('noWorkspace')}
                </Text>
              </View>
              <View style={s.mainTopActions}>
                <Pressable style={s.mainTopActionButton} onPress={toggleMode}>
                  <Text style={s.mainTopActionText}>{mode === 'light' ? t('themeBlack') : t('themeLight')}</Text>
                </Pressable>
                <Pressable style={s.mainTopActionButton} onPress={() => setLocale(locale === 'ko' ? 'en' : 'ko')}>
                  <Text style={s.mainTopActionText}>{locale.toUpperCase()}</Text>
                </Pressable>
                <Pressable style={s.mainTopActionButton} onPress={() => router.push('/team/settings')}>
                  <Ionicons name="settings-outline" size={15} color={colors.text} />
                </Pressable>
                <Pressable style={s.mainTopActionButton} onPress={() => data.setShowNotifications(!data.showNotifications)}>
                  <Ionicons name="notifications-outline" size={15} color={colors.text} />
                  {data.unreadCount > 0 ? <View style={s.badge}><Text style={s.badgeText}>{data.unreadCount > 9 ? '9+' : data.unreadCount}</Text></View> : null}
                </Pressable>
                <Pressable style={s.mainTopActionButton} onPress={auth.logout}>
                  <Ionicons name="log-out-outline" size={15} color={colors.text} />
                </Pressable>
              </View>
            </View>

            {sharedOverlays}

            <View style={s.mainSlotArea}>
              <Slot />
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
