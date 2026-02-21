import { describe, it, expect } from 'vitest';
import { SEED_SCHEDULES, SEED_MEMOS, SEED_FILES, SEED_NOTIFICATIONS, SEED_WORKSPACES, SEED_TAGS } from '../lib/seed-data';
import { TAG_COLORS, SCHEDULE_COLORS } from '../lib/types';

describe('Pecal App - Data Models', () => {
  it('seed workspaces are valid', () => {
    expect(SEED_WORKSPACES.length).toBeGreaterThan(0);
    expect(SEED_WORKSPACES[0].type).toBe('personal');
    expect(SEED_WORKSPACES[1].type).toBe('team');
  });

  it('seed tags have valid colors', () => {
    SEED_TAGS.forEach(tag => {
      expect(TAG_COLORS).toContain(tag.color);
    });
  });

  it('seed schedules have required fields', () => {
    SEED_SCHEDULES.forEach(s => {
      expect(s.id).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(['TODO', 'IN_PROGRESS', 'DONE']).toContain(s.status);
      expect(SCHEDULE_COLORS).toContain(s.color);
    });
  });

  it('seed memos have required fields', () => {
    SEED_MEMOS.forEach(m => {
      expect(m.id).toBeTruthy();
      expect(m.title).toBeTruthy();
      expect(typeof m.isFavorite).toBe('boolean');
    });
  });

  it('seed files have valid types', () => {
    SEED_FILES.forEach(f => {
      expect(['image', 'document', 'other']).toContain(f.type);
      expect(f.size).toBeGreaterThan(0);
    });
  });

  it('seed notifications have valid types', () => {
    SEED_NOTIFICATIONS.forEach(n => {
      expect(['schedule', 'memo', 'file', 'team']).toContain(n.type);
      expect(typeof n.isRead).toBe('boolean');
    });
  });

  it('workspace IDs are unique', () => {
    const ids = SEED_WORKSPACES.map(w => w.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('schedule IDs are unique', () => {
    const ids = SEED_SCHEDULES.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe('Pecal App - Business Logic', () => {
  it('can filter schedules by status', () => {
    const todo = SEED_SCHEDULES.filter(s => s.status === 'TODO');
    const inProgress = SEED_SCHEDULES.filter(s => s.status === 'IN_PROGRESS');
    const done = SEED_SCHEDULES.filter(s => s.status === 'DONE');
    expect(todo.length + inProgress.length + done.length).toBe(SEED_SCHEDULES.length);
  });

  it('can filter schedules by workspace', () => {
    const personal = SEED_SCHEDULES.filter(s => s.workspaceId === 'ws-personal');
    const team = SEED_SCHEDULES.filter(s => s.workspaceId === 'ws-team-1');
    expect(personal.length + team.length).toBe(SEED_SCHEDULES.length);
  });

  it('can filter memos by favorite', () => {
    const favorites = SEED_MEMOS.filter(m => m.isFavorite);
    expect(favorites.length).toBeGreaterThan(0);
  });

  it('can filter files by type', () => {
    const images = SEED_FILES.filter(f => f.type === 'image');
    const docs = SEED_FILES.filter(f => f.type === 'document');
    const others = SEED_FILES.filter(f => f.type === 'other');
    expect(images.length + docs.length + others.length).toBe(SEED_FILES.length);
  });

  it('unread notifications count correctly', () => {
    const unread = SEED_NOTIFICATIONS.filter(n => !n.isRead);
    expect(unread.length).toBeGreaterThan(0);
    expect(unread.length).toBeLessThanOrEqual(SEED_NOTIFICATIONS.length);
  });

  it('memo sort by latest works', () => {
    const sorted = [...SEED_MEMOS].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    expect(sorted[0].updatedAt >= sorted[sorted.length - 1].updatedAt).toBe(true);
  });

  it('memo sort by title works', () => {
    const sorted = [...SEED_MEMOS].sort((a, b) => a.title.localeCompare(b.title));
    expect(sorted[0].title <= sorted[sorted.length - 1].title).toBe(true);
  });
});
