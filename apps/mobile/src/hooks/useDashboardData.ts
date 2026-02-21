import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, apiFetch, cachedApiFetch, getApiBaseUrl, invalidateApiCache } from '../lib/api';
import { defaultTaskRangeByDate, groupTasksByDate } from '../lib/date';
import {
  enqueueMemoOffline,
  enqueueTaskOffline,
  flushOfflineQueue,
  getOfflineQueueCount,
} from '../lib/offline-queue';
import type {
  AuthSession,
  FileItem,
  MainTab,
  MemoItem,
  NotificationItem,
  TagItem,
  TaskItem,
  TaskStatus,
  TeamItem,
  Workspace,
} from '../lib/types';

type TaskMutationInput = {
  title?: string;
  start_time?: string;
  end_time?: string;
  content?: string | null;
  status?: TaskStatus;
  color?: string;
  tag_ids?: number[];
  description?: string | null;
  assignee_id?: number | null;
  is_all_day?: boolean;
  reminder_minutes?: number | null;
  rrule?: string | null;
};

type MemoMeta = {
  pinned?: boolean;
  tags?: string[];
  folder?: string;
};

type MemoMetaMap = Record<number, MemoMeta>;

type DraftPayload = {
  title: string;
  text: string;
  json?: string;
  selectedMemoId: number | null;
  baseUpdatedAt: string | null;
  savedAt: string;
};

function memoDraftKey(workspaceId: number) {
  return `pecal_mobile_memo_draft:${workspaceId}`;
}

function memoMetaKey(workspaceId: number) {
  return `pecal_mobile_memo_meta:${workspaceId}`;
}

function parseInline(text: string) {
  const nodes: Array<Record<string, any>> = [];
  const pushText = (value: string, marks?: Array<Record<string, any>>) => {
    if (!value) return;
    nodes.push(marks?.length ? { type: 'text', text: value, marks } : { type: 'text', text: value });
  };
  let rest = text;
  const patterns: Array<{
    regex: RegExp;
    toNode: (m: RegExpExecArray) => Record<string, any>;
  }> = [
    {
      regex: /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)/,
      toNode: (m) => ({ type: 'text', text: m[1], marks: [{ type: 'link', attrs: { href: m[2] } }] }),
    },
    { regex: /^\*\*([^*]+)\*\*/, toNode: (m) => ({ type: 'text', text: m[1], marks: [{ type: 'bold' }] }) },
    { regex: /^_([^_]+)_/, toNode: (m) => ({ type: 'text', text: m[1], marks: [{ type: 'italic' }] }) },
    { regex: /^~~([^~]+)~~/, toNode: (m) => ({ type: 'text', text: m[1], marks: [{ type: 'strike' }] }) },
    { regex: /^`([^`]+)`/, toNode: (m) => ({ type: 'text', text: m[1], marks: [{ type: 'code' }] }) },
    { regex: /^==([^=]+)==/, toNode: (m) => ({ type: 'text', text: m[1], marks: [{ type: 'highlight' }] }) },
  ];

  while (rest.length) {
    let matched = false;
    for (const p of patterns) {
      const match = p.regex.exec(rest);
      if (match) {
        nodes.push(p.toNode(match));
        rest = rest.slice(match[0].length);
        matched = true;
        break;
      }
    }
    if (matched) continue;
    pushText(rest[0]);
    rest = rest.slice(1);
  }

  return nodes.length ? nodes : [{ type: 'text', text }];
}

function textToDoc(text: string) {
  const lines = text.split('\n');
  const content: Array<Record<string, any>> = [];
  let i = 0;

  const buildParagraph = (value: string, attrs?: Record<string, any>) => ({
    type: 'paragraph',
    ...(attrs ? { attrs } : {}),
    content: parseInline(value),
  });

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      content.push({ type: 'paragraph' });
      i += 1;
      continue;
    }
    const align = /^<div align="(left|center|right)">(.*)<\/div>$/.exec(line);
    if (align) {
      content.push(buildParagraph(align[2], { textAlign: align[1] }));
      i += 1;
      continue;
    }
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      content.push({
        type: 'codeBlock',
        content: [{ type: 'text', text: codeLines.join('\n') }],
      });
      continue;
    }
    if (line.startsWith('# ')) {
      content.push({ type: 'heading', attrs: { level: 1 }, content: parseInline(line.slice(2)) });
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      content.push({ type: 'heading', attrs: { level: 2 }, content: parseInline(line.slice(3)) });
      i += 1;
      continue;
    }
    if (line.startsWith('### ')) {
      content.push({ type: 'heading', attrs: { level: 3 }, content: parseInline(line.slice(4)) });
      i += 1;
      continue;
    }
    if (line.startsWith('> ')) {
      content.push({ type: 'blockquote', content: [buildParagraph(line.slice(2))] });
      i += 1;
      continue;
    }
    if (line.startsWith('- [ ] ')) {
      content.push({
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [buildParagraph(line.slice(6))],
          },
        ],
      });
      i += 1;
      continue;
    }
    if (/^- /.test(line)) {
      const items: Array<Record<string, any>> = [];
      while (i < lines.length && /^- /.test(lines[i])) {
        items.push({ type: 'listItem', content: [buildParagraph(lines[i].slice(2))] });
        i += 1;
      }
      content.push({ type: 'bulletList', content: items });
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items: Array<Record<string, any>> = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        const cleaned = lines[i].replace(/^\d+\. /, '');
        items.push({ type: 'listItem', content: [buildParagraph(cleaned)] });
        i += 1;
      }
      content.push({ type: 'orderedList', content: items });
      continue;
    }
    content.push(buildParagraph(line));
    i += 1;
  }

  return {
    type: 'doc' as const,
    content: content.length ? content : [{ type: 'paragraph' }],
  };
}

function inlineToText(nodes: Array<Record<string, any>> = []) {
  return nodes
    .map((node) => {
      if (node.type !== 'text') return '';
      const text = String(node.text ?? '');
      const marks = Array.isArray(node.marks) ? node.marks : [];
      const link = marks.find((m) => m.type === 'link')?.attrs?.href;
      if (link) return `[${text}](${link})`;
      if (marks.some((m) => m.type === 'bold')) return `**${text}**`;
      if (marks.some((m) => m.type === 'italic')) return `_${text}_`;
      if (marks.some((m) => m.type === 'strike')) return `~~${text}~~`;
      if (marks.some((m) => m.type === 'code')) return `\`${text}\``;
      if (marks.some((m) => m.type === 'highlight')) return `==${text}==`;
      return text;
    })
    .join('');
}

function docToText(doc: Record<string, any>) {
  const blocks = Array.isArray(doc?.content) ? doc.content : [];
  const lines: string[] = [];
  for (const block of blocks) {
    if (!block?.type) continue;
    if (block.type === 'paragraph') {
      const txt = inlineToText(block.content ?? []);
      const align = block?.attrs?.textAlign;
      if (align) lines.push(`<div align="${align}">${txt}</div>`);
      else lines.push(txt);
      continue;
    }
    if (block.type === 'heading') {
      const level = Number(block?.attrs?.level ?? 1);
      const prefix = level === 1 ? '# ' : level === 2 ? '## ' : '### ';
      lines.push(`${prefix}${inlineToText(block.content ?? [])}`);
      continue;
    }
    if (block.type === 'blockquote') {
      const first = block?.content?.[0];
      lines.push(`> ${inlineToText(first?.content ?? [])}`);
      continue;
    }
    if (block.type === 'bulletList') {
      const items = Array.isArray(block?.content) ? block.content : [];
      for (const item of items) {
        lines.push(`- ${inlineToText(item?.content?.[0]?.content ?? [])}`);
      }
      continue;
    }
    if (block.type === 'orderedList') {
      const items = Array.isArray(block?.content) ? block.content : [];
      let index = 1;
      for (const item of items) {
        lines.push(`${index}. ${inlineToText(item?.content?.[0]?.content ?? [])}`);
        index += 1;
      }
      continue;
    }
    if (block.type === 'taskList') {
      const items = Array.isArray(block?.content) ? block.content : [];
      for (const item of items) {
        lines.push(`- [ ] ${inlineToText(item?.content?.[0]?.content ?? [])}`);
      }
      continue;
    }
    if (block.type === 'codeBlock') {
      lines.push('```');
      lines.push(inlineToText(block.content ?? []));
      lines.push('```');
      continue;
    }
  }
  return lines.join('\n').trim();
}

export function useDashboardData(session: AuthSession | null) {
  const [tab, setTab] = useState<MainTab>('overview');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | null>(null);
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);

  const [teamCreateOpen, setTeamCreateOpen] = useState(false);
  const [teamCreateStep, setTeamCreateStep] = useState<'details' | 'plan'>('details');
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [createdTeamId, setCreatedTeamId] = useState<number | null>(null);

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [memos, setMemos] = useState<MemoItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [calendarSelectedDate, setCalendarSelectedDate] = useState(new Date());
  const [activeScheduleId, setActiveScheduleId] = useState<number | null>(null);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskContentJson, setTaskContentJson] = useState<string>('');
  const [taskRange, setTaskRange] = useState(defaultTaskRangeByDate(new Date()));
  const [memoTitle, setMemoTitle] = useState('');
  const [memoText, setMemoText] = useState('');
  const [memoContentJson, setMemoContentJson] = useState<string>('');
  const [memoSort, setMemoSort] = useState<'latest' | 'oldest' | 'favorite'>('latest');
  const [memoFavoriteOnly, setMemoFavoriteOnly] = useState(false);
  const [memoIsSaving, setMemoIsSaving] = useState(false);
  const [selectedMemoId, setSelectedMemoId] = useState<number | null>(null);
  const [memoBaseUpdatedAt, setMemoBaseUpdatedAt] = useState<string | null>(null);
  const [memoConflict, setMemoConflict] = useState(false);
  const [memoMetaMap, setMemoMetaMap] = useState<MemoMetaMap>({});
  const [memoSearch, setMemoSearch] = useState('');
  const [memoFolderFilter, setMemoFolderFilter] = useState('all');
  const memoAutosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memoRemoteAutosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memoAutoCreateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memoCreatingRef = useRef(false);

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.workspace_id === selectedWorkspaceId) ?? null,
    [workspaces, selectedWorkspaceId]
  );
  const personalWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.type === 'personal') ?? null,
    [workspaces]
  );
  const teamWorkspaces = useMemo(() => {
    return workspaces
      .filter((workspace) => workspace.type === 'team')
      .map((workspace) => {
        const team = teams.find((item) => item.id === workspace.owner_id);
        return { ...workspace, teamName: team?.name ?? `Team ${workspace.owner_id}` };
      });
  }, [workspaces, teams]);

  const modeLabel = useMemo(() => {
    if (selectedWorkspace?.type === 'personal') return '개인';
    const current = teamWorkspaces.find((workspace) => workspace.workspace_id === selectedWorkspaceId);
    return current?.teamName ?? '팀';
  }, [selectedWorkspace, teamWorkspaces, selectedWorkspaceId]);

  const tasksByDate = useMemo(() => groupTasksByDate(tasks), [tasks]);
  const decoratedMemos = useMemo(() => {
    const normalizedSearch = memoSearch.trim().toLowerCase();
    return memos
      .map((memo) => {
        const meta = memoMetaMap[memo.memo_id] ?? {};
        return {
          ...memo,
          is_pinned: !!meta.pinned || memo.is_favorite === 1,
          tags: meta.tags ?? [],
          folder: meta.folder ?? 'inbox',
        };
      })
      .filter((memo) => {
        if (memoFavoriteOnly && memo.is_favorite !== 1 && !memo.is_pinned) return false;
        if (memoFolderFilter !== 'all' && memo.folder !== memoFolderFilter) return false;
        if (!normalizedSearch) return true;
        const haystack = `${memo.title} ${memo.content_json ?? ''} ${(memo.tags ?? []).join(' ')}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => {
        if (memoSort === 'favorite') {
          const af = a.is_favorite === 1 || a.is_pinned;
          const bf = b.is_favorite === 1 || b.is_pinned;
          if (af !== bf) return af ? -1 : 1;
        }
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        if (memoSort === 'oldest') return a.updated_at.localeCompare(b.updated_at);
        return b.updated_at.localeCompare(a.updated_at);
      });
  }, [memos, memoMetaMap, memoSearch, memoFolderFilter, memoFavoriteOnly, memoSort]);

  const loadWorkspaces = async () => {
    if (!session) return;
    try {
      const [workspaceRes, teamRes] = await Promise.all([
        cachedApiFetch<{ workspaces: Workspace[] }>(
          'workspaces:me',
          '/api/me/workspaces',
          session,
          {},
          { cacheMs: 15_000, dedupe: true, retries: 1 }
        ),
        cachedApiFetch<{ teams: TeamItem[] }>(
          'teams:me',
          '/api/me/teams',
          session,
          {},
          { cacheMs: 15_000, dedupe: true, retries: 1 }
        ),
      ]);
      setWorkspaces(workspaceRes.workspaces ?? []);
      setTeams(teamRes.teams ?? []);

      const nextSelected = selectedWorkspaceId && workspaceRes.workspaces.some((w) => w.workspace_id === selectedWorkspaceId)
        ? selectedWorkspaceId
        : workspaceRes.workspaces[0]?.workspace_id ?? null;
      setSelectedWorkspaceId(nextSelected);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const loadDashboard = async (workspace: Workspace) => {
    if (!session) return;
    setDashboardLoading(true);
    try {
      const results = await Promise.allSettled([
        cachedApiFetch<{ tasks: TaskItem[] }>(
          `tasks:${workspace.workspace_id}:limit60`,
          `/api/tasks?workspace_id=${workspace.workspace_id}&limit=60`,
          session,
          {},
          { cacheMs: 8_000, dedupe: true, retries: 1 }
        ),
        // Server validates page_size in range 1..50.
        cachedApiFetch<{ memos: MemoItem[] }>(
          `memos:${workspace.type}:${workspace.owner_id}:page1:size50`,
          `/api/memos?owner_type=${workspace.type}&owner_id=${workspace.owner_id}&page=1&page_size=50`,
          session,
          {},
          { cacheMs: 8_000, dedupe: true, retries: 1 }
        ),
        cachedApiFetch<{ files: FileItem[] }>(
          `files:${workspace.workspace_id}:limit60`,
          `/api/me/files?workspace_id=${workspace.workspace_id}&limit=60`,
          session,
          {},
          { cacheMs: 8_000, dedupe: true, retries: 1 }
        ),
        cachedApiFetch<{ tags: TagItem[] }>(
          `tags:${workspace.type}:${workspace.owner_id}`,
          `/api/tags?owner_type=${workspace.type}&owner_id=${workspace.owner_id}`,
          session,
          {},
          { cacheMs: 30_000, dedupe: true, retries: 1 }
        ),
        cachedApiFetch<{ notifications: NotificationItem[] }>(
          'notifications:limit20',
          '/api/notifications?limit=20',
          session,
          {},
          { cacheMs: 5_000, dedupe: true, retries: 1 }
        ),
        cachedApiFetch<{ count: number }>(
          'notifications:unread',
          '/api/notifications/unread',
          session,
          {},
          { cacheMs: 5_000, dedupe: true, retries: 1 }
        ),
      ]);

      const [taskRes, memoRes, fileRes, tagRes, notiRes, unreadRes] = results;

      const errors: string[] = [];

      if (taskRes.status === 'fulfilled') {
        setTasks(taskRes.value.tasks ?? []);
      } else {
        errors.push(taskRes.reason instanceof Error ? taskRes.reason.message : String(taskRes.reason));
        setTasks([]);
      }

      if (memoRes.status === 'fulfilled') {
        setMemos(memoRes.value.memos ?? []);
      } else {
        errors.push(memoRes.reason instanceof Error ? memoRes.reason.message : String(memoRes.reason));
        setMemos([]);
      }

      if (fileRes.status === 'fulfilled') {
        setFiles(fileRes.value.files ?? []);
      } else {
        errors.push(fileRes.reason instanceof Error ? fileRes.reason.message : String(fileRes.reason));
        setFiles([]);
      }

      if (tagRes.status === 'fulfilled') {
        setTags(tagRes.value.tags ?? []);
      } else {
        errors.push(tagRes.reason instanceof Error ? tagRes.reason.message : String(tagRes.reason));
        setTags([]);
      }

      if (notiRes.status === 'fulfilled') {
        setNotifications(notiRes.value.notifications ?? []);
      } else {
        errors.push(notiRes.reason instanceof Error ? notiRes.reason.message : String(notiRes.reason));
        setNotifications([]);
      }

      if (unreadRes.status === 'fulfilled') {
        setUnreadCount(unreadRes.value.count ?? 0);
      } else {
        errors.push(unreadRes.reason instanceof Error ? unreadRes.reason.message : String(unreadRes.reason));
        setUnreadCount(0);
      }

      setError(errors.length ? errors[0] : null);
      const queued = await getOfflineQueueCount();
      setOfflineQueueCount(queued);
      if (queued > 0) {
        void flushPendingQueue();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDashboardLoading(false);
    }
  };

  const flushPendingQueue = async () => {
    if (!session) return;
    const result = await flushOfflineQueue({
      onTask: async (item) => {
        await apiFetch('/api/tasks', session, {
          method: 'POST',
          body: JSON.stringify(item.payload),
        });
      },
      onMemo: async (item) => {
        await apiFetch('/api/memos', session, {
          method: 'POST',
          body: JSON.stringify(item.payload),
        });
      },
    });
    setOfflineQueueCount(result.remaining);
    if (result.processed > 0 && selectedWorkspace) {
      invalidateApiCache(`tasks:${selectedWorkspace.workspace_id}`);
      invalidateApiCache(`memos:${selectedWorkspace.type}:${selectedWorkspace.owner_id}`);
      await loadDashboard(selectedWorkspace);
    }
  };

  const createTask = async () => {
    if (!session || !selectedWorkspace) return;
    if (!taskTitle.trim()) {
      setError('일정 제목을 입력하세요.');
      return;
    }
    if (new Date(taskRange.start) >= new Date(taskRange.end)) {
      setError('종료 시간이 시작 시간보다 늦어야 합니다.');
      return;
    }
    const payload = {
      title: taskTitle.trim(),
      start_time: taskRange.start,
      end_time: taskRange.end,
      content: taskContentJson || null,
      workspace_id: selectedWorkspace.workspace_id,
      color: '#3B82F6',
      tag_ids: [] as number[],
      status: 'TODO' as TaskStatus,
    };

    try {
      await apiFetch('/api/tasks', session, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      invalidateApiCache(`tasks:${selectedWorkspace.workspace_id}`);
      setTaskTitle('');
      setTaskContentJson('');
      setTaskRange(defaultTaskRangeByDate(new Date(taskRange.start)));
      await loadDashboard(selectedWorkspace);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      if (apiError?.code === 'NETWORK_ERROR') {
        await enqueueTaskOffline({
          workspaceId: selectedWorkspace.workspace_id,
          payload,
        });
        setOfflineQueueCount(await getOfflineQueueCount());
        setError('오프라인 상태입니다. 일정을 임시 저장했고 연결 복구 시 자동 전송됩니다.');
        setTaskTitle('');
        return;
      }
      throw error;
    }
  };

  const refreshCurrentWorkspace = async () => {
    if (!selectedWorkspace) return;
    invalidateApiCache(`tasks:${selectedWorkspace.workspace_id}`);
    await loadDashboard(selectedWorkspace);
  };

  const updateTask = async (taskId: number, input: TaskMutationInput) => {
    if (!session || !selectedWorkspace) return;
    await apiFetch(`/api/tasks/${taskId}`, session, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    await refreshCurrentWorkspace();
  };

  const deleteTask = async (taskId: number) => {
    if (!session || !selectedWorkspace) return;
    await apiFetch(`/api/tasks/${taskId}`, session, {
      method: 'DELETE',
    });
    await refreshCurrentWorkspace();
  };

  const shiftTaskTime = async (taskId: number, minutes: number) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const start = new Date(task.start_time);
    const end = new Date(task.end_time);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    start.setMinutes(start.getMinutes() + minutes);
    end.setMinutes(end.getMinutes() + minutes);
    await updateTask(taskId, {
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    });
  };

  const resizeTaskDuration = async (taskId: number, endDeltaMinutes: number) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const start = new Date(task.start_time);
    const end = new Date(task.end_time);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    end.setMinutes(end.getMinutes() + endDeltaMinutes);
    if (end <= start) {
      setError('종료 시간이 시작 시간보다 늦어야 합니다.');
      return;
    }
    await updateTask(taskId, {
      end_time: end.toISOString(),
    });
  };

  const createMemo = async (opts?: { auto?: boolean }) => {
    if (!session || !selectedWorkspace) return;
    if (!memoTitle.trim()) {
      setError('메모 제목을 입력하세요.');
      return;
    }
    if (memoCreatingRef.current) return;
    const payload = {
      owner_type: selectedWorkspace.type,
      owner_id: selectedWorkspace.owner_id,
      title: memoTitle.trim(),
      content: memoContentJson ? JSON.parse(memoContentJson) : textToDoc(memoText.trim()),
    };

    try {
      memoCreatingRef.current = true;
      const created = await apiFetch<{ memo_id: number }>('/api/memos', session, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const nextUpdatedAt = new Date().toISOString();
      const createdId = Number(created?.memo_id);
      if (Number.isFinite(createdId) && createdId > 0) {
        setSelectedMemoId(createdId);
        setMemoBaseUpdatedAt(nextUpdatedAt);
        setMemos((prev) => {
          const exists = prev.some((m) => m.memo_id === createdId);
          if (exists) return prev;
          return [
            {
              memo_id: createdId,
              title: memoTitle.trim(),
              content_json: memoContentJson || JSON.stringify(textToDoc(memoText.trim())),
              updated_at: nextUpdatedAt,
              is_favorite: 0,
            },
            ...prev,
          ];
        });
      }
      invalidateApiCache(`memos:${selectedWorkspace.type}:${selectedWorkspace.owner_id}`);
      if (!opts?.auto) {
        await loadDashboard(selectedWorkspace);
      }
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      if (apiError?.code === 'NETWORK_ERROR') {
        await enqueueMemoOffline({
          workspaceId: selectedWorkspace.workspace_id,
          payload,
        });
        setOfflineQueueCount(await getOfflineQueueCount());
        setError('오프라인 상태입니다. 메모를 임시 저장했고 연결 복구 시 자동 전송됩니다.');
        return;
      }
      throw error;
    } finally {
      memoCreatingRef.current = false;
    }
  };

  const selectMemoForEdit = (memoId: number) => {
    const memo = memos.find((item) => item.memo_id === memoId);
    if (!memo) return;
    setSelectedMemoId(memo.memo_id);
    setMemoTitle(memo.title);
    setMemoBaseUpdatedAt(memo.updated_at);
    setMemoConflict(false);
    try {
      if (memo.content_json) {
        const parsed = JSON.parse(memo.content_json) as Record<string, any>;
        setMemoContentJson(JSON.stringify(parsed));
        setMemoText(docToText(parsed));
      } else {
        setMemoContentJson('');
        setMemoText('');
      }
    } catch {
      setMemoContentJson('');
      setMemoText('');
    }
  };

  const clearMemoEditor = async () => {
    setSelectedMemoId(null);
    setMemoBaseUpdatedAt(null);
    setMemoConflict(false);
    setMemoTitle('');
    setMemoText('');
    setMemoContentJson('');
    if (selectedWorkspace) {
      await AsyncStorage.removeItem(memoDraftKey(selectedWorkspace.workspace_id)).catch(() => undefined);
    }
  };

  const updateMemo = async (opts?: { force?: boolean; silent?: boolean }) => {
    if (!session || !selectedWorkspace || !selectedMemoId) return;
    if (!memoTitle.trim()) {
      setError('메모 제목을 입력하세요.');
      return;
    }
    const latest = memos.find((item) => item.memo_id === selectedMemoId);
    if (!opts?.force && latest && memoBaseUpdatedAt && latest.updated_at !== memoBaseUpdatedAt) {
      setMemoConflict(true);
      setError('다른 기기에서 메모가 변경되었습니다. 검토 후 덮어쓰기 하세요.');
      return;
    }
    setMemoIsSaving(true);
    try {
      await apiFetch(`/api/memos/${selectedMemoId}`, session, {
        method: 'PUT',
        body: JSON.stringify({
          owner_type: selectedWorkspace.type,
          owner_id: selectedWorkspace.owner_id,
          title: memoTitle.trim(),
          content: memoContentJson ? JSON.parse(memoContentJson) : textToDoc(memoText.trim()),
        }),
      });
      const nextUpdatedAt = new Date().toISOString();
      setMemos((prev) =>
        prev.map((memo) =>
          memo.memo_id === selectedMemoId
            ? {
                ...memo,
                title: memoTitle.trim(),
                content_json: memoContentJson || JSON.stringify(textToDoc(memoText.trim())),
                updated_at: nextUpdatedAt,
              }
            : memo
        )
      );
      setMemoConflict(false);
      setMemoBaseUpdatedAt(nextUpdatedAt);
      await AsyncStorage.removeItem(memoDraftKey(selectedWorkspace.workspace_id)).catch(() => undefined);
      invalidateApiCache(`memos:${selectedWorkspace.type}:${selectedWorkspace.owner_id}`);
      if (!opts?.silent) {
        await loadDashboard(selectedWorkspace);
      }
    } finally {
      setMemoIsSaving(false);
    }
  };

  const toggleMemoFavorite = async (memoId: number) => {
    if (!session || !selectedWorkspace) return;
    const memo = memos.find((item) => item.memo_id === memoId);
    if (!memo) return;
    await apiFetch(`/api/memos/${memoId}`, session, {
      method: 'PUT',
      body: JSON.stringify({
        owner_type: selectedWorkspace.type,
        owner_id: selectedWorkspace.owner_id,
        is_favorite: memo.is_favorite === 1 ? 0 : 1,
      }),
    });
    invalidateApiCache(`memos:${selectedWorkspace.type}:${selectedWorkspace.owner_id}`);
    await loadDashboard(selectedWorkspace);
  };

  const deleteMemo = async (memoId: number) => {
    if (!session || !selectedWorkspace) return;
    await apiFetch(
      `/api/memos/${memoId}?owner_type=${selectedWorkspace.type}&owner_id=${selectedWorkspace.owner_id}`,
      session,
      { method: 'DELETE' }
    );
    if (selectedMemoId === memoId) {
      await clearMemoEditor();
    }
    invalidateApiCache(`memos:${selectedWorkspace.type}:${selectedWorkspace.owner_id}`);
    await loadDashboard(selectedWorkspace);
  };

  const toggleMemoPinned = (memoId: number) => {
    setMemoMetaMap((prev) => {
      const current = prev[memoId] ?? {};
      return {
        ...prev,
        [memoId]: { ...current, pinned: !current.pinned },
      };
    });
  };

  const setMemoFolder = (memoId: number, folder: string) => {
    setMemoMetaMap((prev) => {
      const current = prev[memoId] ?? {};
      return {
        ...prev,
        [memoId]: { ...current, folder: folder.trim() || 'inbox' },
      };
    });
  };

  const setMemoTags = (memoId: number, tagsInput: string) => {
    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8);
    setMemoMetaMap((prev) => {
      const current = prev[memoId] ?? {};
      return {
        ...prev,
        [memoId]: { ...current, tags },
      };
    });
  };

  const createTeam = async () => {
    if (!session) return;
    if (!teamName.trim()) {
      setError('팀 이름을 입력하세요.');
      return;
    }
    setCreatingTeam(true);
    try {
      const result = await apiFetch<{ teamId: number }>('/api/me/teams', session, {
        method: 'POST',
        body: JSON.stringify({
          name: teamName.trim(),
          description: teamDescription.trim() || undefined,
        }),
      });
      setCreatedTeamId(result.teamId);
      setTeamCreateStep('plan');
    } finally {
      setCreatingTeam(false);
    }
  };

  const selectPlan = async (plan: 'free' | 'paid') => {
    if (plan === 'paid' && createdTeamId) {
      await Linking.openURL(`${getApiBaseUrl()}/dashboard/settings/billing/plans/team?owner_id=${createdTeamId}`);
    }
    setTeamCreateOpen(false);
    setTeamCreateStep('details');
    setTeamName('');
    setTeamDescription('');
    setCreatedTeamId(null);
    invalidateApiCache('workspaces:');
    invalidateApiCache('teams:');
    await loadWorkspaces();
  };

  const selectPersonal = () => {
    if (!personalWorkspace) return;
    setSelectedWorkspaceId(personalWorkspace.workspace_id);
    setWorkspacePickerOpen(false);
  };

  const selectTeamWorkspace = (workspaceId: number) => {
    setSelectedWorkspaceId(workspaceId);
    setWorkspacePickerOpen(false);
  };

  useEffect(() => {
    const workspaceId = selectedWorkspace?.workspace_id;
    if (!workspaceId) return;
    let alive = true;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(memoMetaKey(workspaceId));
        if (!alive) return;
        setMemoMetaMap(raw ? (JSON.parse(raw) as MemoMetaMap) : {});
      } catch {
        if (alive) setMemoMetaMap({});
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedWorkspace?.workspace_id]);

  useEffect(() => {
    const workspaceId = selectedWorkspace?.workspace_id;
    if (!workspaceId) return;
    void AsyncStorage.setItem(memoMetaKey(workspaceId), JSON.stringify(memoMetaMap)).catch(() => undefined);
  }, [memoMetaMap, selectedWorkspace?.workspace_id]);

  useEffect(() => {
    const workspaceId = selectedWorkspace?.workspace_id;
    if (!workspaceId) return;
    let alive = true;
    void (async () => {
      const raw = await AsyncStorage.getItem(memoDraftKey(workspaceId));
      if (!alive || !raw) return;
      try {
        const draft = JSON.parse(raw) as DraftPayload;
        setMemoTitle(draft.title ?? '');
        setMemoText(draft.text ?? '');
        setMemoContentJson(draft.json ?? '');
        setSelectedMemoId(draft.selectedMemoId ?? null);
        setMemoBaseUpdatedAt(draft.baseUpdatedAt ?? null);
      } catch {
        // ignore broken draft
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedWorkspace?.workspace_id]);

  useEffect(() => {
    const workspaceId = selectedWorkspace?.workspace_id;
    if (!workspaceId) return;
    if (memoAutosaveTimer.current) clearTimeout(memoAutosaveTimer.current);
    memoAutosaveTimer.current = setTimeout(() => {
      const hasDraft = memoTitle.trim() || memoText.trim() || selectedMemoId !== null;
      if (!hasDraft) return;
      const payload: DraftPayload = {
        title: memoTitle,
        text: memoText,
        json: memoContentJson,
        selectedMemoId,
        baseUpdatedAt: memoBaseUpdatedAt,
        savedAt: new Date().toISOString(),
      };
      void AsyncStorage.setItem(memoDraftKey(workspaceId), JSON.stringify(payload)).catch(() => undefined);
    }, 500);
    return () => {
      if (memoAutosaveTimer.current) clearTimeout(memoAutosaveTimer.current);
    };
  }, [memoTitle, memoText, memoContentJson, selectedMemoId, memoBaseUpdatedAt, selectedWorkspace?.workspace_id]);

  useEffect(() => {
    if (selectedMemoId || !selectedWorkspace || memoConflict) return;
    if (!memoTitle.trim()) return;
    if (memoAutoCreateTimer.current) clearTimeout(memoAutoCreateTimer.current);
    memoAutoCreateTimer.current = setTimeout(() => {
      void createMemo({ auto: true }).catch(() => undefined);
    }, 900);
    return () => {
      if (memoAutoCreateTimer.current) clearTimeout(memoAutoCreateTimer.current);
    };
  }, [memoTitle, memoText, memoContentJson, selectedMemoId, selectedWorkspace?.workspace_id, memoConflict]);

  useEffect(() => {
    if (!selectedMemoId || !selectedWorkspace || memoConflict) return;
    if (memoRemoteAutosaveTimer.current) clearTimeout(memoRemoteAutosaveTimer.current);
    memoRemoteAutosaveTimer.current = setTimeout(() => {
      void updateMemo({ silent: true }).catch(() => undefined);
    }, 1200);
    return () => {
      if (memoRemoteAutosaveTimer.current) clearTimeout(memoRemoteAutosaveTimer.current);
    };
  }, [memoTitle, memoText, memoContentJson, selectedMemoId, selectedWorkspace?.workspace_id, memoConflict]);

  const onMemoEditorChange = (json: string, plainText: string) => {
    setMemoContentJson(json);
    setMemoText(plainText);
  };

  return {
    tab,
    setTab,
    workspaces,
    teams,
    selectedWorkspace,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    teamWorkspaces,
    modeLabel,
    workspacePickerOpen,
    setWorkspacePickerOpen,
    teamCreateOpen,
    setTeamCreateOpen,
    teamCreateStep,
    setTeamCreateStep,
    teamName,
    setTeamName,
    teamDescription,
    setTeamDescription,
    creatingTeam,
    createdTeamId,
    tasks,
    memos,
    decoratedMemos,
    files,
    tags,
    notifications,
    unreadCount,
    showNotifications,
    setShowNotifications,
    offlineQueueCount,
    dashboardLoading,
    error,
    setError,
    calendarSelectedDate,
    setCalendarSelectedDate,
    activeScheduleId,
    setActiveScheduleId,
    tasksByDate,
    taskTitle,
    setTaskTitle,
    taskContentJson,
    setTaskContentJson,
    taskRange,
    setTaskRange,
    memoTitle,
    setMemoTitle,
    memoText,
    setMemoText,
    memoContentJson,
    onMemoEditorChange,
    memoSort,
    setMemoSort,
    memoFavoriteOnly,
    setMemoFavoriteOnly,
    memoIsSaving,
    selectedMemoId,
    memoConflict,
    memoSearch,
    setMemoSearch,
    memoFolderFilter,
    setMemoFolderFilter,
    loadWorkspaces,
    loadDashboard,
    flushPendingQueue,
    createTask,
    createMemo,
    updateMemo,
    toggleMemoFavorite,
    deleteMemo,
    selectMemoForEdit,
    clearMemoEditor,
    toggleMemoPinned,
    setMemoFolder,
    setMemoTags,
    updateTask,
    deleteTask,
    shiftTaskTime,
    resizeTaskDuration,
    createTeam,
    selectPlan,
    selectPersonal,
    selectTeamWorkspace,
  };
}
