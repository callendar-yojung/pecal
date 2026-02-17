# Monorepo Migration Guide (Safe & Incremental)

## Current layout

- `apps/web`: existing Next.js app (unchanged deployment shape)
- `apps/desktop`: existing Tauri + React app (including `src-tauri`, unchanged build shape)
- `packages/*`: shared packages introduced incrementally

## Phase 1 (completed)

- Workspace root created with pnpm
- Base TS path aliases added
- Shared package skeleton created:
  - `@repo/types`
  - `@repo/api-client`
  - `@repo/utils`
  - `@repo/ui`
  - `@repo/feature-upload`

## Phase 2 (recommended next)

1. Add `@repo/feature-upload` dependency to both apps.
2. Keep existing upload UI and file selection logic per app.
3. Replace only API upload call with `createUploadApi`.
4. Validate web and desktop upload flows independently.
5. Remove duplicate upload API code after both pass.

## Example integration (web)

```ts
import { createUploadApi } from "@repo/feature-upload";

const uploadApi = createUploadApi({
  endpoint: "/api/files/upload",
  getAuthToken: () => localStorage.getItem("token")
});

await uploadApi.upload({
  filename: file.name,
  contentType: file.type,
  data: file
});
```

## Example integration (desktop)

```ts
import { createUploadApi } from "@repo/feature-upload";

const uploadApi = createUploadApi({
  endpoint: `${import.meta.env.VITE_API_BASE_URL}/files/upload`,
  getAuthToken: () => localStorage.getItem("token")
});

await uploadApi.upload({
  filename: blobName,
  contentType: "application/octet-stream",
  data: blob
});
```
