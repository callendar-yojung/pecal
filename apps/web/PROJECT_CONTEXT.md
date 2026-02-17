# Project Context (AI-Friendly)

## Purpose
A multi-workspace SaaS-style dashboard built with Next.js (App Router) that supports personal and team workspaces. Core features include tasks, calendar, memos (rich text), file attachments, tags, subscriptions/billing, and team/permission management.

## Tech Stack
- Frontend: Next.js App Router, React, Tailwind CSS
- Editor: Tiptap (shared rich text editor for memos and tasks)
- Backend: Next.js API routes (`src/app/api/...`)
- DB: MySQL (see `database_setup.sql` for schema)
- Auth: `getAuthUser` in `src/lib/auth-helper`
- Payments: NicePay + PayPal integrations (API routes exist under `src/app/api/nicepay`, `src/app/api/paypal`)

## High-Level Structure
- App routes live in `src/app/[locale]/...`
- API routes live in `src/app/api/...`
- Shared UI components in `src/components/...`
- Data access / queries in `src/lib/...`
- Translations in `messages/*.json`
- Access control helpers in `src/lib/access.ts`
- Export/share policy in `docs/export-policy.md`
- Manual migrations in `migrations/`

## Key Concepts
### Workspaces
- Two types: `personal` and `team`
- Workspace selection drives ownership for tasks, memos, files, tags, billing, etc.
- See `src/contexts/WorkspaceContext.tsx`

### Teams & Permissions
- Team membership, roles, and permissions exist (task-level permissions are enforced in API routes).
- Admin/owner has full permissions.

### Tasks
- CRUD via `src/app/api/tasks/route.ts` and `src/app/api/tasks/[id]/route.ts`
- Task detail pages:
  - View: `/dashboard/tasks/[id]`
  - Create: `/dashboard/tasks/new`
  - Edit: `/dashboard/tasks/[id]/edit`
- Statuses: `TODO`, `IN_PROGRESS`, `DONE`
- Supports tags, color, rich text content, file attachments.

### Memos
- Rich text content stored as JSON.
- List with paging/search/sort/favorites.
- Routes: `/dashboard/memo`

### Files & Attachments
- File upload API: `src/app/api/files/upload/route.ts`
- Attachments can be linked to tasks.

### Exports / Sharing
- Export setup page: `/dashboard/tasks/[id]/export`
- Export view page: `/export/tasks/[token]`
- Access rules documented in `docs/export-policy.md`

### Tags
- Tags are scoped by `owner_type` + `owner_id`.
- API: `src/app/api/tags/route.ts`

### Billing / Subscriptions
- Subscription and payment APIs exist under:
  - `src/app/api/subscriptions`
  - `src/app/api/payments`
  - `src/app/api/nicepay`
  - `src/app/api/paypal`
- Billing UI lives under `/dashboard/settings/billing`.

## Key Directories
- `src/app/[locale]/dashboard/tasks` — task pages (view/create/edit)
- `src/app/[locale]/dashboard/memo` — memo page
- `src/app/[locale]/dashboard/calendar` — calendar UI
- `src/app/[locale]/dashboard/files` — file UI
- `src/app/[locale]/dashboard/teams` — team UI
- `src/app/[locale]/dashboard/settings` — settings and billing
- `src/components/editor` — shared Tiptap editor + toolbar
- `src/components/dashboard` — dashboard UI components
- `src/lib` — DB queries, permissions, helpers

## Shared Editor (Tiptap)
- Shared component: `src/components/editor/RichTextEditor.tsx`
- Toolbar: `src/components/editor/RichTextToolbar.tsx`
- Extensions include bold/italic/underline, text color, font size, headings, lists, blockquote, code block, etc.
- Content is stored as JSON (not HTML).

## Data Model (Summary)
Refer to `database_setup.sql` for full schema. Common tables include:
- `workspaces` (type, owner_id)
- `teams`, `team_members`, `roles`, `permissions` (team access control)
- `tasks`, `task_tags`, `tags` (task + tagging)
- `memos` (content_json, favorites, search)
- `files`, `task_attachments` (uploads + associations)
- `subscriptions`, `payments` (billing)

## Conventions
- Ownership always flows from workspace context:
  - `owner_type`: `personal` or `team`
  - `owner_id`: member_id or team_id
- API routes validate ownership and permissions before write operations.
- Prefer centralized access checks in `src/lib/access.ts`.

## Migrations
- Manual SQL migrations live in `migrations/`.
- Apply in order and record in `migrations/APPLIED.md`.

## If You’re Building a Similar App
Reuse these patterns:
- Workspace-driven ownership (single pattern for all entities)
- Rich text editor stored as JSON
- Task/page separation (view vs edit)
- Permission enforcement in API routes, not just UI

---

If you want this file customized (diagrams, specific flows, DB ERD, or endpoints list), say what level of detail you want.

## Recent Additions
- Profile images for members (stored as `members.profile_image_url`).
- User profile image upload/removal via account settings.
- User menu shows avatar when available; fallback to initials.
- Timezone settings: auto-detect, manual override, update to current location.
- Billing plans split into personal/team pages.
- Team selection for team plan changes on billing page.
- Memo loading state split to avoid infinite loading UX.
- Mini calendar shows task colors.

## Schema Note
If your DB predates profile images, add this column:

```sql
ALTER TABLE members
ADD COLUMN profile_image_url VARCHAR(500) NULL AFTER nickname;
```

## Nickname Policy
- Nicknames are unique (DB unique index).
- Auto-generated on signup based on locale (ko/en) from `NEXT_LOCALE`.
- Update checks for duplicates and returns 409 if taken.

### Migration SQL (nickname unique)
```sql
ALTER TABLE members
ADD UNIQUE KEY unique_nickname (nickname);
```
