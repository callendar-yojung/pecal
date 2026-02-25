import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { TeamItem, Workspace } from '../../lib/types';
import { useThemeMode } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/I18nContext';
import { createStyles } from '../../styles/createStyles';

type TeamWorkspace = Workspace & { teamName: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSelectWorkspace: (workspaceId: number) => void;
  onOpenCreateTeam: () => void;
  onLogout: () => void;
  workspaces: Workspace[];
  teams: TeamItem[];
  teamWorkspaces: TeamWorkspace[];
  selectedWorkspaceId: number | null;
  selectedWorkspaceType?: Workspace['type'] | null;
  selectedWorkspaceOwnerId?: number | null;
};

export function WorkspaceMenu({
  open,
  onClose,
  onSelectWorkspace,
  onOpenCreateTeam,
  onLogout,
  workspaces,
  teams,
  teamWorkspaces,
  selectedWorkspaceId,
  selectedWorkspaceType,
  selectedWorkspaceOwnerId,
}: Props) {
  const { colors } = useThemeMode();
  const { t } = useI18n();
  const s = createStyles(colors);
  const [scope, setScope] = useState<'personal' | 'team'>('personal');
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  const personalWorkspaces = useMemo(
    () => workspaces.filter((workspace) => workspace.type === 'personal'),
    [workspaces]
  );

  const teamGroups = useMemo(() => {
    return teams
      .map((team) => ({
        teamId: team.id,
        teamName: team.name,
        workspaces: teamWorkspaces.filter((workspace) => workspace.owner_id === team.id),
      }))
      .sort((a, b) => a.teamName.localeCompare(b.teamName));
  }, [teams, teamWorkspaces]);

  const visibleWorkspaces = useMemo(() => {
    if (scope === 'personal') return personalWorkspaces;
    if (!selectedTeamId) return [];
    const found = teamGroups.find((group) => group.teamId === selectedTeamId);
    return found?.workspaces ?? [];
  }, [scope, personalWorkspaces, selectedTeamId, teamGroups]);

  useEffect(() => {
    if (!open) return;
    if (selectedWorkspaceType === 'team') {
      setScope('team');
      setSelectedTeamId(selectedWorkspaceOwnerId ?? teamGroups[0]?.teamId ?? null);
      return;
    }
    setScope('personal');
    setSelectedTeamId(teamGroups[0]?.teamId ?? null);
  }, [open, selectedWorkspaceOwnerId, selectedWorkspaceType, teamGroups]);

  if (!open) return null;

  return (
    <View style={s.modeDropdownMenu}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          style={[s.modeMenuItem, { flex: 1 }, scope === 'personal' ? s.modeMenuItemActive : null]}
          onPress={() => setScope('personal')}
        >
          <Text style={[s.modeMenuText, scope === 'personal' ? s.modeMenuTextActive : null]}>{t('workspacePersonal')}</Text>
        </Pressable>
        <Pressable
          style={[s.modeMenuItem, { flex: 1 }, scope === 'team' ? s.modeMenuItemActive : null]}
          onPress={() => {
            setScope('team');
            if (!selectedTeamId) setSelectedTeamId(teamGroups[0]?.teamId ?? null);
          }}
        >
          <Text style={[s.modeMenuText, scope === 'team' ? s.modeMenuTextActive : null]}>팀</Text>
        </Pressable>
      </View>

      {scope === 'team' ? (
        <View style={s.row}>
          {teamGroups.map((group) => (
            <Pressable
              key={group.teamId}
              onPress={() => setSelectedTeamId(group.teamId)}
              style={[
                s.workspacePill,
                { marginRight: 0, paddingVertical: 6, paddingHorizontal: 10 },
                selectedTeamId === group.teamId ? s.workspacePillActive : null,
              ]}
            >
              <Text style={[s.workspacePillText, selectedTeamId === group.teamId ? s.workspacePillTextActive : null]}>
                {group.teamName}
              </Text>
            </Pressable>
          ))}
          {!teamGroups.length ? <Text style={s.modeMenuText}>팀이 없습니다.</Text> : null}
        </View>
      ) : null}

      {visibleWorkspaces.map((workspace) => {
        const active = selectedWorkspaceId === workspace.workspace_id;
        return (
          <Pressable
            key={workspace.workspace_id}
            style={[s.modeMenuItem, active ? s.modeMenuItemActive : null]}
            onPress={() => {
              onSelectWorkspace(workspace.workspace_id);
              onClose();
            }}
          >
            <Text style={[s.modeMenuText, active ? s.modeMenuTextActive : null]}>{workspace.name}</Text>
          </Pressable>
        );
      })}
      {!visibleWorkspaces.length ? <Text style={s.modeMenuText}>{t('noWorkspace')}</Text> : null}

      <Pressable
        style={s.modeMenuCreate}
        onPress={() => {
          onOpenCreateTeam();
          onClose();
        }}
      >
        <Text style={s.modeMenuCreateText}>{t('workspaceCreateTeam')}</Text>
      </Pressable>
      <Pressable style={s.modeMenuLogout} onPress={onLogout}>
        <Text style={s.modeMenuLogoutText}>{t('logout')}</Text>
      </Pressable>
    </View>
  );
}
