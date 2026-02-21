# Pecal App Design Plan

## Overview
Pecal is a personal/team workspace calendar app that manages schedules, memos, and files in one place.
Target: iOS-first, portrait orientation, one-handed usage.

---

## Color Palette
- **Primary**: #5B6CF6 (Indigo Blue — productivity, trust)
- **Primary Dark**: #4F46E5
- **Background**: #FFFFFF / #0F1117 (dark)
- **Surface**: #F8F9FF / #1A1D2E (dark)
- **Surface2**: #EEEFFE / #252840 (dark)
- **Foreground**: #1A1D2E / #F0F1FF (dark)
- **Muted**: #6B7280 / #9CA3AF (dark)
- **Border**: #E5E7F0 / #2D3148 (dark)
- **Success**: #10B981 / #34D399 (dark)
- **Warning**: #F59E0B / #FBBF24 (dark)
- **Error**: #EF4444 / #F87171 (dark)
- **Tag Colors**: Red, Orange, Yellow, Green, Blue, Purple, Pink

---

## Screen List

1. **Login Screen** — OAuth login (Kakao / Google)
2. **Main Layout** — Header + Workspace Selector + Notification Toggle + Bottom Tab Bar
3. **Overview Screen** — 4 count cards (Schedule / Memo / File / Notification)
4. **Schedule Screen** — Create form + List + Detail/Edit panel
5. **Calendar Screen** — Month view (42 cells), tap date → Schedule tab
6. **Memo Screen** — Create form + Search/Sort + Memo list + Edit panel
7. **File Screen** — Type filter + Select/Bulk actions + File list
8. **Team Create Modal** — Name/Description → Plan selection (Free/Pro)
9. **Notification Panel** — Slide-down from header toggle, read/unread

---

## Screen Details

### Login Screen
- Full-screen gradient background (indigo to purple)
- Pecal logo + tagline
- "카카오로 로그인" button (yellow, Kakao brand)
- "Google로 로그인" button (white, Google brand)
- Guest mode link (skip login)

### Main Layout
- **Header**: App logo left, workspace selector center (Personal/Team dropdown), notification bell right
- **Notification Panel**: Slides down from top, list of notifications with read/unread state, mark all read button
- **Bottom Tab Bar**: 5 tabs — 개요 / 일정 / 캘린더 / 메모 / 파일

### Overview Screen
- 4 count cards in 2×2 grid
  - Schedule count (indigo icon)
  - Memo count (green icon)
  - File count (orange icon)
  - Unread notification count (red icon)
- Recent activity list below cards
- Today's schedule preview

### Schedule Screen
- **Create Form** (top): Title input, date picker, status selector, color picker, tag selector
- **Filter Bar**: Tag filter chips, status filter
- **List**: Cards with color indicator, title, date, status badge, tags
- **Detail/Edit Panel**: Bottom sheet with full edit form, delete button

### Calendar Screen
- **Month Navigation**: Prev/Next arrows + Month/Year label
- **42-cell Grid**: Mon–Sun header, cells show day number + event dots
- **Selected Date**: Highlighted cell, shows schedule count badge
- Tap date → navigate to Schedule tab with date pre-filled

### Memo Screen
- **Search Bar**: Real-time search
- **Sort Controls**: Latest / Oldest / Title / Favorites
- **Create Button**: FAB (floating action button)
- **Memo List**: Cards with title, preview text, date, favorite star
- **Edit Panel**: Bottom sheet with full text editor, favorite toggle, delete

### File Screen
- **Type Filter**: All / Image / Document / Other (chip tabs)
- **Selection Mode**: Long press to enter, checkbox per item, select all
- **Bulk Actions Bar**: Download all / Delete selected
- **File List**: Icon + name + size + date, tap to preview

### Team Create Modal
- Step 1: Team name input + description
- Step 2: Plan selection (Free: 3 members, Pro: unlimited)
- Confirm button → creates workspace

---

## Key User Flows

1. **Login**: Login Screen → (OAuth) → Main App (Overview)
2. **Create Schedule**: Schedule Tab → tap "+" → fill form → save → list updates
3. **Calendar to Schedule**: Calendar Tab → tap date → Schedule Tab (date pre-filled)
4. **Create Memo**: Memo Tab → tap FAB → fill form → save → list updates
5. **Manage Files**: File Tab → long press → select → bulk delete/download
6. **Create Team**: Header workspace selector → "팀 만들기" → modal → plan select → confirm
7. **Notifications**: Header bell → panel slides down → tap to mark read

---

## Typography
- **Heading**: SF Pro Display / System Bold, 20-28px
- **Body**: SF Pro Text / System Regular, 14-16px
- **Caption**: SF Pro Text / System, 12px, muted color

## Component Patterns
- Cards: rounded-2xl, bg-surface, border border-border, shadow-sm
- Buttons: rounded-xl, height 48px, haptic feedback
- Inputs: rounded-xl, bg-surface, border border-border, height 44px
- Tags: rounded-full, small, colored background
- Status badges: rounded-full, colored (TODO=gray, IN_PROGRESS=blue, DONE=green)
- Bottom sheets: rounded-t-3xl, drag handle, backdrop blur
