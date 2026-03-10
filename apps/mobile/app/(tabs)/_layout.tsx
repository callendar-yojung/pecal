import { Redirect, Slot, usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ComponentProps } from 'react';
import { useMobileApp } from '../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { useI18n } from '../../src/contexts/I18nContext';
import { ApiError, apiFetch } from '../../src/lib/api';
import { createStyles } from '../../src/styles/createStyles';
import { WorkspaceMenu } from '../../src/components/common/WorkspaceMenu';
import { TeamCreateModal } from '../../src/components/team/TeamCreateModal';
import { FullPageWebView } from '../../src/components/common/FullPageWebView';

export default function TabsLayout() {
  const { auth, data } = useMobileApp();
  const { colors, resolvedMode, toggleMode } = useThemeMode();
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
  const [privacyConsentRequired, setPrivacyConsentRequired] = useState(false);
  const [consentApiSupported, setConsentApiSupported] = useState(true);
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [marketingChecked, setMarketingChecked] = useState(false);
  const [detailDocPath, setDetailDocPath] = useState<'/terms' | '/privacy' | null>(null);
  const embeddedDocQuery = { embedded: 'mobile' };
  const [consentError, setConsentError] = useState<string | null>(null);
  const WORKSPACE_NAME_MAX_LENGTH = 10;
  const truncateWorkspaceName = (value: string, maxLength = WORKSPACE_NAME_MAX_LENGTH) => {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, Math.max(1, maxLength))}...`;
  };
  const selectedWorkspaceOwnerLabel =
    data.selectedWorkspace?.type === 'team'
      ? data.teamWorkspaces.find(
          (workspace) => workspace.workspace_id === data.selectedWorkspace?.workspace_id
        )?.teamName ?? t('workspaceTeam')
      : t('workspacePersonal');
  const selectedWorkspaceName = data.selectedWorkspace?.name ?? t('noWorkspace');
  const selectedWorkspaceNameLabel = truncateWorkspaceName(selectedWorkspaceName);
  const selectedWorkspaceOwnerSuffix = `/ ${selectedWorkspaceOwnerLabel}`;
  const selectedWorkspaceSubLabel = truncateWorkspaceName(selectedWorkspaceName);

  const checkPrivacyConsent = async () => {
    if (!auth.session) {
      setPrivacyConsentRequired(false);
      setConsentApiSupported(true);
      setConsentLoading(false);
      return;
    }
    setConsentLoading(true);
    try {
      const account = await apiFetch<{ privacy_consent?: boolean }>(
        '/api/me/account',
        auth.session
      );
      // Backward compatibility:
      // Some deployed API versions do not return consent fields yet.
      if (typeof account.privacy_consent !== 'boolean') {
        setConsentApiSupported(false);
        setPrivacyConsentRequired(false);
      } else {
        setConsentApiSupported(true);
        setPrivacyConsentRequired(!account.privacy_consent);
      }
    } catch {
      setPrivacyConsentRequired(false);
    } finally {
      setConsentLoading(false);
    }
  };

  useEffect(() => {
    if (!auth.session) {
      setPrivacyConsentRequired(false);
      return;
    }
    void checkPrivacyConsent();
  }, [auth.session?.memberId]);

  const openConsentPage = async () => {
    if (!auth.session?.accessToken) return;
    setConsentError(null);
    setTermsChecked(false);
    setPrivacyChecked(false);
    setMarketingChecked(false);
    setConsentModalOpen(true);
  };

  const submitConsent = async () => {
    if (!auth.session || !termsChecked || !privacyChecked) return;
    if (!consentApiSupported) {
      setPrivacyConsentRequired(false);
      setConsentModalOpen(false);
      setDetailDocPath(null);
      setConsentError(null);
      return;
    }

    setConsentLoading(true);
    setConsentError(null);
    try {
      await apiFetch('/api/me/account', auth.session, {
        method: 'PATCH',
        body: JSON.stringify({
          privacy_consent: true,
          marketing_consent: marketingChecked,
        }),
      });
      await checkPrivacyConsent();
      setConsentModalOpen(false);
      setDetailDocPath(null);
      setConsentError(null);
    } catch (error) {
      if (error instanceof ApiError) {
        if (
          error.status === 400 &&
          /No updatable fields provided/i.test(error.message)
        ) {
          // Old API route that does not support consent fields.
          setConsentApiSupported(false);
          setPrivacyConsentRequired(false);
          setConsentModalOpen(false);
          setDetailDocPath(null);
          setConsentError(null);
          return;
        }
        setConsentError(error.message);
        console.log('[mobile] consent save failed', {
          status: error.status,
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        });
      } else {
        setConsentError(
          locale === 'ko'
            ? `동의 저장에 실패했어요. ${error instanceof Error ? error.message : '알 수 없는 오류'}`
            : `Failed to save consent. ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } finally {
      setConsentLoading(false);
    }
  };

  const agreeAll = () => {
    setTermsChecked(true);
    setPrivacyChecked(true);
    setMarketingChecked(true);
  };

  useEffect(() => {
    if (privacyConsentRequired && !consentModalOpen) {
      void openConsentPage();
    }
  }, [privacyConsentRequired, consentModalOpen, auth.session?.accessToken]);

  if (auth.loading) return null;
  if (!auth.session) return <Redirect href="/(auth)/login" />;
  const showGlobalLoading = data.dashboardLoading;

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
          <Image source={require('../../assets/icon.png')} style={s.logoImage} />
          <Text style={s.appTitle}>{t('appName')}</Text>
        </Pressable>
        <View style={s.headerActions}>
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
            <View style={s.modeDropdownLabelRow}>
              <Text style={s.modeDropdownText} numberOfLines={1} ellipsizeMode="tail">
                {selectedWorkspaceNameLabel}
              </Text>
              <Text style={s.modeDropdownOwnerText} numberOfLines={1} ellipsizeMode="tail">
                {selectedWorkspaceOwnerSuffix}
              </Text>
              <Text style={s.modeDropdownChevron}>{data.workspacePickerOpen ? '▲' : '▼'}</Text>
            </View>
          </Pressable>
          <Pressable style={s.headerActionButton} onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={16} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <WorkspaceMenu
        open={data.workspacePickerOpen}
        onClose={() => data.setWorkspacePickerOpen(false)}
        onSelectWorkspace={(workspaceId) => data.setSelectedWorkspaceId(workspaceId)}
        onOpenCreateTeam={() => {
          data.setTeamCreateOpen(true);
          data.setTeamCreateStep('details');
        }}
        onCreateWorkspace={data.createWorkspace}
        creatingWorkspace={data.creatingWorkspace}
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
                  <Text
                    style={s.sidebarWorkspaceSwitcherTitle}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {`${selectedWorkspaceNameLabel} ${selectedWorkspaceOwnerSuffix}`}
                  </Text>
                  <Text style={s.sidebarWorkspaceSwitcherSub} numberOfLines={1} ellipsizeMode="tail">
                    {selectedWorkspaceSubLabel}
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
                  <Text style={s.mainTopActionText}>{resolvedMode === 'light' ? t('themeBlack') : t('themeLight')}</Text>
                </Pressable>
                <Pressable style={s.mainTopActionButton} onPress={() => setLocale(locale === 'ko' ? 'en' : 'ko')}>
                  <Text style={s.mainTopActionText}>{locale.toUpperCase()}</Text>
                </Pressable>
                <Pressable style={s.mainTopActionButton} onPress={() => router.push('/settings')}>
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

      {consentModalOpen ? (
        <View
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.72)',
            padding: 14,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 480,
              maxHeight: '88%',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              overflow: 'hidden',
            }}
          >
            <ScrollView
              contentContainerStyle={{ padding: 16, gap: 12 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>
                  {t('consentPageTitle')}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20 }}>
                  {t('consentPageSubtitle')}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  gap: 8,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: colors.cardSoft,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>
                    {`필수 ${Number(termsChecked) + Number(privacyChecked)}/2`}
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: marketingChecked ? `${colors.primary}18` : colors.cardSoft,
                    borderWidth: 1,
                    borderColor: marketingChecked ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ color: marketingChecked ? colors.primary : colors.textMuted, fontSize: 12, fontWeight: '700' }}>
                    {t('consentMarketingOptionalBadge')}
                  </Text>
                </View>
              </View>

              {[
                {
                  key: 'terms',
                  checked: termsChecked,
                  onToggle: () => setTermsChecked((value) => !value),
                  title: t('consentTermsRequiredLabel'),
                  description: t('consentTermsRequiredDesc'),
                  actionLabel: t('consentViewTerms'),
                  onAction: () => setDetailDocPath('/terms'),
                  required: true,
                },
                {
                  key: 'privacy',
                  checked: privacyChecked,
                  onToggle: () => setPrivacyChecked((value) => !value),
                  title: t('consentPrivacyRequiredLabel'),
                  description: t('consentPrivacyRequiredDesc'),
                  actionLabel: t('consentViewPrivacy'),
                  onAction: () => setDetailDocPath('/privacy'),
                  required: true,
                },
                {
                  key: 'marketing',
                  checked: marketingChecked,
                  onToggle: () => setMarketingChecked((value) => !value),
                  title: t('consentMarketingOptionalLabel'),
                  description: t('consentMarketingOptionalDesc'),
                  actionLabel: t('consentMarketingOptionalHint'),
                  onAction: null,
                  required: false,
                },
              ].map((item) => (
                <View
                  key={item.key}
                  style={{
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: item.checked ? colors.primary : colors.border,
                    backgroundColor: item.checked ? `${colors.primary}10` : colors.cardSoft,
                    padding: 12,
                    gap: 10,
                  }}
                >
                  <Pressable
                    style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', width: '100%' }}
                    onPress={item.onToggle}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        marginTop: 2,
                        borderRadius: 7,
                        borderWidth: 1.5,
                        borderColor: item.checked ? colors.primary : colors.textMuted,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: item.checked ? colors.primary : 'transparent',
                      }}
                    >
                      {item.checked ? (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      ) : null}
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, flexShrink: 1 }}>
                          {item.title}
                        </Text>
                        <Text
                          style={{
                            color: item.required ? '#EF4444' : colors.textMuted,
                            fontSize: 11,
                            fontWeight: '700',
                            flexShrink: 0,
                          }}
                        >
                          {item.required ? '필수' : '선택'}
                        </Text>
                      </View>
                      <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19, flexShrink: 1 }}>
                        {item.description}
                      </Text>
                    </View>
                  </Pressable>

                  {item.onAction ? (
                    <Pressable
                      onPress={item.onAction}
                      style={{
                        alignSelf: 'flex-start',
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.primary,
                        backgroundColor: colors.card,
                      }}
                    >
                      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                        {item.actionLabel}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>
                      {item.actionLabel}
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>

            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: colors.border,
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 16,
                gap: 10,
                backgroundColor: colors.card,
              }}
            >
              <Pressable
                style={{
                  borderRadius: 12,
                  backgroundColor: colors.cardSoft,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
                onPress={agreeAll}
              >
                <Text style={{ color: colors.text, fontWeight: '800' }}>{t('consentAgreeAll')}</Text>
              </Pressable>

              {consentError ? <Text style={{ color: '#ef4444', fontSize: 12 }}>{consentError}</Text> : null}
              {!privacyChecked || !termsChecked ? (
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('consentRequiredError')}</Text>
              ) : null}

              <Pressable
                style={{
                  borderRadius: 12,
                  backgroundColor: termsChecked && privacyChecked ? colors.primary : '#D1D5DB',
                  paddingVertical: 13,
                  alignItems: 'center',
                }}
                onPress={() => {
                  void submitConsent();
                }}
                disabled={consentLoading || !termsChecked || !privacyChecked}
              >
                <Text style={{ color: '#ffffff', fontWeight: '800' }}>
                  {consentLoading ? t('consentSaving') : t('consentSubmit')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      <Modal
        visible={detailDocPath !== null}
        animationType="slide"
        onRequestClose={() => setDetailDocPath(null)}
      >
        <SafeAreaView
          edges={['top', 'left', 'right']}
          style={{ flex: 1, backgroundColor: colors.bg }}
        >
          <View
            style={{
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              backgroundColor: colors.card,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Pressable
              onPress={() => setDetailDocPath(null)}
              style={{ alignSelf: 'flex-end' }}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>
          {detailDocPath ? (
            <FullPageWebView
              path={detailDocPath}
              query={embeddedDocQuery}
              onNavigationStateChange={(url) => {
                try {
                  const parsed = new URL(url);
                  const pathname = parsed.pathname || '';
                  const isDetailDocument =
                    pathname.endsWith('/terms') || pathname.endsWith('/privacy') || pathname.includes('/terms/') || pathname.includes('/privacy/');
                  if (!isDetailDocument) {
                    setDetailDocPath(null);
                  }
                } catch {
                  // ignore
                }
              }}
            />
          ) : null}
        </SafeAreaView>
      </Modal>

      {showGlobalLoading ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: resolvedMode === 'black' ? 'rgba(7,9,14,0.82)' : 'rgba(242,244,251,0.84)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 220,
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 22,
              paddingVertical: 18,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <Image source={require('../../assets/icon.png')} style={{ width: 60, height: 60, borderRadius: 14 }} />
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{t('commonLoading')}</Text>
          </View>
        </View>
      ) : null}

      {consentLoading ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 998,
          }}
        >
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
