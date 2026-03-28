import { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import ColorPicker from 'reanimated-color-picker/lib/module/index.js';
import { HueSlider, Panel1 } from 'reanimated-color-picker/lib/module/index.js';
import { TASK_COLOR_OPTIONS } from '../../lib/task-colors';
import type { CategoryItem, TagItem, TaskAttachmentItem, TaskStatus } from '../../lib/types';
import { useThemeMode } from '../../contexts/ThemeContext';
import { createStyles } from '../../styles/createStyles';
import { SharedRichTextEditor } from '../editor/SharedRichTextEditor';
import { GsxButton, GsxCard, GsxHeading } from '../../ui/gsx';

type Props = {
  scheduleMode?: 'single' | 'recurring';
  title: string;
  startTime: string;
  endTime: string;
  status: TaskStatus;
  color: string;
  selectedCategoryId?: number | null;
  availableCategories?: CategoryItem[];
  selectedTagIds: number[];
  availableTags: TagItem[];
  attachments?: TaskAttachmentItem[];
  uploadingAttachmentIds?: string[];
  attachmentMode?: 'pending' | 'saved';
  allDay: boolean;
  reminderMinutes: string;
  rrule: string;
  showRecurrenceControls?: boolean;
  hideRecurrenceToggle?: boolean;
  recurrenceEnabled?: boolean;
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  recurrenceWeekdays?: number[];
  contentJson: string;
  saving: boolean;
  creatingTag?: boolean;
  colorOptions?: string[];
  submitLabel: string;
  onTitleChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onStatusChange: (status: TaskStatus) => void;
  onColorChange: (color: string) => void;
  onSaveCustomColor?: (value: string) => Promise<string | null>;
  onCategoryChange?: (categoryId: number | null) => void;
  onCreateCategory?: (name: string, color: string) => Promise<void>;
  onUpdateCategory?: (categoryId: number, name: string, color: string) => Promise<void>;
  onDeleteCategory?: (categoryId: number) => Promise<void>;
  onSelectedTagIdsChange: (next: number[]) => void;
  onCreateTag?: (name: string, color: string) => Promise<void>;
  onPickAttachment?: () => void;
  onRemoveAttachment?: (attachmentId: number | string) => void;
  onAllDayChange: (next: boolean) => void;
  onReminderMinutesChange: (minutes: string) => void;
  onRruleChange: (value: string) => void;
  onRecurrenceEnabledChange?: (enabled: boolean) => void;
  onRecurrenceStartDateChange?: (date: string) => void;
  onRecurrenceEndDateChange?: (date: string) => void;
  onRecurrenceWeekdaysChange?: (weekdays: number[]) => void;
  onContentChange: (json: string) => void;
  onSubmit: () => void;
  onDelete?: () => void;
};

export function TaskEditorForm({
  scheduleMode = 'single',
  title,
  startTime,
  endTime,
  status,
  color,
  selectedCategoryId = null,
  availableCategories = [],
  selectedTagIds,
  availableTags,
  attachments = [],
  uploadingAttachmentIds = [],
  attachmentMode = 'saved',
  allDay,
  reminderMinutes,
  rrule,
  showRecurrenceControls = false,
  hideRecurrenceToggle = false,
  recurrenceEnabled = false,
  recurrenceStartDate = '',
  recurrenceEndDate = '',
  recurrenceWeekdays = [],
  contentJson,
  saving,
  creatingTag = false,
  colorOptions,
  submitLabel,
  onTitleChange,
  onStartTimeChange,
  onEndTimeChange,
  onStatusChange,
  onColorChange,
  onSaveCustomColor,
  onCategoryChange,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onSelectedTagIdsChange,
  onCreateTag,
  onPickAttachment,
  onRemoveAttachment,
  onAllDayChange,
  onReminderMinutesChange,
  onRruleChange,
  onRecurrenceEnabledChange,
  onRecurrenceStartDateChange,
  onRecurrenceEndDateChange,
  onRecurrenceWeekdaysChange,
  onContentChange,
  onSubmit,
  onDelete,
}: Props) {
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const [pickerTarget, setPickerTarget] = useState<
    'startDate' | 'startTime' | 'endDate' | 'endTime' | 'repeatStartDate' | 'repeatEndDate' | null
  >(null);
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState(false);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [customColorInput, setCustomColorInput] = useState('');
  const [customColorError, setCustomColorError] = useState<string | null>(null);
  const [savingCustomColor, setSavingCustomColor] = useState(false);
  const [pickerRgbText, setPickerRgbText] = useState('');
  const statusLabels: Record<TaskStatus, string> = {
    TODO: '완료 전',
    IN_PROGRESS: '완료 전',
    DONE: '완료',
  };
  const normalizedStatus: 'TODO' | 'DONE' = status === 'DONE' ? 'DONE' : 'TODO';
  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
  };
  const reminderOptions = [
    { key: '0', label: '정시 알림' },
    { key: '5', label: '5분 전' },
    { key: '10', label: '10분 전' },
    { key: '15', label: '15분 전' },
    { key: '30', label: '30분 전' },
    { key: '60', label: '1시간 전' },
  ] as const;
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
  const parsePickerDate = (value: string, fallbackTime: string) => {
    const { date, time } = splitDateTime(value);
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const targetTime = time || fallbackTime;
    const parsed = new Date(`${targetDate}T${targetTime}:00`);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  };
  const formatDatePart = (selected: Date) => {
    const year = selected.getFullYear();
    const month = String(selected.getMonth() + 1).padStart(2, '0');
    const day = String(selected.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const startParts = splitDateTime(startTime);
  const endParts = splitDateTime(endTime);
  const repeatStartParts = splitDateTime(recurrenceStartDate);
  const repeatEndParts = splitDateTime(recurrenceEndDate);
  const activePickerDate =
    pickerTarget === 'startDate' || pickerTarget === 'startTime'
      ? parsePickerDate(startTime, '09:00')
      : pickerTarget === 'repeatStartDate'
        ? parsePickerDate(recurrenceStartDate || startTime, '00:00')
        : pickerTarget === 'repeatEndDate'
          ? parsePickerDate(recurrenceEndDate || endTime, '00:00')
          : parsePickerDate(endTime, '09:30');
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
  const createCategory = async () => {
    const name = newCategoryName.trim();
    if (!name || !onCreateCategory || creatingCategory) return;
    try {
      setCategoryError(null);
      setCreatingCategory(true);
      await onCreateCategory(name, color);
      setNewCategoryName('');
      setShowNewCategoryInput(false);
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : '카테고리를 추가하지 못했습니다.');
    } finally {
      setCreatingCategory(false);
    }
  };
  useEffect(() => {
    const selected = availableCategories.find(
      (item) => Number(item.category_id) === Number(selectedCategoryId),
    );
    setEditCategoryName(selected?.name ?? '');
  }, [availableCategories, selectedCategoryId]);

  const updateCategory = async () => {
    const categoryId = Number(selectedCategoryId);
    const name = editCategoryName.trim();
    if (!onUpdateCategory || !Number.isFinite(categoryId) || categoryId <= 0 || !name || editingCategory) return;
    try {
      setCategoryError(null);
      setEditingCategory(true);
      await onUpdateCategory(categoryId, name, color);
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : '카테고리를 수정하지 못했습니다.');
    } finally {
      setEditingCategory(false);
    }
  };

  const deleteCategory = async () => {
    const categoryId = Number(selectedCategoryId);
    if (!onDeleteCategory || !Number.isFinite(categoryId) || categoryId <= 0 || deletingCategory) return;
    try {
      setCategoryError(null);
      setDeletingCategory(true);
      await onDeleteCategory(categoryId);
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : '카테고리를 삭제하지 못했습니다.');
    } finally {
      setDeletingCategory(false);
    }
  };
  const saveCustomColor = async () => {
    if (!onSaveCustomColor || savingCustomColor) return;
    setSavingCustomColor(true);
    try {
      setCustomColorError(null);
      const saved = await onSaveCustomColor(customColorInput);
      if (!saved) {
        setCustomColorError('RGB 또는 HEX 형식으로 입력하세요. 예: rgb(120,34,255), #7A22FF');
        return;
      }
      onColorChange(saved);
      setCustomColorInput('');
    } catch (error) {
      setCustomColorError(error instanceof Error ? error.message : '색상을 저장하지 못했습니다.');
    } finally {
      setSavingCustomColor(false);
    }
  };
  useEffect(() => {
    setCustomColorInput(color.toUpperCase());
    setPickerRgbText('');
  }, [color]);
  const handlePickerChange = (next: { hex?: string; rgb?: string }) => {
    const nextHex = String(next.hex || '').toUpperCase();
    if (!nextHex) return;
    setCustomColorInput(nextHex);
    setPickerRgbText(String(next.rgb || ''));
    if (customColorError) setCustomColorError(null);
    onColorChange(nextHex);
  };
  const renderDateTimeField = (params: {
    kind: "date" | "time";
    value: string;
    placeholder: string;
    onPress: () => void;
  }) => {
    const isDate = params.kind === "date";
    return (
      <Pressable
        onPress={params.onPress}
        style={[
          s.input,
          {
            flex: 1,
            minHeight: 74,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 9,
            justifyContent: "center",
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", marginBottom: 2 }}>
          {isDate ? "날짜" : "시간"}
        </Text>
        <View style={{ gap: 4 }}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={{
              color: colors.text,
              fontSize: isDate ? 17 : 22,
              fontWeight: "800",
              letterSpacing: isDate ? -0.2 : 0.2,
            }}
          >
            {params.value || params.placeholder}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>
            {isDate ? "날짜 선택" : "시간 선택"}
          </Text>
        </View>
      </Pressable>
    );
  };
  const helperTextStyle = { color: colors.textMuted, fontSize: 12, fontWeight: '600' as const };
  const errorTextStyle = { color: '#DC2626', fontSize: 12, fontWeight: '700' as const };
  const handleTimePickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed') {
      setPickerTarget(null);
      return;
    }
    if (!selected) return;

    if (pickerTarget === 'startDate') {
      onStartTimeChange(buildDateTime(formatDatePart(selected), startParts.time, startTime));
    } else if (pickerTarget === 'endDate') {
      onEndTimeChange(buildDateTime(formatDatePart(selected), endParts.time, endTime));
    } else if (pickerTarget === 'repeatStartDate') {
      onRecurrenceStartDateChange?.(formatDatePart(selected));
      if (recurrenceEndDate && formatDatePart(selected) > recurrenceEndDate) {
        onRecurrenceEndDateChange?.(formatDatePart(selected));
      }
    } else if (pickerTarget === 'repeatEndDate') {
      onRecurrenceEndDateChange?.(formatDatePart(selected));
    } else {
      const hours = String(selected.getHours()).padStart(2, '0');
      const minutes = String(selected.getMinutes()).padStart(2, '0');
      const nextTime = `${hours}:${minutes}`;

      if (pickerTarget === 'startTime') {
        onStartTimeChange(buildDateTime(startParts.date, nextTime, startTime));
      } else {
        onEndTimeChange(buildDateTime(endParts.date, nextTime, endTime));
      }
    }

    if (Platform.OS !== 'ios') {
      setPickerTarget(null);
    }
  };

  return (
    <GsxCard className="gap-3">
      <GsxHeading className="text-lg">일정 입력</GsxHeading>

      <TextInput
        value={title}
        onChangeText={onTitleChange}
        placeholder="제목"
        style={s.input}
        placeholderTextColor={colors.textMuted}
      />

      {showRecurrenceControls ? (
        <GsxCard className="gap-2">
          <GsxHeading className="text-base">반복 일정</GsxHeading>
          <Text style={s.itemMeta}>기간과 요일을 선택하면 해당 기간 동안 반복 생성됩니다.</Text>
          {!hideRecurrenceToggle ? (
            <View style={[s.row, { flexWrap: 'wrap', gap: 8 }]}>
              <Pressable
                onPress={() => onRecurrenceEnabledChange?.(!recurrenceEnabled)}
                style={[
                  s.workspacePill,
                  { marginRight: 0, paddingVertical: 8, paddingHorizontal: 12 },
                  recurrenceEnabled ? s.workspacePillActive : null,
                ]}
              >
                <Text style={[s.workspacePillText, recurrenceEnabled ? s.workspacePillTextActive : null]}>
                  {recurrenceEnabled ? '반복 사용 중' : '반복 사용 안함'}
                </Text>
              </Pressable>
            </View>
          ) : null}
          {recurrenceEnabled ? (
            <>
              <View style={[s.row, { alignItems: 'stretch', gap: 8 }]}>
                {renderDateTimeField({
                  kind: 'date',
                  value: repeatStartParts.date,
                  placeholder: '반복 시작일',
                  onPress: () => setPickerTarget('repeatStartDate'),
                })}
                {renderDateTimeField({
                  kind: 'date',
                  value: repeatEndParts.date,
                  placeholder: '반복 종료일',
                  onPress: () => setPickerTarget('repeatEndDate'),
                })}
              </View>
              <View style={[s.row, { flexWrap: 'wrap', gap: 8 }]}>
                {(['일', '월', '화', '수', '목', '금', '토'] as const).map((label, index) => {
                  const active = recurrenceWeekdays.includes(index);
                  const next = active
                    ? recurrenceWeekdays.filter((day) => day !== index)
                    : [...recurrenceWeekdays, index].sort((a, b) => a - b);
                  return (
                    <Pressable
                      key={`${label}-${index}`}
                      onPress={() => onRecurrenceWeekdaysChange?.(next)}
                      style={[
                        s.workspacePill,
                        { marginRight: 0, paddingVertical: 7, paddingHorizontal: 10 },
                        active ? s.workspacePillActive : null,
                      ]}
                    >
                      <Text style={[s.workspacePillText, active ? s.workspacePillTextActive : null]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </GsxCard>
      ) : null}

      <View style={{ gap: 6 }}>
        <Text style={s.formTitle}>{scheduleMode === 'recurring' ? '반복 시작 시간' : '시작 시간'}</Text>
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            padding: 10,
            backgroundColor: colors.card,
            gap: 6,
          }}
        >
          <Text style={helperTextStyle}>
            {scheduleMode === 'recurring' ? '반복 일정 시작 시각' : '일정 시작 날짜와 시각'}
          </Text>
          <View style={[s.row, { alignItems: "stretch", gap: 8 }]}>
            {scheduleMode !== 'recurring'
              ? renderDateTimeField({
                  kind: "date",
                  value: startParts.date,
                  placeholder: "날짜 선택",
                  onPress: () => setPickerTarget("startDate"),
                })
              : null}
            {renderDateTimeField({
              kind: "time",
              value: startParts.time,
              placeholder: "09:00",
              onPress: () => setPickerTarget("startTime"),
            })}
          </View>
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={s.formTitle}>{scheduleMode === 'recurring' ? '반복 종료 시간' : '종료 시간'}</Text>
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            padding: 10,
            backgroundColor: colors.card,
            gap: 6,
          }}
        >
          <Text style={helperTextStyle}>시작 시간 이후로 선택</Text>
          <View style={[s.row, { alignItems: "stretch", gap: 8 }]}>
            {scheduleMode !== 'recurring'
              ? renderDateTimeField({
                  kind: "date",
                  value: endParts.date,
                  placeholder: "날짜 선택",
                  onPress: () => setPickerTarget("endDate"),
                })
              : null}
            {renderDateTimeField({
              kind: "time",
              value: endParts.time,
              placeholder: "09:30",
              onPress: () => setPickerTarget("endTime"),
            })}
          </View>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={s.formTitle}>태스크 컬러</Text>
        <View style={[s.row, { flexWrap: 'wrap', gap: 10 }]}>
          {(colorOptions && colorOptions.length > 0 ? colorOptions : TASK_COLOR_OPTIONS.map((item) => item.value)).map((item) => {
            const active = color.toUpperCase() === item.toUpperCase();
            return (
              <Pressable
                key={item}
                onPress={() => onColorChange(item)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  backgroundColor: item,
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
        {onSaveCustomColor ? (
          <View style={{ gap: 8 }}>
            <Text style={s.itemMeta}>색상표에서 선택 후 저장하면 내 색상으로 계속 사용할 수 있습니다.</Text>
            <ColorPicker value={customColorInput || color} onChangeJS={handlePickerChange}>
              <Panel1
                style={{
                  height: 188,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: `${colors.border}99`,
                  marginBottom: 8,
                }}
              />
              <HueSlider
                style={{
                  height: 20,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: `${colors.border}99`,
                }}
              />
            </ColorPicker>
            <View style={[s.row, { alignItems: 'center' }]}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: `${colors.border}99`,
                  backgroundColor: customColorInput || color,
                }}
              />
              <TextInput
                value={customColorInput}
                onChangeText={(value) => {
                  setCustomColorInput(value);
                  if (customColorError) setCustomColorError(null);
                }}
                placeholder="rgb(120,34,255) 또는 #7A22FF"
                style={[s.input, { flex: 1 }]}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={colors.textMuted}
              />
              <Pressable
                onPress={() => void saveCustomColor()}
                style={[s.secondaryButton, { width: 'auto', paddingHorizontal: 14, minHeight: 0, paddingVertical: 10 }]}
              >
                <Text style={s.secondaryButtonText}>{savingCustomColor ? '저장 중...' : '색상 저장'}</Text>
              </Pressable>
            </View>
            <Text style={s.itemMeta}>{pickerRgbText ? `${pickerRgbText} · ${customColorInput || color}` : customColorInput || color}</Text>
            {customColorError ? <Text style={errorTextStyle}>{customColorError}</Text> : null}
          </View>
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        <Text style={s.formTitle}>카테고리</Text>
        {showNewCategoryInput ? (
          <View style={[s.row, { alignItems: 'center' }]}>
            <TextInput
              value={newCategoryName}
              onChangeText={(value) => {
                setNewCategoryName(value);
                if (categoryError) setCategoryError(null);
              }}
              placeholder="새 카테고리 이름"
              style={[s.input, { flex: 1 }]}
              placeholderTextColor={colors.textMuted}
            />
            <Pressable
              onPress={() => void createCategory()}
              style={[s.secondaryButton, { width: 'auto', paddingHorizontal: 14, minHeight: 0, paddingVertical: 10 }]}
            >
              <Text style={s.secondaryButtonText}>{creatingCategory ? '추가 중...' : '저장'}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setShowNewCategoryInput(false);
                setNewCategoryName('');
                setCategoryError(null);
              }}
              style={[s.secondaryButton, { width: 'auto', paddingHorizontal: 14, minHeight: 0, paddingVertical: 10 }]}
            >
              <Text style={s.secondaryButtonText}>취소</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setShowNewCategoryInput(true)}
            style={[s.secondaryButton, { width: 'auto', alignSelf: 'flex-start', paddingHorizontal: 14, minHeight: 0, paddingVertical: 10 }]}
          >
            <Text style={s.secondaryButtonText}>카테고리 추가</Text>
          </Pressable>
        )}
        {categoryError ? <Text style={errorTextStyle}>{categoryError}</Text> : null}
        <View style={[s.row, { flexWrap: 'wrap', gap: 8 }]}>
          {availableCategories.length === 0 ? (
            <Text style={s.subtleText}>선택 가능한 카테고리가 없습니다.</Text>
          ) : (
            availableCategories.map((category) => {
              const active = Number(selectedCategoryId) === Number(category.category_id);
              return (
                <Pressable
                  key={category.category_id}
                  onPress={() => onCategoryChange?.(active ? null : category.category_id)}
                  style={[
                    s.workspacePill,
                    {
                      marginRight: 0,
                      paddingVertical: 7,
                      paddingHorizontal: 10,
                      borderColor: active ? category.color ?? colors.primary : colors.border,
                      backgroundColor: active ? `${category.color ?? colors.primary}18` : colors.cardSoft,
                    },
                  ]}
                >
                  <Text style={[s.workspacePillText, { color: active ? colors.text : colors.textMuted }]}>
                    {category.name}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
        {selectedCategoryId ? (
          <View style={{ gap: 8 }}>
            <View style={[s.row, { alignItems: 'center' }]}>
              <TextInput
                value={editCategoryName}
                onChangeText={(value) => {
                  setEditCategoryName(value);
                  if (categoryError) setCategoryError(null);
                }}
                placeholder="카테고리 이름 수정"
                style={[s.input, { flex: 1 }]}
                placeholderTextColor={colors.textMuted}
              />
              <Pressable
                onPress={() => void updateCategory()}
                style={[s.secondaryButton, { width: 'auto', paddingHorizontal: 14, minHeight: 0, paddingVertical: 10 }]}
              >
                <Text style={s.secondaryButtonText}>{editingCategory ? '수정 중...' : '수정'}</Text>
              </Pressable>
              <Pressable
                onPress={() => void deleteCategory()}
                style={[
                  s.secondaryButton,
                  {
                    width: 'auto',
                    paddingHorizontal: 14,
                    minHeight: 0,
                    paddingVertical: 10,
                    borderColor: '#FCA5A5',
                    backgroundColor: '#FFF5F5',
                  },
                ]}
              >
                <Text style={[s.secondaryButtonText, { color: '#DC2626' }]}>
                  {deletingCategory ? '삭제 중...' : '삭제'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
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
        {tagError ? <Text style={errorTextStyle}>{tagError}</Text> : null}
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

      <View style={[s.panel, { borderRadius: 16, gap: 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ gap: 4, flex: 1 }}>
            <Text style={s.formTitle}>첨부파일</Text>
            <Text style={s.itemMeta}>
              {attachmentMode === 'pending'
                ? '일정을 저장한 뒤 선택한 파일이 함께 업로드됩니다.'
                : '현재 일정에 첨부할 파일을 추가하거나 제거할 수 있습니다.'}
            </Text>
          </View>
          {onPickAttachment ? (
            <Pressable
              onPress={onPickAttachment}
              style={[
                s.secondaryButton,
                { width: 'auto', minHeight: 0, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start' },
              ]}
            >
              <Text style={s.secondaryButtonText}>파일 추가</Text>
            </Pressable>
          ) : null}
        </View>

        {attachments.length === 0 ? (
          <Text style={s.subtleText}>
            {attachmentMode === 'pending' ? '선택된 첨부파일이 없습니다.' : '첨부된 파일이 없습니다.'}
          </Text>
        ) : (
          <View style={{ gap: 8 }}>
            {attachments.map((attachment) => {
              const isUploading = uploadingAttachmentIds.includes(String(attachment.attachment_id));
              return (
                <View
                  key={`${attachment.attachment_id}:${attachment.file_id}:${attachment.original_name}`}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor: colors.cardSoft,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                        {attachment.original_name}
                      </Text>
                      {(attachment.preview_uri || attachment.file_path) &&
                      ((attachment.mime_type && attachment.mime_type.startsWith('image/')) ||
                        (attachment.file_path && /\.(png|jpe?g|gif|webp|svg)$/i.test(attachment.file_path)) ||
                        (attachment.preview_uri && /\.(png|jpe?g|gif|webp|svg)$/i.test(attachment.preview_uri))) ? (
                        <Image
                          source={{ uri: attachment.preview_uri || attachment.file_path }}
                          resizeMode="cover"
                          style={{
                            width: '100%',
                            height: 120,
                            borderRadius: 10,
                            marginTop: 4,
                            backgroundColor: colors.border,
                          }}
                        />
                      ) : null}
                      <Text style={s.itemMeta}>
                        {attachment.file_size_formatted || formatBytes(attachment.file_size) || '파일 크기 확인 불가'}
                        {isUploading ? ' · 업로드 중...' : ''}
                      </Text>
                    </View>
                    {onRemoveAttachment ? (
                      <Pressable
                        disabled={isUploading}
                        onPress={() => onRemoveAttachment(attachment.attachment_id)}
                        style={{
                          borderWidth: 1,
                          borderColor: '#FCA5A5',
                          borderRadius: 10,
                          paddingHorizontal: 10,
                          paddingVertical: 7,
                          backgroundColor: '#FFF5F5',
                          opacity: isUploading ? 0.5 : 1,
                        }}
                      >
                        <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '700' }}>제거</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <SharedRichTextEditor
        valueJson={contentJson}
        valueText=""
        placeholder="태스크 상세 내용을 입력하세요."
        minHeight={220}
        implementation="webview"
        onChange={(json) => onContentChange(json)}
      />

      <View style={[s.panel, { borderRadius: 16, gap: 10 }]}>
        <Text style={s.formTitle}>진행 상태</Text>
        <Text style={s.itemMeta}>일정이 현재 어느 단계인지 선택합니다.</Text>
        <View style={[s.row, { flexWrap: 'wrap', gap: 8 }]}>
          {(['TODO', 'DONE'] as const).map((item) => (
            <Pressable
              key={item}
              onPress={() => onStatusChange(item)}
              style={[
                s.workspacePill,
                { marginRight: 0, paddingVertical: 8, paddingHorizontal: 12 },
                normalizedStatus === item ? s.workspacePillActive : null,
              ]}
            >
              <Text style={[s.workspacePillText, normalizedStatus === item ? s.workspacePillTextActive : null]}>
                {statusLabels[item]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[s.panel, { borderRadius: 16, gap: 10 }]}>
        <Text style={s.formTitle}>일정 옵션</Text>
        <Text style={s.itemMeta}>종일 일정 여부를 설정합니다.</Text>
        <View style={[s.row, { flexWrap: 'wrap', gap: 8 }]}>
          <Pressable
            onPress={() => onAllDayChange(!allDay)}
            style={[
              s.workspacePill,
              { marginRight: 0, paddingVertical: 8, paddingHorizontal: 12 },
              allDay ? s.workspacePillActive : null,
            ]}
          >
            <Text style={[s.workspacePillText, allDay ? s.workspacePillTextActive : null]}>종일 일정</Text>
          </Pressable>
        </View>
      </View>

      <View style={[s.panel, { borderRadius: 16, gap: 10 }]}>
        <Text style={s.formTitle}>알림</Text>
        <Text style={s.itemMeta}>시작 시간을 기준으로 받을 알림 시점을 선택합니다.</Text>
        <View style={[s.row, { flexWrap: 'wrap', gap: 8 }]}>
          {reminderOptions.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => onReminderMinutesChange(item.key)}
              style={[
                s.workspacePill,
                { marginRight: 0, paddingVertical: 8, paddingHorizontal: 12 },
                reminderMinutes === item.key ? s.workspacePillActive : null,
              ]}
            >
              <Text style={[s.workspacePillText, reminderMinutes === item.key ? s.workspacePillTextActive : null]}>
                {item.key === '0' ? item.label : `시작 ${item.label}`}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <GsxButton
            label={saving ? '저장 중...' : submitLabel}
            variant="primary"
            loading={saving}
            disabled={saving}
            className="w-full py-3"
            onPress={onSubmit}
          />
        </View>
        {onDelete ? (
          <View style={{ flex: 1 }}>
            <GsxButton
              label="삭제"
              variant="danger"
              disabled={saving}
              className="w-full py-3"
              onPress={onDelete}
            />
          </View>
        ) : null}
      </View>

      <Modal
        visible={pickerTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerTarget(null)}
      >
        <Pressable
          onPress={() => setPickerTarget(null)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.24)',
            justifyContent:
              pickerTarget === 'startDate' ||
              pickerTarget === 'endDate' ||
              pickerTarget === 'repeatStartDate' ||
              pickerTarget === 'repeatEndDate'
                ? 'flex-start'
                : 'center',
            paddingHorizontal: 20,
            paddingTop:
              pickerTarget === 'startDate' ||
              pickerTarget === 'endDate' ||
              pickerTarget === 'repeatStartDate' ||
              pickerTarget === 'repeatEndDate'
                ? 72
                : 20,
            paddingBottom: 20,
          }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              borderRadius: 18,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
              maxHeight:
                pickerTarget === 'startDate' ||
                pickerTarget === 'endDate' ||
                pickerTarget === 'repeatStartDate' ||
                pickerTarget === 'repeatEndDate'
                  ? '82%'
                  : undefined,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
                {pickerTarget === 'startDate'
                  ? '시작 날짜 선택'
                  : pickerTarget === 'endDate'
                    ? '종료 날짜 선택'
                    : pickerTarget === 'repeatStartDate'
                      ? '반복 시작일 선택'
                      : pickerTarget === 'repeatEndDate'
                        ? '반복 종료일 선택'
                    : pickerTarget === 'startTime'
                      ? '시작 시간 선택'
                      : '종료 시간 선택'}
              </Text>
              <Pressable onPress={() => setPickerTarget(null)}>
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>닫기</Text>
              </Pressable>
            </View>
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 14,
                paddingBottom: 6,
                gap: 4,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.6 }}>
                {pickerTarget === 'startDate'
                  ? startParts.date || '날짜 선택'
                  : pickerTarget === 'endDate'
                    ? endParts.date || '날짜 선택'
                    : pickerTarget === 'repeatStartDate'
                      ? repeatStartParts.date || '날짜 선택'
                      : pickerTarget === 'repeatEndDate'
                        ? repeatEndParts.date || '날짜 선택'
                    : pickerTarget === 'startTime'
                      ? startParts.time || '09:00'
                      : endParts.time || '09:30'}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>
                {pickerTarget === 'startDate' ||
                pickerTarget === 'endDate' ||
                pickerTarget === 'repeatStartDate' ||
                pickerTarget === 'repeatEndDate'
                  ? '직접 입력 없이 날짜를 선택합니다'
                  : '1분 단위로 선택할 수 있습니다'}
              </Text>
            </View>
            <DateTimePicker
              value={activePickerDate}
              mode={
                pickerTarget === 'startDate' ||
                pickerTarget === 'endDate' ||
                pickerTarget === 'repeatStartDate' ||
                pickerTarget === 'repeatEndDate'
                  ? 'date'
                  : 'time'
              }
              display={
                Platform.OS === 'ios'
                  ? pickerTarget === 'startDate' ||
                    pickerTarget === 'endDate' ||
                    pickerTarget === 'repeatStartDate' ||
                    pickerTarget === 'repeatEndDate'
                    ? 'inline'
                    : 'spinner'
                  : 'default'
              }
              minuteInterval={
                pickerTarget === 'startDate' ||
                pickerTarget === 'endDate' ||
                pickerTarget === 'repeatStartDate' ||
                pickerTarget === 'repeatEndDate'
                  ? undefined
                  : 1
              }
              onChange={handleTimePickerChange}
              style={{
                alignSelf: 'stretch',
                backgroundColor: colors.card,
                minHeight:
                  pickerTarget === 'startDate' ||
                  pickerTarget === 'endDate' ||
                  pickerTarget === 'repeatStartDate' ||
                  pickerTarget === 'repeatEndDate'
                    ? 380
                    : 216,
              }}
              textColor={colors.text}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </GsxCard>
  );
}
