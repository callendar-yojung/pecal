import Redis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var __pecalRedisClient: Redis | undefined;
}

const CACHE_PREFIX = "pecal:v1";

function parseNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function resolveRedisUrl(): string | null {
  const url = process.env.REDIS_URL?.trim();
  if (url) return url;

  const host = process.env.REDIS_HOST?.trim();
  if (!host) return null;
  const port = parseNumber(process.env.REDIS_PORT, 6379);
  const password = process.env.REDIS_PASSWORD?.trim();
  const db = parseNumber(process.env.REDIS_DB, 0);
  const authPart = password ? `:${encodeURIComponent(password)}@` : "";
  return `redis://${authPart}${host}:${port}/${db}`;
}

function getRedis(): Redis | null {
  const redisUrl = resolveRedisUrl();
  if (!redisUrl) return null;

  if (!global.__pecalRedisClient) {
    global.__pecalRedisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
  }
  return global.__pecalRedisClient;
}

export function getRedisClient(): Redis | null {
  return getRedis();
}

function toKey(rawKey: string) {
  return `${CACHE_PREFIX}:${rawKey}`;
}

export function toRedisKey(rawKey: string) {
  return toKey(rawKey);
}

export function createCacheKey(...parts: Array<string | number | boolean | null | undefined>) {
  return parts
    .filter((part) => part !== undefined && part !== null && part !== "")
    .map((part) => String(part))
    .join(":");
}

export async function readThroughCache<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();
  if (!redis || ttlSeconds <= 0) return loader();

  const redisKey = toKey(key);

  try {
    const cached = await redis.get(redisKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (error) {
    console.warn("[redis-cache] cache read failed:", error);
  }

  const value = await loader();

  try {
    await redis.set(redisKey, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    console.warn("[redis-cache] cache write failed:", error);
  }

  return value;
}

export async function deleteCacheKey(key: string) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(toKey(key));
  } catch (error) {
    console.warn("[redis-cache] cache delete failed:", error);
  }
}

export async function deleteCacheByPattern(pattern: string) {
  const redis = getRedis();
  if (!redis) return;

  const fullPattern = toKey(pattern);
  let cursor = "0";

  try {
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        fullPattern,
        "COUNT",
        200,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch (error) {
    console.warn("[redis-cache] cache pattern delete failed:", error);
  }
}
