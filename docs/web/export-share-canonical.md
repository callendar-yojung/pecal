# Export And Share Canonical UX

## Canonical flow
1. User opens task detail
2. User enters export/share management screen
3. User configures:
   - visibility (`public` or `restricted`)
   - expiration date
4. User generates or updates a share link
5. User explicitly copies or shares the generated link

## Rules
- Do not auto-share directly from task detail
- Do not bypass the export configuration screen
- A link with `410 Gone` should be treated as expired/revoked and never retried silently
- Web is the canonical source for wording, state labels, and link lifecycle behavior

## Client responsibilities
- Web:
  - show export status, expiration, revoke state, and copy/share actions
- Mobile:
  - route users into the same export configuration model before sharing
  - normalize any API-returned host to the canonical production host for external share links
- Desktop:
  - follow the same visibility and expiration vocabulary as web

## Expired link UX
- Public viewer shows a terminal expired message
- Clients redirect to home after the message
- Do not render stale task content once expiration is confirmed

## Copy
- Korean and English strings for export/share should stay aligned with web wording first
