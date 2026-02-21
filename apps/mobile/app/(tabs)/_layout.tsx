import { Redirect, Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
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
  const s = createStyles(colors);
  const router = useRouter();

  if (auth.loading) return null;
  if (!auth.session) return <Redirect href="/(auth)/login" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={s.header}>
        <View style={s.logoArea}>
          <View style={[s.logoIcon, { backgroundColor: colors.primary }]}>
            <Text style={s.logoText}>P</Text>
          </View>
          <Text style={s.appTitle}>{t('appName')}</Text>
        </View>

        <Pressable style={s.workspaceSelector} onPress={() => data.setWorkspacePickerOpen(!data.workspacePickerOpen)}>
          <View style={[s.wsTypeDot, { backgroundColor: data.selectedWorkspace?.type === 'team' ? colors.primary : '#10B981' }]} />
          <Text style={s.wsName} numberOfLines={1}>{data.modeLabel}</Text>
          <Text style={s.modeDropdownChevron}>{data.workspacePickerOpen ? '▲' : '▼'}</Text>
        </Pressable>

        <View style={s.headerActions}>
          <Pressable style={s.headerActionButton} onPress={toggleMode}>
            <Text style={s.headerActionText}>{mode === 'light' ? t('themeBlack') : t('themeLight')}</Text>
          </Pressable>
          <Pressable style={s.headerActionButton} onPress={() => setLocale(locale === 'ko' ? 'en' : 'ko')}>
            <Text style={s.headerActionText}>{locale.toUpperCase()}</Text>
          </Pressable>
          <Pressable style={s.headerActionButton} onPress={() => router.push('/team/settings')}>
            <Ionicons name="settings-outline" size={15} color={colors.text} />
          </Pressable>
          <Pressable style={s.headerActionButton} onPress={() => data.setShowNotifications(!data.showNotifications)}>
            <Ionicons name="notifications-outline" size={15} color={colors.text} />
            {data.unreadCount > 0 ? <View style={s.badge}><Text style={s.badgeText}>{data.unreadCount > 9 ? '9+' : data.unreadCount}</Text></View> : null}
          </Pressable>
        </View>
      </View>

      <WorkspaceMenu
        open={data.workspacePickerOpen}
        onClose={() => data.setWorkspacePickerOpen(false)}
        onSelectPersonal={data.selectPersonal}
        onSelectTeam={data.selectTeamWorkspace}
        onOpenCreateTeam={() => {
          data.setTeamCreateOpen(true);
          data.setTeamCreateStep('details');
        }}
        onLogout={auth.logout}
        teamWorkspaces={data.teamWorkspaces}
        selectedWorkspaceId={data.selectedWorkspaceId}
        isPersonalSelected={data.selectedWorkspace?.type === 'personal'}
      />

      <View style={s.workspaceRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {data.workspaces.map((workspace) => (
            <Pressable
              key={workspace.workspace_id}
              onPress={() => data.setSelectedWorkspaceId(workspace.workspace_id)}
              style={[s.workspacePill, data.selectedWorkspaceId === workspace.workspace_id ? s.workspacePillActive : null]}
            >
              <Text style={[s.workspacePillText, data.selectedWorkspaceId === workspace.workspace_id ? s.workspacePillTextActive : null]}>
                {workspace.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

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

      <Tabs
        screenOptions={{
          header: () => null,
          tabBarStyle: {
            backgroundColor: colors.nav,
            borderTopColor: colors.border,
            height: 62,
            paddingTop: 6,
            paddingBottom: 8,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen
          name="overview"
          options={{
            title: t('tabOverview'),
            tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="home-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: t('tabTasks'),
            tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="checkbox-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: t('tabCalendar'),
            tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="calendar-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="memo"
          options={{
            title: t('tabMemo'),
            tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="document-text-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="files"
          options={{
            title: t('tabFiles'),
            tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="folder-outline" color={color} size={size} />,
          }}
        />
      </Tabs>
    </View>
  );
}
