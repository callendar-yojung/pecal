import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMobileApp } from '../../src/contexts/MobileAppContext';
import { useI18n } from '../../src/contexts/I18nContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { apiFetch } from '../../src/lib/api';
import { createStyles } from '../../src/styles/createStyles';

type TeamInfo = {
  id: number;
  name: string;
  description?: string | null;
  created_by: number;
};

type TeamMemberInfo = {
  member_id: number;
  nickname: string | null;
  email: string | null;
  role_name: string | null;
  role_id: number | null;
};

type TeamRoleInfo = {
  team_role_id: number;
  name: string;
  memberCount?: number;
};

type TeamPermissionInfo = {
  permission_id: number;
  code: string;
  description: string | null;
};

type MemberSearchResult = {
  member_id: number;
  nickname: string | null;
  email: string | null;
  profile_image_url: string | null;
};

type PermissionDefinition = {
  code: string;
  ko: string;
  en: string;
};

const PERMISSIONS: PermissionDefinition[] = [
  { code: 'TASK_CREATE', ko: '할 일 생성', en: 'Create tasks' },
  { code: 'TASK_EDIT_OWN', ko: '내 할 일 수정', en: 'Edit own tasks' },
  { code: 'TASK_EDIT_ALL', ko: '전체 할 일 수정', en: 'Edit all tasks' },
  { code: 'TASK_DELETE_OWN', ko: '내 할 일 삭제', en: 'Delete own tasks' },
  { code: 'TASK_DELETE_ALL', ko: '전체 할 일 삭제', en: 'Delete all tasks' },
  { code: 'WORKSPACE_CREATE', ko: '워크스페이스 생성', en: 'Create workspaces' },
  { code: 'WORKSPACE_EDIT', ko: '워크스페이스 수정', en: 'Edit workspaces' },
  { code: 'WORKSPACE_DELETE', ko: '워크스페이스 삭제', en: 'Delete workspaces' },
];

function TeamCard({
  children,
  colors,
}: {
  children: React.ReactNode;
  colors: { card: string; border: string };
}) {
  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding: 16,
        gap: 12,
      }}
    >
      {children}
    </View>
  );
}

function SectionTitle({
  title,
  subtitle,
  colors,
}: {
  title: string;
  subtitle?: string;
  colors: { text: string; textMuted: string };
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{title}</Text>
      {subtitle ? <Text style={{ color: colors.textMuted, fontSize: 13 }}>{subtitle}</Text> : null}
    </View>
  );
}

function ActionChip({
  label,
  active,
  disabled,
  onPress,
  colors,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  colors: { primary: string; cardSoft: string; border: string; text: string; textMuted: string };
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: active ? colors.primary : colors.cardSoft,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        opacity: disabled ? 0.45 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: active ? 6 : 0,
      }}
    >
      {active ? <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" /> : null}
      <Text style={{ color: active ? '#FFFFFF' : colors.text, fontSize: 12, fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function SummaryBadge({
  label,
  value,
  helper,
  colors,
}: {
  label: string;
  value: string;
  helper?: string;
  colors: { primary: string; text: string; textMuted: string; border: string };
}) {
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.primary,
        backgroundColor: `${colors.primary}12`,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 6,
      }}
    >
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800', flex: 1 }}>{value}</Text>
      </View>
      {helper ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{helper}</Text> : null}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  destructive,
  colors,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  colors: { primary: string; border: string };
}) {
  const backgroundColor = destructive ? '#DC2626' : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        minHeight: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        backgroundColor,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

export default function TeamSettingsPage() {
  const { data, auth } = useMobileApp();
  const { colors } = useThemeMode();
  const { locale } = useI18n();
  const isKo = locale === 'ko';
  const s = createStyles(colors);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const session = auth.session;
  const selectedWorkspace = data.selectedWorkspace;
  const teamId = selectedWorkspace?.type === 'team' ? selectedWorkspace.owner_id : null;

  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [members, setMembers] = useState<TeamMemberInfo[]>([]);
  const [roles, setRoles] = useState<TeamRoleInfo[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [memberRoleId, setMemberRoleId] = useState<number | null>(null);
  const [permissionCodes, setPermissionCodes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberSearchResult | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedRole = useMemo(
    () => roles.find((role) => role.team_role_id === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  );

  const isAdmin = Boolean(
    session &&
      team &&
      Number(team.created_by) === Number(session.memberId)
  );

  const memberRoleOptions = useMemo(() => {
    if (roles.length === 0) return [];
    return roles;
  }, [roles]);

  const permissionList = useMemo(
    () =>
      PERMISSIONS.map((permission) => ({
        ...permission,
        label: isKo ? permission.ko : permission.en,
        assigned: permissionCodes.includes(permission.code),
      })),
    [isKo, permissionCodes]
  );
  const selectedRoleSummary = selectedRole
    ? isKo
      ? `현재 선택된 역할: ${selectedRole.name}${selectedRole.memberCount ? ` · ${selectedRole.memberCount}명` : ''}`
      : `Current role: ${selectedRole.name}${selectedRole.memberCount ? ` · ${selectedRole.memberCount} members` : ''}`
    : isKo
      ? '현재 선택된 역할이 없습니다.'
      : 'No role selected.';

  const cardBg = colors.card;
  const mutedCardBg = colors.cardSoft;

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const loadTeam = async () => {
    if (!teamId || !session) return;
    const response = await apiFetch<{ team: TeamInfo }>(`/api/teams/${teamId}`, session);
    const nextTeam = response.team;
    setTeam(nextTeam);
    setTeamName(nextTeam?.name ?? '');
    setTeamDescription(nextTeam?.description ?? '');
  };

  const loadMembers = async () => {
    if (!teamId || !session) return;
    const response = await apiFetch<{ members: TeamMemberInfo[] }>(`/api/teams/${teamId}/members`, session);
    setMembers(response.members ?? []);
  };

  const loadRoles = async () => {
    if (!teamId || !session) return;
    const response = await apiFetch<{ roles: TeamRoleInfo[] }>(`/api/teams/${teamId}/roles`, session);
    const nextRoles = response.roles ?? [];
    setRoles(nextRoles);
    const nextSelectedRoleId =
      selectedRoleId && nextRoles.some((role) => role.team_role_id === selectedRoleId)
        ? selectedRoleId
        : nextRoles[0]?.team_role_id ?? null;
    setSelectedRoleId(nextSelectedRoleId);
    const memberRole = nextRoles.find((role) => role.name === 'Member') ?? nextRoles[0] ?? null;
    setMemberRoleId(memberRole?.team_role_id ?? null);
  };

  const loadRolePermissions = async (roleId: number) => {
    if (!teamId || !session) return;
    const response = await apiFetch<{ permissions: TeamPermissionInfo[] }>(
      `/api/teams/${teamId}/roles/${roleId}/permissions`,
      session
    );
    setPermissionCodes((response.permissions ?? []).map((permission) => permission.code));
  };

  const refreshAll = async () => {
    if (!teamId || !session) return;
    setLoading(true);
    resetMessages();
    try {
      await Promise.all([loadTeam(), loadMembers(), loadRoles()]);
    } catch (err) {
      console.error(err);
      setError(isKo ? '팀 정보를 불러오지 못했습니다.' : 'Failed to load team settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!teamId || !session) {
      setLoading(false);
      return;
    }
    void refreshAll();
  }, [teamId, session?.memberId]);

  useEffect(() => {
    if (!selectedRoleId || !teamId || !session) {
      setPermissionCodes([]);
      return;
    }
    void loadRolePermissions(selectedRoleId).catch((err) => {
      console.error(err);
      setError(isKo ? '권한 정보를 불러오지 못했습니다.' : 'Failed to load permissions.');
    });
  }, [selectedRoleId, teamId, session?.memberId, isKo]);

  useEffect(() => {
    if (!teamId || !session || !isAdmin) return;
    const keyword = searchQuery.trim();
    if (keyword.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const type = keyword.includes('@') ? 'email' : 'nickname';
        const response = await apiFetch<{ results: MemberSearchResult[] }>(
          `/api/members/search?q=${encodeURIComponent(keyword)}&type=${type}`,
          session
        );
        setSearchResults(response.results ?? []);
      } catch (err) {
        console.error(err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, teamId, session?.memberId, isAdmin]);

  const handleSaveTeam = async () => {
    if (!teamId || !session || !teamName.trim()) return;
    setSubmitting(true);
    resetMessages();
    try {
      await apiFetch(`/api/teams/${teamId}`, session, {
        method: 'PATCH',
        body: JSON.stringify({
          name: teamName.trim(),
          description: teamDescription.trim() || null,
        }),
      });
      await data.loadWorkspaces();
      setSuccess(isKo ? '팀 정보가 저장되었습니다.' : 'Team settings saved.');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : isKo ? '팀 정보 저장에 실패했습니다.' : 'Failed to save team settings.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTeam = () => {
    if (!teamId || !session) return;
    Alert.alert(
      isKo ? '팀 삭제' : 'Delete team',
      isKo ? '이 팀을 삭제하면 되돌릴 수 없습니다. 계속하시겠습니까?' : 'This team will be deleted permanently. Continue?',
      [
        { text: isKo ? '취소' : 'Cancel', style: 'cancel' },
        {
          text: isKo ? '삭제' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            resetMessages();
            try {
              await apiFetch(`/api/teams/${teamId}`, session, { method: 'DELETE' });
              await data.loadWorkspaces();
              router.back();
            } catch (err) {
              console.error(err);
              setError(err instanceof Error ? err.message : isKo ? '팀 삭제에 실패했습니다.' : 'Failed to delete team.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleInvite = async () => {
    if (!teamId || !session || !selectedMember || !memberRoleId) return;
    setSubmitting(true);
    resetMessages();
    try {
      await apiFetch(`/api/teams/${teamId}/invitations`, session, {
        method: 'POST',
        body: JSON.stringify({
          invited_member_id: selectedMember.member_id,
          role_id: memberRoleId,
        }),
      });
      setSearchQuery('');
      setSelectedMember(null);
      setSearchResults([]);
      await loadMembers();
      setSuccess(isKo ? '팀원을 초대했습니다.' : 'Member invited.');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : isKo ? '팀원 초대에 실패했습니다.' : 'Failed to invite member.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = (memberId: number) => {
    if (!teamId || !session) return;
    Alert.alert(
      isKo ? '팀원 제거' : 'Remove member',
      isKo ? '이 팀원을 팀에서 제거하시겠습니까?' : 'Remove this member from the team?',
      [
        { text: isKo ? '취소' : 'Cancel', style: 'cancel' },
        {
          text: isKo ? '제거' : 'Remove',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            resetMessages();
            try {
              await apiFetch(`/api/teams/${teamId}/members?member_id=${memberId}`, session, {
                method: 'DELETE',
              });
              await loadMembers();
              setSuccess(isKo ? '팀원을 제거했습니다.' : 'Member removed.');
            } catch (err) {
              console.error(err);
              setError(err instanceof Error ? err.message : isKo ? '팀원 제거에 실패했습니다.' : 'Failed to remove member.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleUpdateMemberRole = async (memberId: number, roleId: number) => {
    if (!teamId || !session) return;
    setSubmitting(true);
    resetMessages();
    try {
      await apiFetch(`/api/teams/${teamId}/members`, session, {
        method: 'PATCH',
        body: JSON.stringify({
          member_id: memberId,
          role_id: roleId,
        }),
      });
      await loadMembers();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : isKo ? '역할 변경에 실패했습니다.' : 'Failed to change role.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRole = async () => {
    if (!teamId || !session || !newRoleName.trim()) return;
    setSubmitting(true);
    resetMessages();
    try {
      await apiFetch(`/api/teams/${teamId}/roles`, session, {
        method: 'POST',
        body: JSON.stringify({ name: newRoleName.trim() }),
      });
      setNewRoleName('');
      await loadRoles();
      setSuccess(isKo ? '역할을 추가했습니다.' : 'Role created.');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : isKo ? '역할 추가에 실패했습니다.' : 'Failed to create role.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRole = () => {
    if (!teamId || !session || !selectedRoleId || selectedRole?.name === 'Owner') return;
    Alert.alert(
      isKo ? '역할 삭제' : 'Delete role',
      isKo ? '선택한 역할을 삭제하시겠습니까?' : 'Delete the selected role?',
      [
        { text: isKo ? '취소' : 'Cancel', style: 'cancel' },
        {
          text: isKo ? '삭제' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            resetMessages();
            try {
              await apiFetch(`/api/teams/${teamId}/roles?role_id=${selectedRoleId}`, session, {
                method: 'DELETE',
              });
              await loadRoles();
              setSuccess(isKo ? '역할을 삭제했습니다.' : 'Role deleted.');
            } catch (err) {
              console.error(err);
              setError(err instanceof Error ? err.message : isKo ? '역할 삭제에 실패했습니다.' : 'Failed to delete role.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleTogglePermission = (code: string) => {
    if (selectedRole?.name === 'Owner') return;
    setPermissionCodes((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    );
  };

  const handleSavePermissions = async () => {
    if (!teamId || !session || !selectedRoleId || selectedRole?.name === 'Owner') return;
    setSubmitting(true);
    resetMessages();
    try {
      await apiFetch(`/api/teams/${teamId}/roles/${selectedRoleId}/permissions`, session, {
        method: 'PUT',
        body: JSON.stringify({ codes: permissionCodes }),
      });
      await loadRolePermissions(selectedRoleId);
      setSuccess(isKo ? '권한을 저장했습니다.' : 'Permissions saved.');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : isKo ? '권한 저장에 실패했습니다.' : 'Failed to save permissions.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!selectedWorkspace || selectedWorkspace.type !== 'team' || !teamId) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>{isKo ? '팀 워크스페이스를 먼저 선택하세요.' : 'Select a team workspace first.'}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          paddingTop: Math.max(insets.top + 8, 16),
          paddingHorizontal: 12,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.card,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.cardSoft,
          }}
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }} numberOfLines={1}>
            {isKo ? '팀 관리' : 'Team management'}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
            {selectedWorkspace.name}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 14,
          paddingTop: 14,
          paddingBottom: Math.max(insets.bottom + 32, 40),
          gap: 14,
        }}
      >
        {loading ? (
          <View style={{ paddingTop: 80, alignItems: 'center', gap: 12 }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              {isKo ? '팀 설정을 불러오는 중...' : 'Loading team settings...'}
            </Text>
          </View>
        ) : !isAdmin ? (
          <TeamCard colors={{ card: cardBg, border: colors.border }}>
            <SectionTitle
              title={isKo ? '권한 없음' : 'No access'}
              subtitle={
                isKo
                  ? '팀 관리자만 모바일에서 팀 설정을 관리할 수 있습니다.'
                  : 'Only team admins can manage team settings on mobile.'
              }
              colors={{ text: colors.text, textMuted: colors.textMuted }}
            />
          </TeamCard>
        ) : (
          <>
            {error ? (
              <View
                style={{
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  backgroundColor: '#FEE2E2',
                  borderWidth: 1,
                  borderColor: '#FCA5A5',
                }}
              >
                <Text style={{ color: '#B91C1C', fontSize: 13, fontWeight: '600' }}>{error}</Text>
              </View>
            ) : null}

            {success ? (
              <View
                style={{
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  backgroundColor: '#DCFCE7',
                  borderWidth: 1,
                  borderColor: '#86EFAC',
                }}
              >
                <Text style={{ color: '#15803D', fontSize: 13, fontWeight: '600' }}>{success}</Text>
              </View>
            ) : null}

            <TeamCard colors={{ card: cardBg, border: colors.border }}>
              <SectionTitle
                title={isKo ? '팀 정보' : 'Team info'}
                subtitle={isKo ? '팀 이름과 설명을 수정할 수 있습니다.' : 'Edit team name and description.'}
                colors={{ text: colors.text, textMuted: colors.textMuted }}
              />
              <TextInput
                value={teamName}
                onChangeText={setTeamName}
                placeholder={isKo ? '팀 이름' : 'Team name'}
                placeholderTextColor={colors.textMuted}
                style={{
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: mutedCardBg,
                  color: colors.text,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  fontWeight: '600',
                }}
              />
              <TextInput
                value={teamDescription}
                onChangeText={setTeamDescription}
                placeholder={isKo ? '팀 설명 (선택)' : 'Description (optional)'}
                placeholderTextColor={colors.textMuted}
                multiline
                style={{
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: mutedCardBg,
                  color: colors.text,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 14,
                  minHeight: 92,
                  textAlignVertical: 'top',
                }}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label={isKo ? '팀 정보 저장' : 'Save team'}
                    onPress={handleSaveTeam}
                    disabled={submitting || !teamName.trim()}
                    colors={{ primary: colors.primary, border: colors.border }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label={isKo ? '팀 삭제' : 'Delete team'}
                    onPress={handleDeleteTeam}
                    disabled={submitting}
                    destructive
                    colors={{ primary: colors.primary, border: colors.border }}
                  />
                </View>
              </View>
            </TeamCard>

            <TeamCard colors={{ card: cardBg, border: colors.border }}>
              <SectionTitle
                title={isKo ? '팀원 초대' : 'Invite members'}
                subtitle={isKo ? '닉네임 또는 이메일로 팀원을 검색해 초대합니다.' : 'Search by nickname or email and invite members.'}
                colors={{ text: colors.text, textMuted: colors.textMuted }}
              />
              <TextInput
                value={searchQuery}
                onChangeText={(value) => {
                  setSearchQuery(value);
                  setSelectedMember(null);
                }}
                placeholder={isKo ? '닉네임 또는 이메일 검색' : 'Search by nickname or email'}
                placeholderTextColor={colors.textMuted}
                style={{
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: mutedCardBg,
                  color: colors.text,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 14,
                }}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {memberRoleOptions.map((role) => (
                  <ActionChip
                    key={role.team_role_id}
                    label={role.name}
                    active={memberRoleId === role.team_role_id}
                    onPress={() => setMemberRoleId(role.team_role_id)}
                    colors={{
                      primary: colors.primary,
                      cardSoft: colors.cardSoft,
                      border: colors.border,
                      text: colors.text,
                      textMuted: colors.textMuted,
                    }}
                  />
                ))}
              </View>
              {searchLoading ? (
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {isKo ? '검색 중...' : 'Searching...'}
                </Text>
              ) : null}
              {selectedMember ? (
                <View
                  style={{
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: mutedCardBg,
                    padding: 12,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                    {selectedMember.nickname || selectedMember.email || `#${selectedMember.member_id}`}
                  </Text>
                  {selectedMember.email ? (
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>{selectedMember.email}</Text>
                  ) : null}
                </View>
              ) : null}
              {!searchLoading && searchResults.length > 0 ? (
                <View
                  style={{
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: cardBg,
                    overflow: 'hidden',
                  }}
                >
                  {searchResults.map((item, index) => {
                    const label = item.nickname || item.email || `#${item.member_id}`;
                    return (
                      <Pressable
                        key={item.member_id}
                        onPress={() => {
                          setSelectedMember(item);
                          setSearchQuery(label);
                          setSearchResults([]);
                        }}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          borderTopWidth: index === 0 ? 0 : 1,
                          borderTopColor: colors.border,
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{label}</Text>
                        {item.email && item.nickname ? (
                          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.email}</Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              <PrimaryButton
                label={isKo ? '팀원 초대' : 'Invite member'}
                onPress={handleInvite}
                disabled={submitting || !selectedMember || !memberRoleId}
                colors={{ primary: colors.primary, border: colors.border }}
              />
            </TeamCard>

            <TeamCard colors={{ card: cardBg, border: colors.border }}>
              <SectionTitle
                title={isKo ? '팀원 목록' : 'Members'}
                subtitle={isKo ? '팀원의 역할을 바꾸거나 제거할 수 있습니다.' : 'Update roles or remove members.'}
                colors={{ text: colors.text, textMuted: colors.textMuted }}
              />
              {members.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                  {isKo ? '팀원이 없습니다.' : 'No members yet.'}
                </Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {members.map((member) => {
                    const isOwner = Number(team?.created_by) === Number(member.member_id);
                    const label = member.nickname || member.email || `#${member.member_id}`;
                    return (
                      <View
                        key={member.member_id}
                        style={{
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: mutedCardBg,
                          padding: 12,
                          gap: 10,
                        }}
                      >
                        <View style={{ gap: 4 }}>
                          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{label}</Text>
                          {member.email ? (
                            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{member.email}</Text>
                          ) : null}
                        </View>
                        {isOwner ? (
                          <ActionChip
                            label="Owner"
                            active
                            disabled
                            colors={{
                              primary: colors.primary,
                              cardSoft: colors.cardSoft,
                              border: colors.border,
                              text: colors.text,
                              textMuted: colors.textMuted,
                            }}
                          />
                        ) : (
                          <>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                              {roles.map((role) => (
                                <ActionChip
                                  key={`${member.member_id}:${role.team_role_id}`}
                                  label={role.name}
                                  active={member.role_id === role.team_role_id}
                                  onPress={() => handleUpdateMemberRole(member.member_id, role.team_role_id)}
                                  disabled={submitting}
                                  colors={{
                                    primary: colors.primary,
                                    cardSoft: colors.cardSoft,
                                    border: colors.border,
                                    text: colors.text,
                                    textMuted: colors.textMuted,
                                  }}
                                />
                              ))}
                            </ScrollView>
                            <PrimaryButton
                              label={isKo ? '팀원 제거' : 'Remove member'}
                              onPress={() => handleRemoveMember(member.member_id)}
                              disabled={submitting}
                              destructive
                              colors={{ primary: colors.primary, border: colors.border }}
                            />
                          </>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </TeamCard>

            <TeamCard colors={{ card: cardBg, border: colors.border }}>
              <SectionTitle
                title={isKo ? '역할 관리' : 'Roles'}
                subtitle={isKo ? '팀에 맞는 역할을 추가하고 삭제합니다.' : 'Create and delete roles for your team.'}
                colors={{ text: colors.text, textMuted: colors.textMuted }}
              />
              <TextInput
                value={newRoleName}
                onChangeText={setNewRoleName}
                placeholder={isKo ? '새 역할 이름' : 'New role name'}
                placeholderTextColor={colors.textMuted}
                style={{
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: mutedCardBg,
                  color: colors.text,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 14,
                }}
              />
              <PrimaryButton
                label={isKo ? '역할 추가' : 'Add role'}
                onPress={handleCreateRole}
                disabled={submitting || !newRoleName.trim()}
                colors={{ primary: colors.primary, border: colors.border }}
              />
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>
                  {isKo ? '편집할 역할 선택' : 'Choose a role to edit'}
                </Text>
                <View
                  style={{
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: mutedCardBg,
                    padding: 10,
                  }}
                >
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {roles.map((role) => (
                      <ActionChip
                        key={role.team_role_id}
                        label={role.memberCount ? `${role.name} · ${role.memberCount}` : role.name}
                        active={selectedRoleId === role.team_role_id}
                        onPress={() => setSelectedRoleId(role.team_role_id)}
                        colors={{
                          primary: colors.primary,
                          cardSoft: colors.cardSoft,
                          border: colors.border,
                          text: colors.text,
                          textMuted: colors.textMuted,
                        }}
                      />
                    ))}
                  </ScrollView>
                </View>
              </View>
              <SummaryBadge
                label={isKo ? '현재 편집 중인 역할' : 'Currently editing role'}
                value={
                  selectedRole
                    ? `${selectedRole.name}${selectedRole.memberCount ? (isKo ? ` · ${selectedRole.memberCount}명` : ` · ${selectedRole.memberCount} members`) : ''}`
                    : isKo
                      ? '선택된 역할 없음'
                      : 'No role selected'
                }
                helper={
                  selectedRole?.name === 'Owner'
                    ? isKo
                      ? 'Owner 역할은 모든 권한을 가지므로 수정할 수 없습니다.'
                      : 'Owner always has full permissions and cannot be edited.'
                    : selectedRoleSummary
                }
                colors={{
                  primary: colors.primary,
                  text: colors.text,
                  textMuted: colors.textMuted,
                  border: colors.border,
                }}
              />
              <PrimaryButton
                label={isKo ? '선택한 역할 삭제' : 'Delete selected role'}
                onPress={handleDeleteRole}
                disabled={submitting || !selectedRoleId || selectedRole?.name === 'Owner'}
                destructive
                colors={{ primary: colors.primary, border: colors.border }}
              />
            </TeamCard>

            <TeamCard colors={{ card: cardBg, border: colors.border }}>
              <SectionTitle
                title={isKo ? '권한 관리' : 'Permissions'}
                subtitle={
                  selectedRole
                    ? isKo
                      ? `${selectedRole.name} 역할의 권한을 설정합니다.`
                      : `Manage permissions for the ${selectedRole.name} role.`
                    : isKo
                      ? '역할을 먼저 선택하세요.'
                      : 'Select a role first.'
                }
                colors={{ text: colors.text, textMuted: colors.textMuted }}
              />
              {selectedRole ? (
                <SummaryBadge
                  label={isKo ? '권한 편집 대상' : 'Editing permissions for'}
                  value={
                    `${selectedRole.name}${selectedRole.memberCount ? (isKo ? ` · ${selectedRole.memberCount}명` : ` · ${selectedRole.memberCount} members`) : ''}`
                  }
                  helper={
                    selectedRole?.name === 'Owner'
                      ? isKo
                        ? 'Owner 역할은 모든 권한을 가집니다.'
                        : 'Owner always has full permissions.'
                      : isKo
                        ? '아래 권한 칩을 눌러 이 역할의 권한을 조정하세요.'
                        : 'Use the permission chips below to update this role.'
                  }
                  colors={{
                    primary: colors.primary,
                    text: colors.text,
                    textMuted: colors.textMuted,
                    border: colors.border,
                  }}
                />
              ) : null}
              {selectedRole?.name === 'Owner' ? (
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                  {isKo ? 'Owner 역할은 모든 권한을 가집니다.' : 'Owner always has full permissions.'}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {permissionList.map((permission) => (
                  <ActionChip
                    key={permission.code}
                    label={permission.label}
                    active={permission.assigned}
                    onPress={() => handleTogglePermission(permission.code)}
                    disabled={!selectedRoleId || selectedRole?.name === 'Owner'}
                    colors={{
                      primary: colors.primary,
                      cardSoft: colors.cardSoft,
                      border: colors.border,
                      text: colors.text,
                      textMuted: colors.textMuted,
                    }}
                  />
                ))}
              </View>
              <PrimaryButton
                label={isKo ? '권한 저장' : 'Save permissions'}
                onPress={handleSavePermissions}
                disabled={submitting || !selectedRoleId || selectedRole?.name === 'Owner'}
                colors={{ primary: colors.primary, border: colors.border }}
              />
            </TeamCard>
          </>
        )}
      </ScrollView>
    </View>
  );
}
