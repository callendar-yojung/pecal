import AsyncStorage from '@react-native-async-storage/async-storage';

type QueueType = 'create_task' | 'create_memo';

type RichDocNode = {
  type?: string;
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  attrs?: Record<string, unknown>;
  content?: RichDocNode[];
};

type QueueItemBase = {
  id: string;
  type: QueueType;
  workspaceId: number;
  createdAt: number;
  retryCount: number;
};

export type QueueTaskPayload = QueueItemBase & {
  type: 'create_task';
  payload: {
    title: string;
    start_time: string;
    end_time: string;
    content?: string | null;
    workspace_id: number;
    color: string;
    tag_ids: number[];
    status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  };
};

export type QueueMemoPayload = QueueItemBase & {
  type: 'create_memo';
  payload: {
    owner_type: 'personal' | 'team';
    owner_id: number;
    title: string;
    content: {
      type: 'doc';
      content: RichDocNode[];
    };
  };
};

export type QueuePayload = QueueTaskPayload | QueueMemoPayload;

const STORAGE_KEY = 'pecal_mobile_offline_queue_v1';

function makeId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function readQueue(): Promise<QueuePayload[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QueuePayload[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuePayload[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function enqueueTaskOffline(input: Omit<QueueTaskPayload, 'id' | 'createdAt' | 'retryCount' | 'type'>) {
  const current = await readQueue();
  current.push({
    id: makeId(),
    type: 'create_task',
    workspaceId: input.workspaceId,
    createdAt: Date.now(),
    retryCount: 0,
    payload: input.payload,
  });
  await writeQueue(current);
}

export async function enqueueMemoOffline(input: Omit<QueueMemoPayload, 'id' | 'createdAt' | 'retryCount' | 'type'>) {
  const current = await readQueue();
  current.push({
    id: makeId(),
    type: 'create_memo',
    workspaceId: input.workspaceId,
    createdAt: Date.now(),
    retryCount: 0,
    payload: input.payload,
  });
  await writeQueue(current);
}

export async function getOfflineQueueCount() {
  const current = await readQueue();
  return current.length;
}

export async function flushOfflineQueue(
  handlers: {
    onTask: (item: QueueTaskPayload) => Promise<void>;
    onMemo: (item: QueueMemoPayload) => Promise<void>;
  }
) {
  const current = await readQueue();
  if (!current.length) return { processed: 0, failed: 0, remaining: 0 };

  const remaining: QueuePayload[] = [];
  let processed = 0;
  let failed = 0;

  for (const item of current) {
    try {
      if (item.type === 'create_task') {
        await handlers.onTask(item);
      } else {
        await handlers.onMemo(item);
      }
      processed += 1;
    } catch {
      failed += 1;
      remaining.push({
        ...item,
        retryCount: item.retryCount + 1,
      });
    }
  }

  await writeQueue(remaining);
  return {
    processed,
    failed,
    remaining: remaining.length,
  };
}
