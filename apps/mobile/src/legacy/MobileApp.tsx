import { useEffect } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useDashboardData } from '../hooks/useDashboardData';
import { useI18n } from '../contexts/I18nContext';
import { useThemeMode } from '../contexts/ThemeContext';
import { createStyles } from '../styles/createStyles';
import { LoginScreen } from '../screens/LoginScreen';
import { OverviewScreen } from '../screens/OverviewScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { MemoScreen } from '../screens/MemoScreen';
import { FilesScreen } from '../screens/FilesScreen';
import { WorkspaceMenu } from '../components/common/WorkspaceMenu';
import { TeamCreateModal } from '../components/team/TeamCreateModal';
import { defaultTaskRangeByDate } from '../lib/date';
import type { MainTab } from '../lib/types';

export function MobileApp() {
  const { t, locale, setLocale } = useI18n();
  const { mode, colors, toggleMode } = useThemeMode();
  const s = createStyles(colors);
  const auth = useAuth();
  const data = useDashboardData(auth.session);

  useEffect(() => {
    void auth.restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!auth.session) return;
    void data.loadWorkspaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.session]);

  useEffect(() => {
    if (!data.selectedWorkspace) return;
    void data.loadDashboard(data.selectedWorkspace);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.selectedWorkspaceId]);

  if (auth.loading) {
    return (
      <SafeAreaView style={s.centerScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={s.subtleText}>{t('loading')}</Text>
      </SafeAreaView>
    );
  }

  if (!auth.session) {
    return <LoginScreen error={auth.error} authLoading={auth.authLoading} onLogin={auth.login} />;
  }

  const tabItems: Array<{ key: MainTab; label: string; icon: keyof typeof Ionicons.glyphMap; center?: boolean }> = [
    { key: 'overview', label: t('tabOverview'), icon: 'home-outline' },
    { key: 'tasks', label: t('tabTasks'), icon: 'checkbox-outline' },
    { key: 'calendar', label: t('tabCalendar'), icon: 'calendar-outline', center: true },
    { key: 'memo', label: t('tabMemo'), icon: 'document-text-outline' },
    { key: 'files', label: t('tabFiles'), icon: 'folder-outline' },
  ];

  return (
    <SafeAreaView style={s.screen}>
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
          <Pressable style={s.headerActionButton} onPress={() => data.setShowNotifications(!data.showNotifications)}>
            <Text style={s.headerActionText}>🔔</Text>
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

      <ScrollView style={s.content} contentContainerStyle={s.contentContainer}>
        {data.dashboardLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {data.error || auth.error ? <Text style={s.errorText}>{data.error || auth.error}</Text> : null}
        {!data.selectedWorkspace ? <Text style={s.emptyText}>{t('noWorkspace')}</Text> : null}

        {data.selectedWorkspace && data.tab === 'overview' ? (
          <OverviewScreen taskCount={data.tasks.length} memoCount={data.memos.length} fileCount={data.files.length} unreadCount={data.unreadCount} />
        ) : null}

        {data.selectedWorkspace && data.tab === 'tasks' ? (
          <TasksScreen
            taskTitle={data.taskTitle}
            taskContentJson={data.taskContentJson}
            taskStart={data.taskRange.start}
            taskEnd={data.taskRange.end}
            tasks={data.tasks}
            tags={data.tags}
            onTaskTitleChange={data.setTaskTitle}
            onTaskContentChange={data.setTaskContentJson}
            onTaskStartChange={(v) => data.setTaskRange({ ...data.taskRange, start: v })}
            onTaskEndChange={(v) => data.setTaskRange({ ...data.taskRange, end: v })}
            onCreateTask={data.createTask}
          />
        ) : null}

        {data.selectedWorkspace && data.tab === 'calendar' ? (
          <CalendarScreen
            selectedDate={data.calendarSelectedDate}
            tasksByDate={data.tasksByDate}
            tags={data.tags}
            activeTaskId={data.activeScheduleId}
            onSelectDate={(date) => data.setCalendarSelectedDate(date)}
            onSelectTask={data.setActiveScheduleId}
            onGoToday={() => data.setCalendarSelectedDate(new Date())}
            onOpenTaskFromDate={(date) => {
              data.setTaskRange(defaultTaskRangeByDate(date));
              data.setTab('tasks');
            }}
          />
        ) : null}

        {data.selectedWorkspace && data.tab === 'memo' ? (
          <MemoScreen
            memoTitle={data.memoTitle}
            memoText={data.memoText}
            memoContentJson={data.memoContentJson}
            selectedMemoId={data.selectedMemoId}
            memoConflict={data.memoConflict}
            memoSearch={data.memoSearch}
            memoFolderFilter={data.memoFolderFilter}
            memoSort={data.memoSort}
            memoFavoriteOnly={data.memoFavoriteOnly}
            memoIsSaving={data.memoIsSaving}
            memos={data.decoratedMemos}
            onMemoTitleChange={data.setMemoTitle}
            onMemoTextChange={data.setMemoText}
            onMemoEditorChange={data.onMemoEditorChange}
            onMemoSearchChange={data.setMemoSearch}
            onMemoFolderFilterChange={data.setMemoFolderFilter}
            onMemoSortChange={data.setMemoSort}
            onMemoFavoriteOnlyToggle={() => data.setMemoFavoriteOnly(!data.memoFavoriteOnly)}
            onSelectMemoForEdit={data.selectMemoForEdit}
            onClearMemoEditor={data.clearMemoEditor}
            onUpdateMemo={data.updateMemo}
            onToggleMemoPinned={data.toggleMemoPinned}
            onSetMemoFolder={data.setMemoFolder}
            onSetMemoTags={data.setMemoTags}
            onToggleMemoFavorite={data.toggleMemoFavorite}
            onDeleteMemo={data.deleteMemo}
          />
        ) : null}

        {data.selectedWorkspace && data.tab === 'files' ? <FilesScreen files={data.files} /> : null}
      </ScrollView>

      <View style={s.bottomTabs}>
        {tabItems.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => data.setTab(item.key)}
            style={[
              s.bottomTabButton,
              item.center ? s.bottomTabButtonCenter : null,
              data.tab === item.key ? s.bottomTabButtonActive : null,
              data.tab === item.key && item.center ? s.bottomTabButtonCenterActive : null,
            ]}
          >
            <View style={s.bottomTabIconWrap}>
              <Ionicons
                name={item.icon}
                size={17}
                style={[
                  s.bottomTabIcon,
                  data.tab === item.key ? s.bottomTabIconActive : null,
                  data.tab === item.key && item.center ? s.bottomTabIconOnPrimary : null,
                ]}
                color={
                  data.tab === item.key && item.center ? '#FFFFFF' : data.tab === item.key ? colors.text : colors.textMuted
                }
              />
            </View>
            <Text
              style={[
                s.bottomTabText,
                data.tab === item.key ? s.bottomTabTextActive : null,
                data.tab === item.key && item.center ? s.bottomTabTextOnPrimary : null,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <StatusBar style={mode === 'black' ? 'light' : 'dark'} />
    </SafeAreaView>
  );
}
