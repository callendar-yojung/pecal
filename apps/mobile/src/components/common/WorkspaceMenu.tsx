import { Pressable, Text, View } from 'react-native';
import type { Workspace } from '../../lib/types';
import { useThemeMode } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/I18nContext';
import { createStyles } from '../../styles/createStyles';

type TeamWorkspace = Workspace & { teamName: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSelectPersonal: () => void;
  onSelectTeam: (workspaceId: number) => void;
  onOpenCreateTeam: () => void;
  onLogout: () => void;
  teamWorkspaces: TeamWorkspace[];
  selectedWorkspaceId: number | null;
  isPersonalSelected: boolean;
};

export function WorkspaceMenu({
  open,
  onClose,
  onSelectPersonal,
  onSelectTeam,
  onOpenCreateTeam,
  onLogout,
  teamWorkspaces,
  selectedWorkspaceId,
  isPersonalSelected,
}: Props) {
  const { colors } = useThemeMode();
  const { t } = useI18n();
  const s = createStyles(colors);

  if (!open) return null;

  return (
    <View style={s.modeDropdownMenu}>
      <Pressable
        style={[s.modeMenuItem, isPersonalSelected ? s.modeMenuItemActive : null]}
        onPress={() => {
          onSelectPersonal();
          onClose();
        }}
      >
        <Text style={[s.modeMenuText, isPersonalSelected ? s.modeMenuTextActive : null]}>{t('workspacePersonal')}</Text>
      </Pressable>

      {teamWorkspaces.map((teamWs) => {
        const active = selectedWorkspaceId === teamWs.workspace_id;
        return (
          <Pressable
            key={teamWs.workspace_id}
            style={[s.modeMenuItem, active ? s.modeMenuItemActive : null]}
            onPress={() => {
              onSelectTeam(teamWs.workspace_id);
              onClose();
            }}
          >
            <Text style={[s.modeMenuText, active ? s.modeMenuTextActive : null]}>{teamWs.teamName}</Text>
          </Pressable>
        );
      })}

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
