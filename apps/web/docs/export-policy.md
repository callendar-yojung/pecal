# Export & Share Policy

This document defines the rules for task exports and share links.

## Visibility Modes
- `public`: Anyone with the link can view the export (no login required).
- `restricted`: Only users explicitly added to the allowlist can view the export.

## Access Control
- Restricted exports require the viewer to be logged in.
- Access is determined by the allowlist stored in `task_export_access`.
- The export creator is always added to the allowlist on creation.

## Expiration & Revocation
- `expires_at` (optional): after this time, the link returns `410 Gone`.
- `revoked_at` (optional): if set, the link returns `410 Gone`.
- When revoked or expired, the export is considered inactive.

## Data Shown on Export Page
- Task title, status, schedule, content, tags, and attachments.
- Tags are resolved using the workspace `owner_type + owner_id`.
- Attachments are resolved through export-specific endpoints and apply the same access rules.

## Logging (Future)
- Access logging is not implemented yet.
- If needed, add a `task_export_logs` table to track views.

## Operational Notes
- Public exports should be used only when intended.
- Restricted exports should be used for internal sharing.
