import AsyncStorage from '@react-native-async-storage/async-storage';
import { TASK_COLOR_OPTIONS } from './task-colors';
import { apiFetch } from './api';
import type { AuthSession } from './types';

const TASK_COLOR_PRESETS_KEY_PREFIX = 'mobile_task_color_presets_member_';
const MAX_CUSTOM_PRESETS = 24;

const DEFAULT_COLORS = TASK_COLOR_OPTIONS.map((item) => item.value.toUpperCase());

function colorPresetsKey(memberId: number) {
  return `${TASK_COLOR_PRESETS_KEY_PREFIX}${memberId}`;
}

function clampRgb(value: number) {
  return Math.max(0, Math.min(255, value));
}

function toHex(value: number) {
  return clampRgb(value).toString(16).padStart(2, '0').toUpperCase();
}

export function normalizeTaskColorInput(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  const hex3 = raw.match(/^#([0-9a-fA-F]{3})$/);
  if (hex3) {
    const [r, g, b] = hex3[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  const hex6 = raw.match(/^#([0-9a-fA-F]{6})$/);
  if (hex6) {
    return `#${hex6[1].toUpperCase()}`;
  }

  const rgb = raw.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (rgb) {
    const r = Number(rgb[1]);
    const g = Number(rgb[2]);
    const b = Number(rgb[3]);
    if ([r, g, b].some((value) => !Number.isFinite(value) || value < 0 || value > 255)) {
      return null;
    }
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  return null;
}

function mergeOptions(customColors: string[]) {
  const merged = [...DEFAULT_COLORS];
  for (const color of customColors) {
    if (!merged.includes(color)) {
      merged.push(color);
    }
  }
  return merged;
}

async function loadLocalPresets(memberId: number): Promise<string[]> {
  if (!Number.isFinite(memberId) || memberId <= 0) return [];
  const raw = await AsyncStorage.getItem(colorPresetsKey(memberId));
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => normalizeTaskColorInput(String(item ?? '')))
    .filter((item): item is string => Boolean(item));
}

async function saveLocalPresets(memberId: number, presets: string[]) {
  if (!Number.isFinite(memberId) || memberId <= 0) return;
  await AsyncStorage.setItem(colorPresetsKey(memberId), JSON.stringify(presets));
}

export async function loadTaskColorOptionsForMember(session: AuthSession): Promise<string[]> {
  const memberId = Number(session.memberId ?? 0);
  if (!Number.isFinite(memberId) || memberId <= 0) return DEFAULT_COLORS;
  try {
    const response = await apiFetch<{ presets?: string[] }>('/api/me/task-color-presets', session);
    const customColors = (Array.isArray(response.presets) ? response.presets : [])
      .map((item) => normalizeTaskColorInput(String(item ?? '')))
      .filter((item): item is string => Boolean(item))
      .slice(0, MAX_CUSTOM_PRESETS);
    await saveLocalPresets(memberId, customColors);
    return mergeOptions(customColors);
  } catch {
    try {
      const fallback = await loadLocalPresets(memberId);
      return mergeOptions(fallback);
    } catch {
      return DEFAULT_COLORS;
    }
  }
}

export async function saveTaskColorPresetForMember(
  session: AuthSession,
  input: string,
): Promise<{ saved: string | null; options: string[] }> {
  const memberId = Number(session.memberId ?? 0);
  if (!Number.isFinite(memberId) || memberId <= 0) {
    return { saved: null, options: DEFAULT_COLORS };
  }

  const normalized = normalizeTaskColorInput(input);
  if (!normalized) {
    return { saved: null, options: await loadTaskColorOptionsForMember(session) };
  }
  try {
    const currentResponse = await apiFetch<{ presets?: string[] }>('/api/me/task-color-presets', session);
    const current = (Array.isArray(currentResponse.presets) ? currentResponse.presets : [])
      .map((item) => normalizeTaskColorInput(String(item ?? '')))
      .filter((item): item is string => Boolean(item));
    const nextCustom = [normalized, ...current.filter((item) => item !== normalized)].slice(0, MAX_CUSTOM_PRESETS);
    const saveResponse = await apiFetch<{ presets?: string[] }>('/api/me/task-color-presets', session, {
      method: 'PATCH',
      body: JSON.stringify({ presets: nextCustom }),
    });
    const savedPresets = (Array.isArray(saveResponse.presets) ? saveResponse.presets : nextCustom)
      .map((item) => normalizeTaskColorInput(String(item ?? '')))
      .filter((item): item is string => Boolean(item))
      .slice(0, MAX_CUSTOM_PRESETS);
    await saveLocalPresets(memberId, savedPresets);
    return { saved: normalized, options: mergeOptions(savedPresets) };
  } catch {
    const local = await loadLocalPresets(memberId);
    const nextLocal = [normalized, ...local.filter((item) => item !== normalized)].slice(0, MAX_CUSTOM_PRESETS);
    await saveLocalPresets(memberId, nextLocal);
    return { saved: normalized, options: mergeOptions(nextLocal) };
  }
}
