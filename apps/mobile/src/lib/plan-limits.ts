import { ApiError, apiFetch } from './api';
import type { AuthSession } from './types';

export type WorkspaceUsageData = {
  workspace_name: string;
  plan: {
    plan_name: string;
    max_storage_bytes: number;
    max_file_size_bytes: number;
    max_members: number;
  };
  storage: {
    used_bytes: number;
    limit_bytes: number;
    file_count: number;
  };
  members: {
    current: number;
    max: number;
  };
  tasks: {
    total: number;
    created_this_month: number;
    completed_this_month: number;
    todo: number;
    in_progress: number;
  };
};

export type UploadLimitCheckResult = {
  allowed: boolean;
  reason?: string;
  usedBytes: number;
  limitBytes: number;
  maxFileSizeBytes: number;
  planName: string;
};

export async function getWorkspaceUsageData(
  session: AuthSession,
  workspaceId: number
): Promise<WorkspaceUsageData> {
  return apiFetch<WorkspaceUsageData>(`/api/me/usage?workspace_id=${workspaceId}`, session);
}

export async function checkUploadAllowedForWorkspace(
  session: AuthSession,
  workspaceId: number,
  fileSizeBytes: number
): Promise<UploadLimitCheckResult> {
  const usage = await getWorkspaceUsageData(session, workspaceId);
  const maxFileSizeBytes = usage.plan.max_file_size_bytes;
  const usedBytes = usage.storage.used_bytes;
  const limitBytes = usage.storage.limit_bytes;

  if (fileSizeBytes > maxFileSizeBytes) {
    return {
      allowed: false,
      reason: `파일 크기가 최대 허용 크기를 초과했습니다.`,
      usedBytes,
      limitBytes,
      maxFileSizeBytes,
      planName: usage.plan.plan_name,
    };
  }

  if (usedBytes + fileSizeBytes > limitBytes) {
    return {
      allowed: false,
      reason: `저장소 용량이 부족합니다.`,
      usedBytes,
      limitBytes,
      maxFileSizeBytes,
      planName: usage.plan.plan_name,
    };
  }

  return {
    allowed: true,
    usedBytes,
    limitBytes,
    maxFileSizeBytes,
    planName: usage.plan.plan_name,
  };
}

export function isUploadLimitError(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}
