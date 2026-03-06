# Notifications And Exports

## Push token lifecycle
- Registration endpoint: `POST /api/me/push-tokens`
- Removal endpoint: `DELETE /api/me/push-tokens`
- Storage table: `member_push_tokens`

## Current token rules
- Tokens are stored per member and platform
- Supported platforms: `ios`, `android`
- Token re-registration updates `device_id`, `app_build`, and `last_seen_at`
- Invalid Expo tokens should be deactivated through `deactivatePushTokens`

## Operational gaps to close
- Add explicit stale token cleanup policy based on `last_seen_at`
- Define platform-specific error handling for invalid, expired, and rotated tokens
- Expose token counts and inactive ratios in an admin view

## Reminder cron visibility
- Cron route: `GET/POST /api/cron/task-reminders`
- Last run state is cached in Redis under `task:reminders:cron:last-run`

## Admin/dashboard requirements
- Show:
  - last cron run time
  - processed stream event count
  - sent notification count
  - last error message
- This should be surfaced in admin UI or operational logs, not only Redis

## Team schedule notification policy
- Current implementation sends reminders to members who have access to the task workspace
- Product policy should be fixed explicitly as one of:
  - creator only
  - all participants
  - all team members with workspace access
- Recommended current wording:
  - reminders are delivered to members who can access the task in the relevant workspace

## Export lifecycle
- Access guard lives in `apps/web/src/lib/access.ts`
- Expired or revoked links return `410 Gone`
- Mobile/web clients should treat `410` as terminal and redirect to home

## Missing follow-up
- Add batch cleanup for expired export records if retention cost matters
- Document retention period for revoked/expired exports
