## Project Overview

This project is a multi-workspace SaaS dashboard built with Next.js (App Router). It supports personal and team workspaces with tasks, calendar, rich-text memos, file attachments, tagging, and subscription/billing flows. It is designed to be a reusable foundation for similar productivity or collaboration apps.

### Key Features
- Workspace-based ownership (`personal` / `team`)
- Task management with status, tags, colors, attachments
- Calendar and task list views
- Rich-text editor (Tiptap) with JSON storage
- Memo system with search, sorting, favorites, paging
- Team management and permissions
- Billing & subscriptions (NicePay + PayPal integrations)

### Tech Stack
- Next.js App Router + React
- Tailwind CSS
- Tiptap (rich-text editor)
- MySQL (see `database_setup.sql`)
- API routes under `src/app/api/*`

### Architecture Overview
```mermaid
flowchart LR
  U[User] -->|Browser| FE[Next.js App Router UI]
  FE -->|Fetch/Mutate| API[Next.js API Routes]
  API --> DB[(MySQL)]
  API --> FS[File Storage]
  API --> PAY[Payments: NicePay / PayPal]
  FE --> I18N[Translations: messages/*.json]
  FE --> C[Shared Components + Editor]
  C --> Tiptap[Tiptap Extensions]
```

### Modules Overview
```mermaid
flowchart TB
  subgraph UI["UI (App Router)"]
    DASH["/dashboard/*"]
    MEMO["/dashboard/memo"]
    TASKS["/dashboard/tasks"]
    CAL["/dashboard/calendar"]
    FILES["/dashboard/files"]
    TEAMS["/dashboard/teams"]
    SETTINGS["/dashboard/settings"]
  end

  subgraph API["API Routes"]
    TASK_API["/api/tasks"]
    MEMO_API["/api/memos"]
    TAG_API["/api/tags"]
    FILE_API["/api/files"]
    TEAM_API["/api/teams"]
    SUB_API["/api/subscriptions"]
    PAY_API["/api/payments"]
    NICE["/api/nicepay/*"]
    PAYPAL["/api/paypal/*"]
  end

  subgraph CORE["Core Libraries"]
    AUTH["auth-helper"]
    WS["workspace"]
    TEAM_LIB["team + permissions"]
    TASK_LIB["task"]
    MEMO_LIB["memo"]
    TAG_LIB["tag"]
    FILE_LIB["file + storage"]
  end

  UI --> API
  API --> CORE
  CORE --> DB[(MySQL)]
  API --> FS[File Storage]
  API --> PAY[Payments Providers]
```

### Data Flow (Task Example)
```mermaid
sequenceDiagram
  participant U as User
  participant FE as UI (Tasks Page)
  participant API as /api/tasks
  participant DB as MySQL
  participant FS as File Storage

  U->>FE: Create Task (title/time/content/tags/files)
  FE->>API: POST /api/tasks
  API->>DB: Insert task + tags
  API->>FS: Attach uploaded files (optional)
  API-->>FE: { success, taskId }
  FE-->>U: Navigate to /dashboard/tasks/{id}
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/[locale]/page.tsx`. The page auto-updates as you edit the file.

### Useful Pointers
- Dashboard routes: `src/app/[locale]/dashboard/*`
- API routes: `src/app/api/*`
- Shared editor: `src/components/editor/*`
- Data access: `src/lib/*`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Recent Changes
- Member profile images (upload/remove) and avatar display in sidebar.
- Timezone settings now support auto-detect + manual override.
- Billing plans split into personal/team pages with team selection.
- Memo loading UX improved to avoid stuck loading state.
- Mini calendar shows task colors.

### Nicknames
- Nicknames are unique (DB constraint).
- Auto-generated on signup based on locale (`NEXT_LOCALE`).
- Updates reject duplicates with 409.
