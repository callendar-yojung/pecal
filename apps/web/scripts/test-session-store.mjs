import fs from "node:fs";
import path from "node:path";
import Redis from "ioredis";

function parseNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function loadEnvFile(filepath) {
  if (!fs.existsSync(filepath)) return {};
  const raw = fs.readFileSync(filepath, "utf8");
  const result = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }

  return result;
}

function resolveRedisUrl(env) {
  const url = env.REDIS_URL?.trim();
  if (url) return url;

  const host = env.REDIS_HOST?.trim();
  if (!host) return null;
  const port = parseNumber(env.REDIS_PORT, 6379);
  const password = env.REDIS_PASSWORD?.trim();
  const db = parseNumber(env.REDIS_DB, 0);
  const authPart = password ? `:${encodeURIComponent(password)}@` : "";
  return `redis://${authPart}${host}:${port}/${db}`;
}

async function main() {
  const cwd = process.cwd();
  const env = {
    ...loadEnvFile(path.join(cwd, ".env.local")),
    ...process.env,
  };

  const redisUrl = resolveRedisUrl(env);
  if (!redisUrl) {
    console.error("[session-store-test] Redis is not configured.");
    console.error(
      "[session-store-test] Set REDIS_URL or REDIS_HOST/REDIS_PORT in /apps/web/.env.local.",
    );
    process.exit(2);
  }

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  const probeKey = `pecal:v1:test:session-store:${Date.now()}`;
  const probeValue = JSON.stringify({
    ok: true,
    createdAt: new Date().toISOString(),
  });

  try {
    await redis.connect();
    await redis.set(probeKey, probeValue, "EX", 30);
    const stored = await redis.get(probeKey);
    await redis.del(probeKey);

    if (stored !== probeValue) {
      throw new Error("Probe value mismatch");
    }

    console.log("[session-store-test] Redis write/read/delete succeeded.");
    console.log(`[session-store-test] url=${redisUrl}`);
  } finally {
    redis.disconnect();
  }
}

main().catch((error) => {
  console.error("[session-store-test] Failed:", error);
  process.exit(1);
});
