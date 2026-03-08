import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { TASK_COLOR_OPTIONS } from '../../lib/task-colors';
import type { TagItem, TaskStatus } from '../../lib/types';
import { useThemeMode } from '../../contexts/ThemeContext';
import { createStyles } from '../../styles/createStyles';
import { SharedRichTextEditor } from '../editor/SharedRichTextEditor';
import { SelectDropdown } from '../common/SelectDropdown';

type Props = {
  title: string;
  startTime: string;
  endTime: string;
  status: TaskStatus;
  color: string;
  selectedTagIds: number[];
  availableTags: TagItem[];
  allDay: boolean;
  reminderMinutes: string;
  rrule: string;
  contentJson: string;
  saving: boolean;
  creatingTag?: boolean;
  submitLabel: string;
  onTitleChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onStatusChange: (status: TaskStatus) => void;
  onColorChange: (color: string) => void;
  onSelectedTagIdsChange: (next: number[]) => void;
  onCreateTag?: (name: string, color: string) => Promise<void>;
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
  color,
  selectedTagIds,
  availableTags,
  allDay,
  reminderMinutes,
  rrule,
  contentJson,
  saving,
  creatingTag = false,
  submitLabel,
  onTitleChange,
  onStartTimeChange,
  onEndTimeChange,
  onStatusChange,
  onColorChange,
  onSelectedTagIdsChange,
  onCreateTag,
  onAllDayChange,
  onReminderMinutesChange,
  onRruleChange,
  onContentChange,
  onSubmit,
  onDelete,
}: Props) {
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const [startTimeOpen, setStartTimeOpen] = useState(false);
  const [endTimeOpen, setEndTimeOpen] = useState(false);
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  const statusLabels: Record<TaskStatus, string> = {
    TODO: '예정',
    IN_PROGRESS: '진행중',
    DONE: '완료',
  };
  const reminderOptions = [
    { key: '0', label: '정시 알림' },
    { key: '5', label: '5분 전' },
    { key: '10', label: '10분 전' },
    { key: '15', label: '15분 전' },
    { key: '30', label: '30분 전' },
    { key: '60', label: '1시간 전' },
  ] as const;
  const timeOptions = useMemo(
    () =>
      Array.from({ length: 48 }, (_, idx) => {
        const hours = String(Math.floor(idx / 2)).padStart(2, '0');
        const minutes = idx % 2 === 0 ? '00' : '30';
        return `${hours}:${minutes}`;
      }),
    []
  );

  const splitDateTime = (value: string) => {
    if (!value) return { date: '', time: '' };
    const [date, time = ''] = value.split('T');
    return { date, time: time.slice(0, 5) };
  };

  const buildDateTime = (date: string, time: string, fallback: string) => {
    const trimmedDate = date.trim();
    const nextDate = trimmedDate || splitDateTime(fallback).date;
    const nextTime = time || splitDateTime(fallback).time || '09:00';
    return nextDate && nextTime ? `${nextDate}T${nextTime}` : fallback;
  };

  const startParts = splitDateTime(startTime);
  const endParts = splitDateTime(endTime);
  const createTag = async () => {
    const name = newTagName.trim();
    if (!name || !onCreateTag || creatingTag) return;
    try {
      setTagError(null);
      await onCreateTag(name, color);
      setNewTagName('');
      setShowNewTagInput(false);
    } catch (error) {
      setTagError(error instanceof Error ? error.message : '태그를 추가하지 못했습니다.');
    }
  };

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

      <View style={{ gap: 6 }}>
        <Text style={s.formTitle}>시작 시간</Text>
        <View style={[s.row, { alignItems: 'flex-start' }]}>
          <TextInput
            value={startParts.date}
            onChangeText={(value) => onStartTimeChange(buildDateTime(value, startParts.time, startTime))}
            placeholder="YYYY-MM-DD"
            style={[s.input, { flex: 1 }]}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={{ flex: 1 }}>
            <SelectDropdown
              value={startParts.time || '09:00'}
              options={timeOptions.map((item) => ({ key: item, label: item }))}
              open={startTimeOpen}
              onToggle={() => setStartTimeOpen((prev) => !prev)}
              onSelect={(value) => {
                onStartTimeChange(buildDateTime(startParts.date, value, startTime));
                setStartTimeOpen(false);
              }}
            />
          </View>
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={s.formTitle}>종료 시간</Text>
        <View style={[s.row, { alignItems: 'flex-start' }]}>
          <TextInput
            value={endParts.date}
            onChangeText={(value) => onEndTimeChange(buildDateTime(value, endParts.time, endTime))}
            placeholder="YYYY-MM-DD"
            style={[s.input, { flex: 1 }]}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={{ flex: 1 }}>
            <SelectDropdown
              value={endParts.time || '09:30'}
              options={timeOptions.map((item) => ({ key: item, label: item }))}
              open={endTimeOpen}
              onToggle={() => setEndTimeOpen((prev) => !prev)}
              onSelect={(value) => {
                onEndTimeChange(buildDateTime(endParts.date, value, endTime));
                setEndTimeOpen(false);
              }}
            />
          </View>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={s.formTitle}>태스크 컬러</Text>
        <View style={[s.row, { flexWrap: 'wrap', gap: 10 }]}>
          {TASK_COLOR_OPTIONS.map((item) => {
            const active = color === item.value;
            return (
              <Pressable
                key={item.value}
                onPress={() => onColorChange(item.value)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  backgroundColor: item.value,
                  borderWidth: active ? 3 : 1,
                  borderColor: active ? colors.text : `${colors.border}66`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {active ? <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={s.formTitle}>태그</Text>
        {showNewTagInput ? (
          <View style={[s.row, { alignItems: 'center' }]}>
            <TextInput
              value={newTagName}
              onChangeText={(value) => {
                setNewTagName(value);
                if (tagError) setTagError(null);
              }}
              placeholder="새 태그 이름"
              style={[s.input, { flex: 1 }]}
              placeholderTextColor={colors.textMuted}
            />
            <Pressable
              onPress={() => void createTag()}
              style={[s.secondaryButton, { width: 'auto', paddingHorizontal: 14, minHeight: 0, paddingVertical: 10 }]}
            >
              <Text style={s.secondaryButtonText}>{creatingTag ? '추가 중...' : '저장'}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setShowNewTagInput(false);
                setNewTagName('');
                setTagError(null);
              }}
              style={[s.secondaryButton, { width: 'auto', paddingHorizontal: 14, minHeight: 0, paddingVertical: 10 }]}
            >
              <Text style={s.secondaryButtonText}>취소</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setShowNewTagInput(true)}
            style={[s.secondaryButton, { width: 'auto', alignSelf: 'flex-start', paddingHorizontal: 14, minHeight: 0, paddingVertical: 10 }]}
          >
            <Text style={s.secondaryButtonText}>태그 추가</Text>
          </Pressable>
        )}
        {tagError ? <Text style={[s.itemMeta, { color: '#DC2626' }]}>{tagError}</Text> : null}
        <View style={[s.row, { flexWrap: 'wrap', gap: 8 }]}>
          {availableTags.length === 0 ? (
            <Text style={s.subtleText}>선택 가능한 태그가 없습니다.</Text>
          ) : (
            availableTags.map((tag) => {
              const active = selectedTagIds.includes(tag.tag_id);
              return (
                <Pressable
                  key={tag.tag_id}
                  onPress={() =>
                    onSelectedTagIdsChange(
                      active ? selectedTagIds.filter((id) => id !== tag.tag_id) : [...selectedTagIds, tag.tag_id]
                    )
                  }
                  style={[
                    s.workspacePill,
                    {
                      marginRight: 0,
                      paddingVertical: 7,
                      paddingHorizontal: 10,
                      borderColor: active ? tag.color ?? colors.primary : colors.border,
                      backgroundColor: active ? `${tag.color ?? colors.primary}18` : colors.cardSoft,
                    },
                  ]}
                >
                  <Text style={[s.workspacePillText, { color: active ? colors.text : colors.textMuted }]}>
                    {tag.name}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      </View>

      <SharedRichTextEditor
        valueJson={contentJson}
        valueText=""
        placeholder="태스크 상세 내용을 입력하세요."
        minHeight={220}
        implementation="webview"
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
              {statusLabels[item]}
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
        <Text style={[s.itemMeta, { alignSelf: 'center' }]}>시작 기준 알림</Text>
        {reminderOptions.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => onReminderMinutesChange(item.key)}
            style={[
              s.workspacePill,
              { marginRight: 0, paddingVertical: 7, paddingHorizontal: 10 },
              reminderMinutes === item.key ? s.workspacePillActive : null,
            ]}
          >
            <Text style={[s.workspacePillText, reminderMinutes === item.key ? s.workspacePillTextActive : null]}>
              {item.key === '0' ? item.label : `시작 ${item.label}`}
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
