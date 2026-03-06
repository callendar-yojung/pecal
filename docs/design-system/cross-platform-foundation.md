# Cross-Platform Design Foundation

## Scope
- Web: Next.js + Tailwind
- Mobile: React Native style objects
- Desktop: React + Tailwind inside Tauri shell

## Shared design targets
- Header/back navigation structure should read as the same product family
- Card, input, and status chip hierarchy should be visually compatible across platforms
- Dark mode tokens should map to the same semantic roles everywhere

## Semantic token model
- Background:
  - `bg.base`
  - `bg.surface`
  - `bg.elevated`
- Text:
  - `text.primary`
  - `text.secondary`
  - `text.subtle`
  - `text.inverse`
- Border:
  - `border.default`
  - `border.strong`
  - `border.accent`
- State:
  - `state.todo`
  - `state.inProgress`
  - `state.done`
  - `state.warning`
  - `state.danger`

## Immediate implementation priorities
- Extract the current mobile/web/desktop back button patterns into one documented pattern
- Standardize status chip sizing and spacing
- Align card corner radius and border opacity by semantic tier
- Audit long i18n strings in Korean and English on narrow widths

## Asset management
- Keep OG, favicon, app icon, desktop icon, and store icons under a single managed source folder before platform export
- Generated platform-specific derivatives should remain separate from the source artwork

## Follow-up work
- Introduce a shared token map document that links Tailwind classes and React Native color constants
- Add screenshot-based regression checks for:
  - settings header
  - task detail
  - memo detail
  - export/share screens
