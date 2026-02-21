# Pecal App TODO

## Phase 1: Setup
- [x] Design plan (design.md)
- [x] Theme colors (indigo brand)
- [x] App logo generation
- [x] Icon mappings (icon-symbol.tsx)

## Phase 2: Data & State
- [x] Data models (Schedule, Memo, File, Notification, Workspace, Tag)
- [x] AppContext (useReducer) with AsyncStorage persistence
- [x] Auth context (mock OAuth login)
- [x] Sample/seed data

## Phase 3: Navigation & Layout
- [x] Login screen (Kakao/Google/Guest buttons)
- [x] Root layout with auth guard
- [x] 5-tab navigation (개요/일정/캘린더/메모/파일)
- [x] Main header (logo + workspace selector + notification bell)
- [x] Workspace selector dropdown
- [x] Notification panel (slide-down)

## Phase 4: Overview & Schedule
- [x] Overview screen (4 count cards + recent activity)
- [x] Schedule list screen
- [x] Schedule create form
- [x] Schedule detail/edit bottom sheet
- [x] Schedule status (TODO/IN_PROGRESS/DONE)
- [x] Schedule color picker
- [x] Tag create/edit/delete
- [x] Tag filter chips

## Phase 5: Calendar & Memo
- [x] Calendar month view (42-cell grid)
- [x] Calendar month navigation
- [x] Calendar date tap → Schedule tab
- [x] Memo list screen
- [x] Memo search
- [x] Memo sort (latest/oldest/title/favorites)
- [x] Memo create/edit bottom sheet
- [x] Memo favorite toggle
- [x] Memo delete

## Phase 6: Files, Team, Notifications
- [x] File list screen
- [x] File type filter (All/Image/Document/Other)
- [x] File selection mode (long press)
- [x] File select all
- [x] File bulk download
- [x] File bulk delete
- [x] Team create modal (name/description → plan selection)
- [x] Notification panel (read/unread, mark all read)

## Phase 7: Polish
- [x] App logo applied to all icon locations
- [x] app.config.ts branding updated
- [x] All tab icons mapped
- [x] Haptic feedback on primary actions
- [x] Empty states for all lists
- [x] Unit tests (15 passing)
- [x] Final build check (TypeScript: 0 errors)
