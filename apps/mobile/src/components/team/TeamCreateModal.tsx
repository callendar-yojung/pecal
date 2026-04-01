import { Pressable, Text, TextInput, View } from 'react-native';
import { useThemeMode } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/I18nContext';
import { createStyles } from '../../styles/createStyles';

type Props = {
  open: boolean;
  teamName: string;
  teamDescription: string;
  creatingTeam: boolean;
  onTeamNameChange: (v: string) => void;
  onTeamDescriptionChange: (v: string) => void;
  onClose: () => void;
  onCreate: () => void;
};

export function TeamCreateModal({
  open,
  teamName,
  teamDescription,
  creatingTeam,
  onTeamNameChange,
  onTeamDescriptionChange,
  onClose,
  onCreate,
}: Props) {
  const { colors } = useThemeMode();
  const { t } = useI18n();
  const s = createStyles(colors);

  if (!open) return null;

  return (
    <View style={s.teamCreatePanel}>
      <Text style={s.formTitle}>{t('teamCreateTitle')}</Text>
      <TextInput value={teamName} onChangeText={onTeamNameChange} placeholder={t('teamName')} style={s.input} placeholderTextColor={colors.textMuted} />
      <TextInput value={teamDescription} onChangeText={onTeamDescriptionChange} placeholder={t('teamDescription')} style={s.input} placeholderTextColor={colors.textMuted} />
      <View style={s.row}>
        <Pressable style={s.secondaryButtonHalf} onPress={onClose}>
          <Text style={s.secondaryButtonText}>{t('commonCancel')}</Text>
        </Pressable>
        <Pressable style={s.primaryButtonHalf} onPress={onCreate} disabled={creatingTeam}>
          <Text style={s.primaryButtonText}>{creatingTeam ? t('teamCreating') : t('createTeam')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
