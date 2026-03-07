import { isRichTextDocLike } from '@repo/utils';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { useI18n } from '../../contexts/I18nContext';
import { useThemeMode } from '../../contexts/ThemeContext';
import { getApiBaseUrl } from '../../lib/api';
import type { TaskItem } from '../../lib/types';
import { createStyles } from '../../styles/createStyles';
import { DetailAttachmentSection, DetailTagSection } from '../detail/DetailSections';
import { SharedRichTextEditor } from '../editor/SharedRichTextEditor';

type Props = {
  task: TaskItem;
  authToken?: string;
  availableTags?: Array<{ tag_id: number; name: string; color?: string }>;
  minHeight?: number;
  onBackToList?: () => void;
  onOpenEdit?: () => void;
  onOpenExport?: () => void;
};

type TaskAttachment = {
  attachment_id: number;
  file_id: number;
  original_name: string;
  file_size_formatted?: string;
  file_path?: string;
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

export function TaskDetailWebView({
  task,
  authToken,
  availableTags = [],
  minHeight = 460,
  onBackToList,
  onOpenEdit,
  onOpenExport,
}: Props) {
  const { resolvedMode, colors } = useThemeMode();
  const { locale } = useI18n();
  const isKo = locale === 'ko';
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
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
    if (!authToken || !task.id) {
      setAttachments([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/tasks/attachments?task_id=${task.id}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!response.ok) {
          if (!cancelled) setAttachments([]);
          return;
        }
        const data = (await response.json()) as { attachments?: TaskAttachment[] };
        if (!cancelled) setAttachments(Array.isArray(data.attachments) ? data.attachments : []);
      } catch {
        if (!cancelled) setAttachments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken, task.id]);

  const attachmentItems = useMemo(
    () =>
      attachments.map((item) => ({
        id: item.attachment_id,
        name: item.original_name,
        sizeLabel: item.file_size_formatted,
        onOpen: async () => {
          const url = resolveFileUrl(item.file_path);
          if (!url) {
            Alert.alert(isKo ? '오류' : 'Error', isKo ? '파일 경로를 찾을 수 없습니다.' : 'File path is missing.');
            return;
          }
          const canOpen = await Linking.canOpenURL(url);
          if (!canOpen) {
            Alert.alert(isKo ? '오류' : 'Error', isKo ? '파일을 열 수 없습니다.' : 'Unable to open file.');
            return;
          }
          await Linking.openURL(url);
        },
        onDownload: async () => {
          const url = resolveFileUrl(item.file_path);
          if (!url) {
            Alert.alert(isKo ? '오류' : 'Error', isKo ? '파일 경로를 찾을 수 없습니다.' : 'File path is missing.');
            return;
          }
          await Linking.openURL(url);
        },
      })),
    [attachments, isKo],
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

      <DetailAttachmentSection
        title={isKo ? '첨부파일' : 'Attachments'}
        emptyLabel={isKo ? '첨부파일이 없습니다.' : 'No attachments.'}
        attachments={attachmentItems}
      />

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
