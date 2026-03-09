# iOS EAS migration

## Goal

Move iOS release builds from GitHub Actions + fastlane match to EAS Build and EAS Submit.

## Required secrets

- `EXPO_TOKEN`

## One-time setup

1. `cd /Users/jangsajang/WebstormProjects/pecal/apps/mobile`
2. `pnpm dlx eas-cli login`
3. `pnpm dlx eas-cli project:info`
4. `pnpm dlx eas-cli credentials`
5. Ensure iOS credentials exist for:
   - `com.pecal.mobile`
   - `com.pecal.mobile.PecalWidgetExtension`
6. In Apple Developer, keep these capabilities enabled:
   - App Groups
   - Push Notifications
   - Sign in with Apple
7. Confirm App Group `group.site.pecal.app` is attached to app and widget.

## Build commands

```bash
cd /Users/jangsajang/WebstormProjects/pecal/apps/mobile
pnpm dlx eas-cli build --platform ios --profile production
pnpm dlx eas-cli submit --platform ios --profile production
```

## GitHub Actions

The workflow at `/Users/jangsajang/WebstormProjects/pecal/.github/workflows/ios-deploy.yml` now:

- installs JS deps
- runs `eas build --platform ios --profile production --wait`
- runs `eas submit --platform ios --profile production`

## Notes

- Native iOS files under `/Users/jangsajang/WebstormProjects/pecal/apps/mobile/ios` remain source-controlled.
- EAS reduces manual keychain/profile handling, but Apple capabilities still must remain correct in Apple Developer.
