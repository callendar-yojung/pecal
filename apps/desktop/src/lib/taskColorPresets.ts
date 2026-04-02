import { taskColorPresetsApi } from '../api'

const TASK_COLOR_PRESETS_KEY_PREFIX = 'desktop_task_color_presets_member_'
const MAX_CUSTOM_PRESETS = 24

export const DEFAULT_TASK_COLORS = [
  '#3B82F6',
  '#EF4444',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#6366F1',
  '#14B8A6',
] as const

function colorPresetsKey(memberId: number) {
  return `${TASK_COLOR_PRESETS_KEY_PREFIX}${memberId}`
}

function clampRgb(value: number) {
  return Math.max(0, Math.min(255, value))
}

function toHex(value: number) {
  return clampRgb(value).toString(16).padStart(2, '0').toUpperCase()
}

export function normalizeTaskColorInput(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  const hex3 = raw.match(/^#([0-9a-fA-F]{3})$/)
  if (hex3) {
    const [r, g, b] = hex3[1].split('')
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }

  const hex6 = raw.match(/^#([0-9a-fA-F]{6})$/)
  if (hex6) {
    return `#${hex6[1].toUpperCase()}`
  }

  const rgb = raw.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i)
  if (rgb) {
    const r = Number(rgb[1])
    const g = Number(rgb[2])
    const b = Number(rgb[3])
    if ([r, g, b].some((value) => !Number.isFinite(value) || value < 0 || value > 255)) {
      return null
    }
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  }

  return null
}

function mergeOptions(customColors: string[]) {
  const merged: string[] = [...DEFAULT_TASK_COLORS]
  for (const color of customColors) {
    if (!merged.includes(color)) {
      merged.push(color)
    }
  }
  return merged
}

function readLocalPresets(memberId: number): string[] {
  if (!Number.isFinite(memberId) || memberId <= 0 || typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(colorPresetsKey(memberId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => normalizeTaskColorInput(String(item ?? '')))
      .filter((item): item is string => Boolean(item))
  } catch {
    return []
  }
}

function saveLocalPresets(memberId: number, presets: string[]) {
  if (!Number.isFinite(memberId) || memberId <= 0 || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(colorPresetsKey(memberId), JSON.stringify(presets))
  } catch {
    // local cache write failure should not block UX
  }
}

export async function loadTaskColorOptionsForMember(memberId?: number): Promise<string[]> {
  const normalizedMemberId = Number(memberId ?? 0)
  if (!Number.isFinite(normalizedMemberId) || normalizedMemberId <= 0) return [...DEFAULT_TASK_COLORS]

  try {
    const response = await taskColorPresetsApi.getPresets()
    const customColors = (Array.isArray(response.presets) ? response.presets : [])
      .map((item) => normalizeTaskColorInput(String(item ?? '')))
      .filter((item): item is string => Boolean(item))
      .slice(0, MAX_CUSTOM_PRESETS)
    saveLocalPresets(normalizedMemberId, customColors)
    return mergeOptions(customColors)
  } catch {
    return mergeOptions(readLocalPresets(normalizedMemberId))
  }
}

export async function saveTaskColorPresetForMember(
  memberId: number | undefined,
  input: string,
): Promise<{ saved: string | null; options: string[] }> {
  const normalizedMemberId = Number(memberId ?? 0)
  if (!Number.isFinite(normalizedMemberId) || normalizedMemberId <= 0) {
    return { saved: null, options: [...DEFAULT_TASK_COLORS] }
  }

  const normalized = normalizeTaskColorInput(input)
  if (!normalized) {
    return { saved: null, options: await loadTaskColorOptionsForMember(normalizedMemberId) }
  }

  try {
    const currentResponse = await taskColorPresetsApi.getPresets()
    const current = (Array.isArray(currentResponse.presets) ? currentResponse.presets : [])
      .map((item) => normalizeTaskColorInput(String(item ?? '')))
      .filter((item): item is string => Boolean(item))
    const nextCustom = [normalized, ...current.filter((item) => item !== normalized)].slice(0, MAX_CUSTOM_PRESETS)
    const saveResponse = await taskColorPresetsApi.updatePresets(nextCustom)
    const savedPresets = (Array.isArray(saveResponse.presets) ? saveResponse.presets : nextCustom)
      .map((item) => normalizeTaskColorInput(String(item ?? '')))
      .filter((item): item is string => Boolean(item))
      .slice(0, MAX_CUSTOM_PRESETS)
    saveLocalPresets(normalizedMemberId, savedPresets)
    return { saved: normalized, options: mergeOptions(savedPresets) }
  } catch {
    const local = readLocalPresets(normalizedMemberId)
    const nextLocal = [normalized, ...local.filter((item) => item !== normalized)].slice(0, MAX_CUSTOM_PRESETS)
    saveLocalPresets(normalizedMemberId, nextLocal)
    return { saved: normalized, options: mergeOptions(nextLocal) }
  }
}
