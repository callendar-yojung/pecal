import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaybeMobileApp } from '../../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../../src/contexts/ThemeContext';
import { defaultTaskRangeByDate } from '../../../src/lib/date';
import {
  ensureAttachmentAllowed,
  formatUploadLimitMessage,
  pickAttachments,
  pickImageAttachments,
  uploadTaskAttachment,
  type PickedAttachment,
} from '../../../src/lib/file-upload';
import { isUploadLimitError } from '../../../src/lib/plan-limits';
import type { CategoryItem, TaskAttachmentItem, TaskStatus } from '../../../src/lib/types';
import { createStyles } from '../../../src/styles/createStyles';
import { TaskEditorForm } from '../../../src/components/task/TaskEditorForm';
import { apiFetch, invalidateApiCache } from '../../../src/lib/api';
import {
  loadTaskColorOptionsForMember,
  saveTaskColorPresetForMember,
} from '../../../src/lib/task-color-presets';

function normalizeTaskStatus(status?: TaskStatus): 'TODO' | 'DONE' {
  return status === 'DONE' ? 'DONE' : 'TODO';
}

export default function TaskCreatePage() {
  const params = useLocalSearchParams<{ date?: string }>();
  const app = useMaybeMobileApp();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const initialDate =
    typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? new Date(`${params.date}T09:00:00`)
      : new Date();
  const [title, setTitle] = useState('');
  const [contentJson, setContentJson] = useState('');
  const [range, setRange] = useState(defaultTaskRangeByDate(initialDate));
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [color, setColor] = useState('#3B82F6');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [allDay, setAllDay] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState('');
  const [scheduleMode, setScheduleMode] = useState<'single' | 'recurring'>('single');
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrenceStartDate, setRecurrenceStartDate] = useState(range.start.slice(0, 10));
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(range.end.slice(0, 10));
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([initialDate.getDay()]);
  const [saving, setSaving] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  const [colorOptions, setColorOptions] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<PickedAttachment[]>([]);
  const [uploadingLocalIds, setUploadingLocalIds] = useState<string[]>([]);

  if (!app) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>앱 초기화 중...</Text>
      </View>
    );
  }

  const { auth, data } = app;
  const session = auth.session;
  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setColorOptions([]);
      return;
    }
    void (async () => {
      const options = await loadTaskColorOptionsForMember(session);
      if (!cancelled) setColorOptions(options);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    if (!session || !data.selectedWorkspace) {
      setCategories([]);
      return;
    }
    void (async () => {
      const ownerType = data.selectedWorkspace?.type;
      const ownerId = data.selectedWorkspace?.owner_id;
      if (!ownerType || !ownerId) return;
      const response = await apiFetch<{ categories?: CategoryItem[] }>(
        `/api/categories?owner_type=${ownerType}&owner_id=${ownerId}`,
        session,
      );
      if (!cancelled) setCategories(Array.isArray(response.categories) ? response.categories : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, data.selectedWorkspace]);

  useEffect(() => {
    setRange(defaultTaskRangeByDate(initialDate));
    setRecurrenceStartDate(defaultTaskRangeByDate(initialDate).start.slice(0, 10));
    setRecurrenceEndDate(defaultTaskRangeByDate(initialDate).end.slice(0, 10));
    setRecurrenceWeekdays([initialDate.getDay()]);
    setScheduleMode('single');
    setRecurrenceEnabled(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.date]);

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!data.selectedWorkspace) {
    return (
      <View style={s.centerScreen}>
        <Text style={s.emptyText}>워크스페이스를 선택하세요.</Text>
      </View>
    );
  }
  const workspace = data.selectedWorkspace;
  const bottomBarHeight = 96;

  const submit = async () => {
    if (saving) return;
    const isRecurring = scheduleMode === 'recurring';
    if (isRecurring) {
      if (!recurrenceStartDate || !recurrenceEndDate) {
        Alert.alert('입력 확인', '반복 시작일과 종료일을 선택하세요.');
        return;
      }
      if (recurrenceStartDate > recurrenceEndDate) {
        Alert.alert('입력 확인', '반복 종료일은 반복 시작일보다 빠를 수 없습니다.');
        return;
      }
      if (recurrenceWeekdays.length === 0) {
        Alert.alert('입력 확인', '반복 요일을 1개 이상 선택하세요.');
        return;
      }
    }

    const startTimePart = (range.start.split('T')[1] ?? '09:00:00').slice(0, 8);
    const endTimePart = (range.end.split('T')[1] ?? '09:30:00').slice(0, 8);
    const payloadStart = isRecurring
      ? `${recurrenceStartDate}T${startTimePart || '09:00:00'}`
      : range.start;
    const payloadEnd = isRecurring
      ? `${recurrenceStartDate}T${endTimePart || '09:30:00'}`
      : range.end;
    const parsedReminderValue =
      reminderMinutes === '' ? null : Number(reminderMinutes);
    const reminderValue = Number.isFinite(parsedReminderValue)
      ? Math.trunc(parsedReminderValue as number)
      : null;
    setSaving(true);
    try {
      const created = await data.createTaskWithInput({
        title,
        start_time: payloadStart,
        end_time: payloadEnd,
        content: contentJson || null,
        status: normalizeTaskStatus(status),
        color,
        category_id: selectedCategoryId,
        tag_ids: selectedTagIds,
        is_all_day: allDay,
        reminder_minutes: reminderValue,
        recurrence: isRecurring
          ? {
              enabled: true,
              start_date: recurrenceStartDate,
              end_date: recurrenceEndDate,
              weekdays: recurrenceWeekdays,
            }
          : null,
      });
      if (!created.success) {
        Alert.alert('입력 확인', created.errorMessage ?? '입력한 내용을 다시 확인해 주세요.');
        return;
      }
      if (created.taskId && pendingAttachments.length > 0) {
        setUploadingLocalIds(pendingAttachments.map((item) => item.localId));
        for (const attachment of pendingAttachments) {
          await uploadTaskAttachment({
            session,
            workspace,
            taskId: created.taskId,
            attachment,
          });
        }
      } else if (!created.taskId && pendingAttachments.length > 0) {
        Alert.alert('첨부파일 보류', '오프라인으로 일정이 임시 저장되어 첨부파일은 아직 업로드되지 않았습니다.');
      }
      router.replace('/tasks');
    } catch (error) {
      if (isUploadLimitError(error)) {
        const details = (error as { details?: Record<string, unknown> }).details ?? {};
        Alert.alert(
          '업로드 제한',
          formatUploadLimitMessage({
            reason: typeof details.error === 'string' ? details.error : '파일 업로드 제한에 걸렸습니다.',
            maxFileSizeBytes: Number(details.max_file_size_bytes ?? 0),
            usedBytes: Number(details.used_bytes ?? 0),
            limitBytes: Number(details.limit_bytes ?? 0),
            planName: '현재 플랜',
          }),
        );
      } else {
        Alert.alert('오류', error instanceof Error ? error.message : '일정을 저장하지 못했습니다.');
      }
    } finally {
      setUploadingLocalIds([]);
      setSaving(false);
    }
  };

  const ensureRange = (nextStart: string, nextEnd: string) => {
    const start = new Date(nextStart);
    const end = new Date(nextEnd);
    if (Number.isNaN(start.getTime())) return { start: nextStart, end: nextEnd };
    if (Number.isNaN(end.getTime()) || end <= start) {
      const adjusted = new Date(start);
      adjusted.setMinutes(adjusted.getMinutes() + 30);
      return {
        start: nextStart,
        end: `${adjusted.getFullYear()}-${String(adjusted.getMonth() + 1).padStart(2, '0')}-${String(adjusted.getDate()).padStart(2, '0')}T${String(adjusted.getHours()).padStart(2, '0')}:${String(adjusted.getMinutes()).padStart(2, '0')}:${String(adjusted.getSeconds()).padStart(2, '0')}`,
      };
    }
    return { start: nextStart, end: nextEnd };
  };

  const createTag = async (name: string, tagColor: string) => {
    setCreatingTag(true);
    try {
      const result = await apiFetch<{ tag_id: number }>('/api/tags', session, {
        method: 'POST',
        body: JSON.stringify({
          name,
          color: tagColor,
          owner_type: workspace.type,
          owner_id: workspace.owner_id,
        }),
      });
      setSelectedTagIds((prev) => (prev.includes(result.tag_id) ? prev : [...prev, result.tag_id]));
      invalidateApiCache(`tags:${workspace.type}:${workspace.owner_id}`);
      await data.loadDashboard(workspace);
    } finally {
      setCreatingTag(false);
    }
  };

  const attachmentItems = pendingAttachments.map((item) => ({
    attachment_id: item.localId,
    file_id: item.localId,
    original_name: item.name,
    file_size: item.size,
    file_size_formatted: undefined,
    preview_uri: item.uri,
    mime_type: item.mimeType,
  }));

  const pickNewAttachments = async () => {
    const handlePicked = async (picked: PickedAttachment[]) => {
      if (!picked.length) return;
      const accepted: typeof picked = [];
      for (const asset of picked) {
        const limit = await ensureAttachmentAllowed(session, workspace, asset.size);
        if (!limit.allowed) {
          Alert.alert(
            '업로드 제한',
            formatUploadLimitMessage({
              reason: limit.reason,
              maxFileSizeBytes: limit.maxFileSizeBytes,
              usedBytes: limit.usedBytes,
              limitBytes: limit.limitBytes,
              planName: limit.planName,
            }),
          );
          continue;
        }
        accepted.push(asset);
      }
      if (!accepted.length) return;
      setPendingAttachments((prev) => {
        const seen = new Set(prev.map((item) => item.localId));
        return [...prev, ...accepted.filter((item) => !seen.has(item.localId))];
      });
    };

    const openPicker = (mode: 'image' | 'file') => {
      void (async () => {
        try {
          const picked = mode === 'image' ? await pickImageAttachments() : await pickAttachments();
          await handlePicked(picked);
        } catch (error) {
          Alert.alert('오류', error instanceof Error ? error.message : '파일을 선택하지 못했습니다.');
        }
      })();
    };

    Alert.alert('첨부 추가', '추가할 항목을 선택하세요.', [
      { text: '취소', style: 'cancel' },
      { text: '이미지', onPress: () => openPicker('image') },
      { text: '파일', onPress: () => openPicker('file') },
    ]);
  };

  const removePendingAttachment = (attachmentId: number | string) =>
    setPendingAttachments((prev) => prev.filter((item) => item.localId !== String(attachmentId)));

  const saveCustomColor = async (value: string) => {
    if (!session) return null;
    const { saved, options } = await saveTaskColorPresetForMember(session, value);
    setColorOptions(options);
    return saved;
  };

  const createCategory = async (name: string, categoryColor: string) => {
    const result = await apiFetch<{ category_id: number }>('/api/categories', session, {
      method: 'POST',
      body: JSON.stringify({
        name,
        color: categoryColor,
        owner_type: workspace.type,
        owner_id: workspace.owner_id,
      }),
    });
    setSelectedCategoryId(result.category_id);
    setCategories((prev) => {
      if (prev.some((item) => item.category_id === result.category_id)) return prev;
      return [...prev, { category_id: result.category_id, name, color: categoryColor }];
    });
  };

  const updateCategory = async (categoryId: number, name: string, categoryColor: string) => {
    await apiFetch(`/api/categories/${categoryId}`, session, {
      method: 'PATCH',
      body: JSON.stringify({ name, color: categoryColor }),
    });
    setCategories((prev) =>
      prev.map((item) =>
        item.category_id === categoryId ? { ...item, name, color: categoryColor } : item
      )
    );
  };

  const deleteCategory = async (categoryId: number) => {
    await apiFetch(`/api/categories/${categoryId}`, session, { method: 'DELETE' });
    setCategories((prev) => prev.filter((item) => item.category_id !== categoryId));
    setSelectedCategoryId((prev) => (prev === categoryId ? null : prev));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={s.content}
        contentContainerStyle={[
          s.contentContainer,
          {
            paddingTop: 8,
            paddingBottom: bottomBarHeight + insets.bottom + 16,
          },
        ]}
      >
        <View
          style={[
            s.panel,
            {
              borderRadius: 16,
              gap: 12,
              marginBottom: 10,
              padding: 16,
              shadowColor: '#000',
              shadowOpacity: 0.04,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            },
          ]}
        >
          <Text style={[s.formTitle, { fontSize: 16, fontWeight: '800' }]}>등록 유형 선택</Text>
          <Text style={s.itemMeta}>일반 일정 또는 반복 일정을 먼저 선택하세요.</Text>
          <View style={[s.row, { gap: 8 }]}>
            <View style={{ flex: 1 }}>
              <Pressable
                onPress={() => {
                  setScheduleMode('single');
                  setRecurrenceEnabled(false);
                }}
                style={[
                  {
                    borderWidth: 1,
                    borderColor: scheduleMode === 'single' ? colors.primary : colors.border,
                    backgroundColor: scheduleMode === 'single' ? `${colors.primary}14` : colors.card,
                    borderRadius: 16,
                    paddingVertical: 12,
                    alignItems: 'center',
                    gap: 4,
                  },
                ]
                }
              >
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={scheduleMode === 'single' ? colors.primary : colors.textMuted}
                />
                <Text
                  style={[
                    s.secondaryButtonText,
                    {
                      color: scheduleMode === 'single' ? colors.primary : colors.textMuted,
                      fontWeight: '700',
                    },
                  ]}
                >
                  일반 일정
                </Text>
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <Pressable
                onPress={() => {
                  setScheduleMode('recurring');
                  setRecurrenceEnabled(true);
                  if (!recurrenceWeekdays.length) setRecurrenceWeekdays([new Date(range.start).getDay()]);
                }}
                style={[
                  {
                    borderWidth: 1,
                    borderColor: scheduleMode === 'recurring' ? colors.primary : colors.border,
                    backgroundColor: scheduleMode === 'recurring' ? `${colors.primary}14` : colors.card,
                    borderRadius: 16,
                    paddingVertical: 12,
                    alignItems: 'center',
                    gap: 4,
                  },
                ]
                }
              >
                <Ionicons
                  name="repeat"
                  size={18}
                  color={scheduleMode === 'recurring' ? colors.primary : colors.textMuted}
                />
                <Text
                  style={[
                    s.secondaryButtonText,
                    {
                      color: scheduleMode === 'recurring' ? colors.primary : colors.textMuted,
                      fontWeight: '700',
                    },
                  ]}
                >
                  반복 일정
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <TaskEditorForm
          scheduleMode={scheduleMode}
          title={title}
          startTime={range.start}
          endTime={range.end}
          status={status}
          color={color}
          selectedCategoryId={selectedCategoryId}
          availableCategories={categories}
          colorOptions={colorOptions}
          selectedTagIds={selectedTagIds}
          availableTags={data.tags}
          allDay={allDay}
          reminderMinutes={reminderMinutes}
          showRecurrenceControls={scheduleMode === 'recurring'}
          hideRecurrenceToggle={scheduleMode === 'recurring'}
          recurrenceEnabled={scheduleMode === 'recurring' ? true : recurrenceEnabled}
          recurrenceStartDate={recurrenceStartDate}
          recurrenceEndDate={recurrenceEndDate}
          recurrenceWeekdays={recurrenceWeekdays}
          rrule=""
          contentJson={contentJson}
          saving={saving}
          creatingTag={creatingTag}
          submitLabel="일정 만들기"
          hideSubmitButton
          onTitleChange={setTitle}
          onStartTimeChange={(value) => setRange((prev) => ensureRange(value, prev.end))}
          onEndTimeChange={(value) => setRange((prev) => ensureRange(prev.start, value))}
          onStatusChange={setStatus}
          onColorChange={setColor}
          onSaveCustomColor={saveCustomColor}
          onCategoryChange={setSelectedCategoryId}
          onCreateCategory={createCategory}
          onUpdateCategory={updateCategory}
          onDeleteCategory={deleteCategory}
          onSelectedTagIdsChange={setSelectedTagIds}
          onCreateTag={createTag}
          attachments={attachmentItems}
          uploadingAttachmentIds={uploadingLocalIds}
          attachmentMode="pending"
          onPickAttachment={() => void pickNewAttachments()}
          onRemoveAttachment={removePendingAttachment}
          onAllDayChange={setAllDay}
          onReminderMinutesChange={setReminderMinutes}
          onRecurrenceEnabledChange={setRecurrenceEnabled}
          onRecurrenceStartDateChange={setRecurrenceStartDate}
          onRecurrenceEndDateChange={setRecurrenceEndDate}
          onRecurrenceWeekdaysChange={setRecurrenceWeekdays}
          onRruleChange={() => undefined}
          onContentChange={setContentJson}
          onSubmit={() => void submit()}
        />
      </ScrollView>

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: Math.max(insets.bottom, 10),
        }}
      >
        <Pressable
          disabled={saving}
          onPress={() => void submit()}
          style={({ pressed }) => [
            {
              minHeight: 56,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.primary,
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
              opacity: saving ? 0.65 : pressed ? 0.92 : 1,
              transform: [{ scale: pressed && !saving ? 0.99 : 1 }],
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="add" size={22} color={colors.primary} />
            <Text
              style={{
                color: colors.primary,
                fontSize: 20,
                fontWeight: '800',
                letterSpacing: -0.4,
              }}
            >
              {saving ? '저장 중...' : '일정 만들기'}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
