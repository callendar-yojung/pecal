import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { mapStatusToApiCode } from '@repo/api-client';
import { ApiError, getApiBaseUrl, getMobileClientHeaders } from './api';
import { checkUploadAllowedForWorkspace } from './plan-limits';
import type { AuthSession, TaskAttachmentItem, Workspace } from './types';

export type PickedAttachment = {
  localId: string;
  name: string;
  uri: string;
  mimeType: string;
  size: number;
};

type UploadAttachmentSuccess = {
  file: {
    file_id: number;
    original_name: string;
    file_size: number;
    file_size_formatted?: string;
    file_path?: string;
    mime_type?: string | null;
  };
};

type UploadAttachmentFailure = {
  error?: string;
  message?: string;
  code?: string;
  used_bytes?: number;
  limit_bytes?: number;
  max_file_size_bytes?: number;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}

function sanitizeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim() || `attachment-${Date.now()}`;
}

export function formatUploadLimitMessage(params: {
  reason?: string;
  maxFileSizeBytes: number;
  usedBytes: number;
  limitBytes: number;
  planName: string;
}) {
  const { reason, maxFileSizeBytes, usedBytes, limitBytes, planName } = params;
  return [
    reason || '업로드 제한에 걸렸습니다.',
    `플랜: ${planName}`,
    `최대 파일 크기: ${formatBytes(maxFileSizeBytes)}`,
    `사용 중 저장소: ${formatBytes(usedBytes)} / ${formatBytes(limitBytes)}`,
  ].join('\n');
}

export async function downloadAttachmentToCache(params: {
  url: string;
  fileName: string;
  session?: AuthSession | null;
}) {
  const { url, fileName, session } = params;
  if (!FileSystem.cacheDirectory) {
    throw new Error('캐시 디렉터리를 사용할 수 없습니다.');
  }

  const dir = `${FileSystem.cacheDirectory}attachments/`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }

  const targetUri = `${dir}${Date.now()}-${sanitizeFileName(fileName)}`;
  const result = await FileSystem.downloadAsync(url, targetUri, {
    headers: {
      ...getMobileClientHeaders(),
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
    },
  });

  return result.uri;
}

export async function downloadAndShareAttachment(params: {
  url: string;
  fileName: string;
  mimeType?: string | null;
  session?: AuthSession | null;
}) {
  const localUri = await downloadAttachmentToCache({
    url: params.url,
    fileName: params.fileName,
    session: params.session,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    return localUri;
  }

  await Sharing.shareAsync(localUri, {
    mimeType: params.mimeType || undefined,
    dialogTitle: params.fileName,
  });

  return localUri;
}

export async function pickAttachments(): Promise<PickedAttachment[]> {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    type: '*/*',
  });
  if (result.canceled) return [];

  return result.assets
    .filter((asset) => asset.uri && asset.name && typeof asset.size === 'number')
    .map((asset) => ({
      localId: `${asset.uri}:${asset.lastModified ?? Date.now()}`,
      name: asset.name,
      uri: asset.uri,
      mimeType: asset.mimeType || 'application/octet-stream',
      size: asset.size ?? 0,
    }));
}

export async function pickImageAttachments(): Promise<PickedAttachment[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('사진 라이브러리 접근 권한이 필요합니다.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsMultipleSelection: true,
    mediaTypes: ['images'],
    quality: 1,
  });
  if (result.canceled) return [];

  return result.assets
    .filter((asset) => asset.uri && asset.fileName && typeof asset.fileSize === 'number')
    .map((asset) => ({
      localId: `${asset.assetId ?? asset.uri}:${asset.fileSize ?? Date.now()}`,
      name: asset.fileName ?? `image-${Date.now()}.jpg`,
      uri: asset.uri,
      mimeType: asset.mimeType || 'image/jpeg',
      size: asset.fileSize ?? 0,
    }));
}

export async function ensureAttachmentAllowed(
  session: AuthSession,
  workspace: Workspace,
  fileSizeBytes: number,
) {
  return checkUploadAllowedForWorkspace(session, workspace.workspace_id, fileSizeBytes);
}

export async function uploadTaskAttachment(params: {
  session: AuthSession;
  workspace: Workspace;
  taskId: number;
  attachment: PickedAttachment;
}): Promise<TaskAttachmentItem> {
  const { session, workspace, taskId, attachment } = params;
  const formData = new FormData();
  formData.append('owner_type', workspace.type);
  formData.append('owner_id', String(workspace.owner_id));
  formData.append('task_id', String(taskId));
  formData.append('file', {
    uri: attachment.uri,
    name: attachment.name,
    type: attachment.mimeType,
  } as unknown as Blob);

  const response = await fetch(`${getApiBaseUrl()}/api/files/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      ...getMobileClientHeaders(),
    },
    body: formData,
  });

  const payload = (await response.json()) as UploadAttachmentSuccess | UploadAttachmentFailure;

  if (!response.ok) {
    const errorPayload = payload as UploadAttachmentFailure;
    throw new ApiError({
      message: errorPayload.error || errorPayload.message || '파일 업로드에 실패했습니다.',
      status: response.status,
      code: mapStatusToApiCode(response.status),
      retryable: false,
      source: 'mobile',
      details: errorPayload,
    });
  }

  const successPayload = payload as UploadAttachmentSuccess;
  return {
    attachment_id: Number(successPayload.file.file_id),
    file_id: Number(successPayload.file.file_id),
    original_name: successPayload.file.original_name,
    file_size: successPayload.file.file_size,
    file_size_formatted: successPayload.file.file_size_formatted || formatBytes(successPayload.file.file_size),
    file_path: successPayload.file.file_path,
    mime_type: successPayload.file.mime_type,
  };
}

export async function deleteTaskAttachment(params: {
  session: AuthSession;
  attachmentId: number;
}) {
  const { session, attachmentId } = params;
  const response = await fetch(`${getApiBaseUrl()}/api/tasks/attachments?attachment_id=${attachmentId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      ...getMobileClientHeaders(),
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new ApiError({
      message: payload.error || payload.message || '첨부파일을 삭제하지 못했습니다.',
      status: response.status,
      code: mapStatusToApiCode(response.status),
      retryable: false,
      source: 'mobile',
      details: payload,
    });
  }
}
