import { apiClient } from './client'
import type { UsageData } from '../types'

type RawUsageResponse = {
  workspace_name?: string
  workspace?: {
    name?: string
  }
  plan?: {
    plan_name?: string
    name?: string
    max_storage_bytes?: number | string | null
    max_storage_mb?: number | string | null
    max_file_size_bytes?: number | string | null
    max_file_size_mb?: number | string | null
    max_members?: number | string | null
  }
  storage?: {
    used_bytes?: number | string | null
    limit_bytes?: number | string | null
    file_count?: number | string | null
  }
  members?: {
    current?: number | string | null
    max?: number | string | null
  }
  tasks?: {
    total?: number | string | null
    created_this_month?: number | string | null
    completed_this_month?: number | string | null
    todo?: number | string | null
    in_progress?: number | string | null
    thisMonth?: {
      created?: number | string | null
      completed?: number | string | null
      todo?: number | string | null
      inProgress?: number | string | null
    }
  }
}

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const mbToBytes = (mbValue: unknown): number => {
  const mb = toNumber(mbValue, 0)
  return mb > 0 ? mb * 1024 * 1024 : 0
}

const normalizeUsage = (raw: RawUsageResponse): UsageData => {
  const storage = raw.storage ?? {}
  const plan = raw.plan ?? {}
  const tasks = raw.tasks ?? {}
  const thisMonth = tasks.thisMonth ?? {}

  const maxStorageBytesRaw = toNumber(plan.max_storage_bytes, 0)
  const maxFileSizeBytesRaw = toNumber(plan.max_file_size_bytes, 0)

  return {
    workspace_name: raw.workspace_name || raw.workspace?.name || '',
    plan: {
      plan_name: plan.plan_name || plan.name || 'Basic',
      max_storage_bytes: maxStorageBytesRaw > 0 ? maxStorageBytesRaw : mbToBytes(plan.max_storage_mb),
      max_file_size_bytes: maxFileSizeBytesRaw > 0 ? maxFileSizeBytesRaw : mbToBytes(plan.max_file_size_mb),
      max_members: toNumber(plan.max_members, 0),
    },
    storage: {
      used_bytes: toNumber(storage.used_bytes, 0),
      limit_bytes: toNumber(storage.limit_bytes, 0),
      file_count: toNumber(storage.file_count, 0),
    },
    members: {
      current: toNumber(raw.members?.current, 0),
      max: toNumber(raw.members?.max, 0),
    },
    tasks: {
      total: toNumber(tasks.total, 0),
      created_this_month: toNumber(tasks.created_this_month ?? thisMonth.created, 0),
      completed_this_month: toNumber(tasks.completed_this_month ?? thisMonth.completed, 0),
      todo: toNumber(tasks.todo ?? thisMonth.todo, 0),
      in_progress: toNumber(tasks.in_progress ?? thisMonth.inProgress, 0),
    },
  }
}

export const usageApi = {
  getUsage: async (workspaceId: number): Promise<UsageData> => {
    const raw = await apiClient.get<RawUsageResponse>(`/api/me/usage?workspace_id=${workspaceId}`)
    return normalizeUsage(raw)
  },
}

