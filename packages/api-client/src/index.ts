export type RequestInitLike = {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
};

export type HttpClient = <T>(path: string, init?: RequestInitLike) => Promise<T>;

export function createHttpClient(baseUrl: string): HttpClient {
  return async function request<T>(path: string, init?: RequestInitLike): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      },
      body: init?.body ?? null
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  };
}
