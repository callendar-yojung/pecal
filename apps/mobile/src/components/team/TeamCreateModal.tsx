import { Pressable, Text, TextInput, View } from 'react-native';
import { useThemeMode } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/I18nContext';
import { createStyles } from '../../styles/createStyles';

type Props = {
  open: boolean;
  step: 'details' | 'plan';
  teamName: string;
  teamDescription: string;
  creatingTeam: boolean;
  onTeamNameChange: (v: string) => void;
  onTeamDescriptionChange: (v: string) => void;
  onClose: () => void;
  onCreate: () => void;
  onSelectPlan: (plan: 'free' | 'paid') => void;
};

export function TeamCreateModal({
  open,
  step,
  teamName,
  teamDescription,
  creatingTeam,
  onTeamNameChange,
  onTeamDescriptionChange,
  onClose,
  onCreate,
  onSelectPlan,
}: Props) {
  const { colors } = useThemeMode();
  const { t } = useI18n();
  const s = createStyles(colors);

  if (!open) return null;

  return (
    <View style={s.teamCreatePanel}>
      {step === 'details' ? (
        <>
          <Text style={s.formTitle}>{t('teamCreateTitle')}</Text>
          <TextInput value={teamName} onChangeText={onTeamNameChange} placeholder={t('teamName')} style={s.input} placeholderTextColor={colors.textMuted} />
          <TextInput value={teamDescription} onChangeText={onTeamDescriptionChange} placeholder={t('teamDescription')} style={s.input} placeholderTextColor={colors.textMuted} />
          <View style={s.row}>
            <Pressable style={s.secondaryButtonHalf} onPress={onClose}>
              <Text style={s.secondaryButtonText}>{t('commonCancel')}</Text>
            </Pressable>
            <Pressable style={s.primaryButtonHalf} onPress={onCreate} disabled={creatingTeam}>
              <Text style={s.primaryButtonText}>{creatingTeam ? t('teamCreating') : t('teamNext')}</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={s.formTitle}>{t('teamPlanTitle')}</Text>
          <Pressable style={s.planButton} onPress={() => onSelectPlan('free')}>
            <Text style={s.planTitle}>{t('teamFreePlan')}</Text>
            <Text style={s.planDesc}>{t('teamFreePlanDesc')}</Text>
          </Pressable>
          <Pressable style={s.planButton} onPress={() => onSelectPlan('paid')}>
            <Text style={s.planTitle}>{t('teamPaidPlan')}</Text>
            <Text style={s.planDesc}>{t('teamPaidPlanDesc')}</Text>
          </Pressable>
          <Pressable style={s.secondaryButtonHalf} onPress={onClose}>
            <Text style={s.secondaryButtonText}>{t('commonClose')}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
