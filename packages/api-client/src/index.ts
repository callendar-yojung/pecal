export type RequestInitLike = {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
};

export type HttpClient = <T>(path: string, init?: RequestInitLike) => Promise<T>;

export type ApiErrorCode =
  | "NETWORK_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "REQUEST_FAILED"
  | "SESSION_CONFLICT"
  | "REFRESH_EXPIRED";

export type ApiErrorSource = "web" | "desktop" | "mobile" | "shared";

export type ApiErrorParams = {
  message: string;
  status: number;
  code: ApiErrorCode;
  retryable: boolean;
  source: ApiErrorSource;
  details?: unknown;
};

export class ApiError extends Error {
  status: number;
  code: ApiErrorCode;
  retryable: boolean;
  source: ApiErrorSource;
  details?: unknown;

  constructor(params: ApiErrorParams) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.code = params.code;
    this.retryable = params.retryable;
    this.source = params.source;
    this.details = params.details;
  }
}

export function mapStatusToApiCode(status: number): ApiErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 422 || status === 400) return "VALIDATION_ERROR";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVER_ERROR";
  return "REQUEST_FAILED";
}

export function isRetryableStatus(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

export function toApiError(input: unknown, source: ApiErrorSource = "shared"): ApiError {
  if (input instanceof ApiError) return input;

  if (input instanceof Error) {
    return new ApiError({
      message: input.message || "Unknown error",
      status: 0,
      code: "NETWORK_ERROR",
      retryable: true,
      source,
      details: input,
    });
  }

  const text =
    typeof input === "string"
      ? input
      : (() => {
          try {
            return JSON.stringify(input);
          } catch {
            return "Unknown error";
          }
        })();

  return new ApiError({
    message: text,
    status: 0,
    code: "NETWORK_ERROR",
    retryable: true,
    source,
    details: input,
  });
}

type CoordinatorOptions = {
  cacheMs?: number;
  dedupe?: boolean;
  retries?: number;
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export function createRequestCoordinator() {
  const inflight = new Map<string, Promise<unknown>>();
  const cache = new Map<string, CacheEntry<unknown>>();

  const getCached = <T>(key: string): T | null => {
    const hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
      cache.delete(key);
      return null;
    }
    return hit.value as T;
  };

  const setCached = <T>(key: string, value: T, cacheMs: number) => {
    if (cacheMs <= 0) return;
    cache.set(key, { value, expiresAt: Date.now() + cacheMs });
  };

  const run = async <T>(
    key: string,
    task: () => Promise<T>,
    options: CoordinatorOptions = {}
  ): Promise<T> => {
    const cacheMs = options.cacheMs ?? 0;
    const dedupe = options.dedupe ?? true;
    const retries = options.retries ?? 0;

    if (cacheMs > 0) {
      const cached = getCached<T>(key);
      if (cached !== null) return cached;
    }

    if (dedupe) {
      const inProgress = inflight.get(key);
      if (inProgress) return inProgress as Promise<T>;
    }

    const worker = (async () => {
      let attempt = 0;
      while (true) {
        try {
          const value = await task();
          setCached(key, value, cacheMs);
          return value;
        } catch (error) {
          const normalized = toApiError(error);
          if (attempt >= retries || !normalized.retryable) {
            throw normalized;
          }
          attempt += 1;
        }
      }
    })();

    if (dedupe) inflight.set(key, worker);

    try {
      return await worker;
    } finally {
      if (dedupe) inflight.delete(key);
    }
  };

  const invalidate = (prefix?: string) => {
    if (!prefix) {
      cache.clear();
      return;
    }
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) cache.delete(key);
    }
  };

  return { run, invalidate };
}

export function createHttpClient(baseUrl: string): HttpClient {
  return async function request<T>(path: string, init?: RequestInitLike): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: init?.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
        body: init?.body ?? null,
      });
    } catch (error) {
      throw toApiError(error);
    }

    const raw = await response.text();
    let data: unknown = {};
    if (raw) {
      try {
        data = JSON.parse(raw) as unknown;
      } catch {
        data = { message: raw };
      }
    }

    if (!response.ok) {
      const message =
        (data as { error?: string; message?: string }).error ||
        (data as { error?: string; message?: string }).message ||
        `HTTP ${response.status} ${response.statusText}`;
      throw new ApiError({
        message,
        status: response.status,
        code: mapStatusToApiCode(response.status),
        retryable: isRetryableStatus(response.status),
        source: "shared",
        details: data,
      });
    }

    return data as T;
  };
}
