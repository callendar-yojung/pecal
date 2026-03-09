import { isRichTextDocLike } from '@repo/utils';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { useI18n } from '../../contexts/I18nContext';
import { useThemeMode } from '../../contexts/ThemeContext';
import { getApiBaseUrl } from '../../lib/api';
import {
  deleteTaskAttachment,
  downloadAndShareAttachment,
  ensureAttachmentAllowed,
  formatUploadLimitMessage,
  pickAttachments,
  pickImageAttachments,
  uploadTaskAttachment,
} from '../../lib/file-upload';
import type { AuthSession, TaskAttachmentItem, TaskItem, Workspace } from '../../lib/types';
import { createStyles } from '../../styles/createStyles';
import { DetailAttachmentSection, DetailTagSection } from '../detail/DetailSections';
import { SharedRichTextEditor } from '../editor/SharedRichTextEditor';

type Props = {
  task: TaskItem;
  session?: AuthSession | null;
  workspace?: Workspace | null;
  availableTags?: Array<{ tag_id: number; name: string; color?: string }>;
  minHeight?: number;
  onBackToList?: () => void;
  onOpenEdit?: () => void;
  onOpenExport?: () => void;
  onAttachmentsLoadingChange?: (loading: boolean) => void;
};

function statusLabel(status: string | undefined, isKo: boolean) {
  if (status === 'IN_PROGRESS') return isKo ? '진행중' : 'In Progress';
  if (status === 'DONE') return isKo ? '완료' : 'Done';
  return isKo ? '할 일' : 'To Do';
}

function resolveFileUrl(filePath?: string) {
  if (!filePath) return null;
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  if (filePath.startsWith('/uploads/')) return `${getApiBaseUrl().replace(/\/+$/, '')}${filePath}`;
  return `${getApiBaseUrl().replace(/\/+$/, '')}/${filePath.replace(/^\/+/, '')}`;
}

function isImageAttachment(item: TaskAttachmentItem) {
  if (item.mime_type?.startsWith('image/')) return true;
  const path = item.file_path ?? '';
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(path);
}

export function TaskDetailWebView({
  task,
  session,
  workspace,
  availableTags = [],
  minHeight = 460,
  onBackToList,
  onOpenEdit,
  onOpenExport,
  onAttachmentsLoadingChange,
}: Props) {
  const router = useRouter();
  const { resolvedMode, colors } = useThemeMode();
  const { locale } = useI18n();
  const isKo = locale === 'ko';
  const [attachments, setAttachments] = useState<TaskAttachmentItem[]>([]);
  const [removingAttachmentIds, setRemovingAttachmentIds] = useState<number[]>([]);
  const [uploadingAttachmentIds, setUploadingAttachmentIds] = useState<string[]>([]);
  const s = createStyles(colors);

  const borderColor = resolvedMode === 'black' ? '#2D3443' : '#D9E0EF';
  const cardColor = resolvedMode === 'black' ? '#141923' : '#FFFFFF';
  const softColor = resolvedMode === 'black' ? '#A3AEC2' : '#667085';
  const textColor = resolvedMode === 'black' ? '#F3F6FF' : '#111827';
  const contentColor = resolvedMode === 'black' ? '#D0D7E7' : '#334155';

  const selectedTags = useMemo(() => {
    if (Array.isArray(task.tags) && task.tags.length > 0) {
      return task.tags.map((tag) => ({
        tag_id: Number(tag.tag_id),
        name: String(tag.name ?? ''),
        color: tag.color,
      }));
    }

    return (task.tag_ids ?? [])
      .map((tagId) => availableTags.find((tag) => Number(tag.tag_id) === Number(tagId)))
      .filter((tag): tag is { tag_id: number; name: string; color?: string } => Boolean(tag));
  }, [task.tags, task.tag_ids, availableTags]);
  const hasContentJson = isRichTextDocLike(task.content);
  const hasContent = Boolean(task.content?.trim());

  useEffect(() => {
    if (!session?.accessToken || !task.id) {
      setAttachments([]);
      onAttachmentsLoadingChange?.(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      onAttachmentsLoadingChange?.(true);
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/tasks/attachments?task_id=${task.id}`, {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        });
        if (!response.ok) {
          if (!cancelled) setAttachments([]);
          return;
        }
        const data = (await response.json()) as { attachments?: TaskAttachmentItem[] };
        if (!cancelled) setAttachments(Array.isArray(data.attachments) ? data.attachments : []);
      } catch {
        if (!cancelled) setAttachments([]);
      } finally {
        if (!cancelled) onAttachmentsLoadingChange?.(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, task.id, onAttachmentsLoadingChange]);

  const addAttachments = async () => {
    if (!session || !workspace) return;
    const handlePicked = async (picked: Awaited<ReturnType<typeof pickAttachments>>) => {
      if (!picked.length) return;
      for (const asset of picked) {
        const limit = await ensureAttachmentAllowed(session, workspace, asset.size);
        if (!limit.allowed) {
          Alert.alert(
            isKo ? '업로드 제한' : 'Upload limit',
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
        setUploadingAttachmentIds((prev) => [...prev, asset.localId]);
        try {
          const uploaded = await uploadTaskAttachment({
            session,
            workspace,
            taskId: task.id,
            attachment: asset,
          });
          setAttachments((prev) => [uploaded, ...prev.filter((item) => item.file_id !== uploaded.file_id)]);
        } finally {
          setUploadingAttachmentIds((prev) => prev.filter((id) => id !== asset.localId));
        }
      }
    };

    const openPicker = (mode: 'image' | 'file') => {
      void (async () => {
        try {
          const picked = mode === 'image' ? await pickImageAttachments() : await pickAttachments();
          await handlePicked(picked);
        } catch (error) {
          Alert.alert(
            isKo ? '오류' : 'Error',
            error instanceof Error ? error.message : isKo ? '파일을 업로드하지 못했습니다.' : 'Unable to upload files.',
          );
        }
      })();
    };

    Alert.alert(isKo ? '첨부 추가' : 'Add attachment', isKo ? '추가할 항목을 선택하세요.' : 'Choose what to add.', [
      { text: isKo ? '취소' : 'Cancel', style: 'cancel' },
      { text: isKo ? '이미지' : 'Image', onPress: () => openPicker('image') },
      { text: isKo ? '파일' : 'File', onPress: () => openPicker('file') },
    ]);
  };

  const removeAttachment = async (attachmentId: number) => {
    if (!session) return;
    setRemovingAttachmentIds((prev) => [...prev, attachmentId]);
    try {
      await deleteTaskAttachment({ session, attachmentId });
      setAttachments((prev) => prev.filter((item) => Number(item.attachment_id) !== attachmentId));
    } catch (error) {
      Alert.alert(isKo ? '오류' : 'Error', error instanceof Error ? error.message : isKo ? '첨부파일을 삭제하지 못했습니다.' : 'Unable to remove attachment.');
    } finally {
      setRemovingAttachmentIds((prev) => prev.filter((id) => id !== attachmentId));
    }
  };

  const attachmentItems = useMemo(
    () =>
      attachments.map((item) => ({
        id: item.attachment_id,
        name: item.original_name,
        sizeLabel: item.file_size_formatted,
        isImage: isImageAttachment(item),
        previewUrl: resolveFileUrl(item.file_path),
        onOpen: async () => {
          if (!item.file_id) {
            Alert.alert(isKo ? '오류' : 'Error', isKo ? '파일 경로를 찾을 수 없습니다.' : 'File path is missing.');
            return;
          }
          router.push(`/files/${item.file_id}`);
        },
        onDownload: async () => {
          const url = resolveFileUrl(item.file_path);
          if (!url) {
            Alert.alert(isKo ? '오류' : 'Error', isKo ? '파일 경로를 찾을 수 없습니다.' : 'File path is missing.');
            return;
          }
          try {
            await downloadAndShareAttachment({
              url,
              fileName: item.original_name,
              mimeType: item.mime_type,
              session,
            });
          } catch (error) {
            Alert.alert(
              isKo ? '오류' : 'Error',
              error instanceof Error ? error.message : isKo ? '파일을 다운로드하지 못했습니다.' : 'Unable to download file.',
            );
          }
        },
        onRemove: session ? async () => removeAttachment(Number(item.attachment_id)) : undefined,
        removing: removingAttachmentIds.includes(Number(item.attachment_id)),
      })),
    [attachments, isKo, session, removingAttachmentIds],
  );

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor,
        borderRadius: 18,
        padding: 14,
        backgroundColor: cardColor,
        gap: 12,
      }}
    >
      <View style={{ gap: 6 }}>
        <Text style={{ color: textColor, fontSize: 24, fontWeight: '800', letterSpacing: -0.6 }}>
          {task.title}
        </Text>
        <Text style={{ color: softColor, fontSize: 14 }}>
          {task.start_time} - {task.end_time}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <View
          style={{
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 6,
            backgroundColor: `${task.color ?? '#3B82F6'}22`,
          }}
        >
          <Text style={{ color: task.color ?? '#3B82F6', fontSize: 12, fontWeight: '700' }}>
            {statusLabel(task.status, isKo)}
          </Text>
        </View>
        {task.is_all_day ? (
          <View
            style={{
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 6,
              backgroundColor: resolvedMode === 'black' ? '#202637' : '#EEF2FF',
            }}
          >
            <Text style={{ color: softColor, fontSize: 12, fontWeight: '700' }}>
              {isKo ? '종일 일정' : 'All day'}
            </Text>
          </View>
        ) : null}
      </View>

      <DetailTagSection
        title={isKo ? '태그' : 'Tags'}
        tags={selectedTags.map((tag) => ({ id: tag.tag_id, name: tag.name, color: tag.color }))}
      />

      {task.reminder_minutes ? (
        <Text style={{ color: softColor, fontSize: 12 }}>
          {isKo ? '알림' : 'Reminder'}: {task.reminder_minutes}{isKo ? '분 전' : ' min before'}
        </Text>
      ) : null}

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Text style={{ color: softColor, fontSize: 12, fontWeight: '700' }}>{isKo ? '첨부파일' : 'Attachments'}</Text>
          {session && workspace ? (
            <Pressable style={s.secondaryButtonHalf} onPress={() => void addAttachments()}>
              <Text style={s.secondaryButtonText}>{isKo ? '파일 추가' : 'Add file'}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={{ color: softColor, fontSize: 12 }}>
          {isKo
            ? '허용 형식: JPG, PNG, WEBP, PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, ZIP, HWP'
            : 'Allowed: JPG, PNG, WEBP, PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, ZIP, HWP'}
        </Text>
        {uploadingAttachmentIds.length > 0 ? (
          <Text style={{ color: softColor, fontSize: 12 }}>
            {isKo ? '첨부파일 업로드 중...' : 'Uploading attachments...'}
          </Text>
        ) : null}
        <DetailAttachmentSection
          title=""
          emptyLabel={isKo ? '첨부파일이 없습니다.' : 'No attachments.'}
          attachments={attachmentItems}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: softColor, fontSize: 12, fontWeight: '700' }}>
          {isKo ? '내용' : 'Content'}
        </Text>
        <SharedRichTextEditor
          valueJson={hasContentJson ? task.content ?? '' : ''}
          valueText={hasContentJson ? '' : task.content ?? ''}
          readOnly
          minHeight={Math.max(minHeight - 180, 280)}
          implementation="native"
        />
        {!hasContent ? (
          <Text style={{ color: contentColor, fontSize: 13 }}>
            {isKo ? '내용 없음' : 'No content'}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {onBackToList ? (
            <Pressable style={s.secondaryButtonHalf} onPress={onBackToList}>
              <Text style={s.secondaryButtonText}>{isKo ? '목록으로' : 'Back to list'}</Text>
            </Pressable>
          ) : null}
          {onOpenEdit ? (
            <Pressable style={s.primaryButtonHalf} onPress={onOpenEdit}>
              <Text style={s.primaryButtonText}>{isKo ? '수정' : 'Edit'}</Text>
            </Pressable>
          ) : null}
        </View>
        {onOpenExport ? (
          <Pressable style={s.secondaryButton} onPress={onOpenExport}>
            <Text style={s.secondaryButtonText}>{isKo ? '내보내기' : 'Export'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
