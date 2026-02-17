import type { UploadApi, UploadInput, UploadResult } from "./types";

export type UploadClientOptions = {
  endpoint: string;
  fetchImpl?: typeof fetch;
  getAuthToken?: () => string | null;
};

export function createUploadApi(options: UploadClientOptions): UploadApi {
  const fetchFn = options.fetchImpl ?? fetch;

  return {
    async upload(input: UploadInput): Promise<UploadResult> {
      const formData = new FormData();
      formData.append("file", input.data, input.filename);
      formData.append("contentType", input.contentType);

      const token = options.getAuthToken?.();
      const response = await fetchFn(options.endpoint, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as UploadResult;
    }
  };
}
