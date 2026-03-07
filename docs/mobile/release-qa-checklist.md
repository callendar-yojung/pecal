# Mobile Release QA Checklist

## 1. Login device security
- Login on web, mobile, and desktop with the same account.
- Open each platform's `보안` screen.
- Confirm all active devices are listed with platform/browser labels.
- From one device, log out another device and confirm the removed device can no longer call authenticated APIs.

## 2. Push reminder timing
- Create new schedules with reminders at `5`, `10`, and `30` minutes before start.
- Verify the saved `start_time` and `reminder_minutes` on the server match the local input.
- Confirm push arrives within expected minute range on a real device.

## 3. Widget validation
- Add small, medium, and large iOS widgets.
- Confirm task title font is fixed size and visually readable.
- Confirm dark mode follows system setting.
- Confirm widget data refreshes after schedule changes and workspace changes.

## 4. Task editor validation
- Create a schedule from mobile native editor.
- Edit the same schedule from mobile native editor.
- Delete a schedule from edit screen.
- Confirm detail screen, list screen, and calendar screen all reflect the update.

## 5. Memo validation
- Open memo list, edit an existing memo, and confirm autosave works.
- Confirm editor height expands with content.
- Confirm no separate memo detail route is required in the main flow.
