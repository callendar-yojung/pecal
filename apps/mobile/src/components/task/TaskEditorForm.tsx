import { Pressable, Text, TextInput, View } from 'react-native';
import type { TaskStatus } from '../../lib/types';
import { useThemeMode } from '../../contexts/ThemeContext';
import { createStyles } from '../../styles/createStyles';
import { SharedRichTextWebView } from '../editor/SharedRichTextWebView';
import { DateTimePickerField } from './DateTimePickerField';

type Props = {
  title: string;
  startTime: string;
  endTime: string;
  status: TaskStatus;
  allDay: boolean;
  reminderMinutes: string;
  rrule: string;
  contentJson: string;
  saving: boolean;
  submitLabel: string;
  onTitleChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onStatusChange: (status: TaskStatus) => void;
  onAllDayChange: (next: boolean) => void;
  onReminderMinutesChange: (minutes: string) => void;
  onRruleChange: (value: string) => void;
  onContentChange: (json: string) => void;
  onSubmit: () => void;
  onDelete?: () => void;
};

export function TaskEditorForm({
  title,
  startTime,
  endTime,
  status,
  allDay,
  reminderMinutes,
  rrule,
  contentJson,
  saving,
  submitLabel,
  onTitleChange,
  onStartTimeChange,
  onEndTimeChange,
  onStatusChange,
  onAllDayChange,
  onReminderMinutesChange,
  onRruleChange,
  onContentChange,
  onSubmit,
  onDelete,
}: Props) {
  const { colors } = useThemeMode();
  const s = createStyles(colors);

  return (
    <View style={[s.panel, { borderRadius: 16, gap: 10 }]}>
      <Text style={s.formTitle}>일정 입력</Text>

      <TextInput
        value={title}
        onChangeText={onTitleChange}
        placeholder="제목"
        style={s.input}
        placeholderTextColor={colors.textMuted}
      />
      <DateTimePickerField label="시작 시간" value={startTime} onChange={onStartTimeChange} />
      <DateTimePickerField label="종료 시간" value={endTime} onChange={onEndTimeChange} />

      <SharedRichTextWebView
        valueJson={contentJson}
        valueText=""
        placeholder="태스크 상세 내용을 입력하세요."
        minHeight={220}
        onChange={(json) => onContentChange(json)}
      />

      <View style={s.row}>
        {(['TODO', 'IN_PROGRESS', 'DONE'] as const).map((item) => (
          <Pressable
            key={item}
            onPress={() => onStatusChange(item)}
            style={[
              s.workspacePill,
              { marginRight: 0, paddingVertical: 7, paddingHorizontal: 10 },
              status === item ? s.workspacePillActive : null,
            ]}
          >
            <Text style={[s.workspacePillText, status === item ? s.workspacePillTextActive : null]}>
              {item}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={s.row}>
        <Pressable
          onPress={() => onAllDayChange(!allDay)}
          style={[
            s.workspacePill,
            { marginRight: 0, paddingVertical: 7, paddingHorizontal: 10 },
            allDay ? s.workspacePillActive : null,
          ]}
        >
          <Text style={[s.workspacePillText, allDay ? s.workspacePillTextActive : null]}>종일 일정</Text>
        </Pressable>
        {[5, 10, 15, 30, 60].map((min) => (
          <Pressable
            key={min}
            onPress={() => onReminderMinutesChange(String(min))}
            style={[
              s.workspacePill,
              { marginRight: 0, paddingVertical: 7, paddingHorizontal: 10 },
              reminderMinutes === String(min) ? s.workspacePillActive : null,
            ]}
          >
            <Text style={[s.workspacePillText, reminderMinutes === String(min) ? s.workspacePillTextActive : null]}>
              {min}m 알림
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={s.row}>
        <Pressable style={s.primaryButtonHalf} onPress={onSubmit}>
          <Text style={s.primaryButtonText}>{saving ? '저장 중...' : submitLabel}</Text>
        </Pressable>
        {onDelete ? (
          <Pressable style={s.secondaryButtonHalf} onPress={onDelete}>
            <Text style={[s.secondaryButtonText, { color: '#EF4444' }]}>삭제</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
