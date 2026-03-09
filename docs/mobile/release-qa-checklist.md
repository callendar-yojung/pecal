# Mobile Release QA Checklist

## 1. Login device security
- Login on web, mobile, and desktop with the same account.
- Open each platform's `보안` screen.
- Confirm all active devices are listed with platform/browser labels.
- From one device, log out another device and confirm the removed device can no longer call authenticated APIs.
- Confirm iPhone/iPad device names are not shown as generic values like `Pecal`, `arm64`, or `unknown`.

## 2. Push reminder timing
- Create new schedules with reminders at `5`, `10`, and `30` minutes before start.
- Verify the saved `start_time` and `reminder_minutes` on the server match the local input.
- Confirm push arrives within expected minute range on a real device.

## 3. Widget validation
- Add small, medium, and large iOS widgets.
- Confirm task title font is fixed size and visually readable.
- Confirm dark mode follows system setting.
- Confirm widget data refreshes after schedule changes and workspace changes.
- Confirm lock screen widgets open the closest schedule when tapped.
- Confirm the accessory inline/rectangular widgets show the current nearest schedule, not a stale next-day item.

## 4. Task editor validation
- Create a schedule from mobile native editor.
- Edit the same schedule from mobile native editor.
- Delete a schedule from edit screen.
- Confirm detail screen, list screen, and calendar screen all reflect the update.
- Confirm task filters (`상태`, `정렬`, `태그`) open as bottom sheets and do not resize the task list.
- Confirm start/end date pickers are fully visible without clipping on small devices.
- Confirm reminder/status/all-day sections are visually separated and understandable.
- Confirm attachments can be added as image or file before save, and uploaded after save.
- Confirm upload limit warnings show current plan and size guidance before upload.

## 5. Memo validation
- Open memo list, edit an existing memo, and confirm autosave works.
- Confirm editor height expands with content.
- Confirm no separate memo detail route is required in the main flow.
- Confirm memo tab re-entry is faster than cold entry and does not remount the editor with a blank flash.

## 6. File preview validation
- Open an image attachment from task detail and confirm it stays inside the app.
- Open a PDF attachment and confirm inline preview works.
- Download a file and confirm native share sheet opens instead of Safari.
- Confirm file detail back action always returns to the file list tab.

## 7. Settings validation
- Confirm settings home is grouped into account, plan, and preferences sections.
- Confirm workspace menu clearly separates team list and workspace list.
- Confirm workspace creation is collapsed by default and expands only when requested.
- Confirm mobile `플랜` page shows current plan, usage, max file size, payment method, and payment history.

## 8. Android sanity
- Open memo, task list, task detail, settings, and files on Android.
- Confirm no iOS-only layout assumptions break the picker or attachment flows.
- Confirm file/image chooser works and upload limit errors are readable.

## 9. Store submission
- Verify account deletion entry point exists in-app.
- Verify support page URL and privacy/terms URLs are reachable.
- Verify camera/photo permissions appear only when attachment flow is used.
- Verify Sign in with Apple entitlement and provisioning profiles are aligned before iOS archive.
