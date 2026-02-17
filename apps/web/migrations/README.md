# Migrations

This project uses **manual SQL migrations**.

## Rules
- Add new migration files under `migrations/` with a clear timestamp prefix.
- Apply migrations **in order**.
- After applying, record it in `migrations/APPLIED.md`.

## Naming
`YYYYMMDD_description.sql`

Example:
`20260216_task_exports.sql`
