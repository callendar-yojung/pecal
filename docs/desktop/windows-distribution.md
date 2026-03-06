# Windows Distribution

## Goals
- Keep Windows installer metadata consistent across `productName`, publisher, icons, and uploaded artifact names.
- Maintain a Microsoft Store compliant offline installer flow.
- Separate Store submission behavior from general distribution behavior.

## Source of truth
- Tauri config: `apps/desktop/src-tauri/tauri.conf.json`
- CI workflow: `.github/workflows/desktop-tauri-release.yml`
- Version sync script: `apps/desktop/scripts/update-version.mjs`

## Current policy
- `productName`: use the exact Store-facing product name from `tauri.conf.json`.
- `identifier`: keep stable; do not rename casually because updates depend on it.
- Windows installer mode: `bundle.windows.webviewInstallMode.type = offlineInstaller`
- Artifact upload name: `Pecal-Desktop-v{version}-windows.{ext}`

## Store build vs general build
- Store submission:
  - Prefer `msi`
  - Keep updater artifacts disabled
  - No install-time network download
- General distribution:
  - `nsis` may still be produced for direct distribution
  - Any updater behavior must happen after installation, never during installation

## Validation checklist
- Install from the generated file with network disabled
- Confirm Windows "Apps & features" shows the expected product name and publisher
- Confirm generated filename has no spaces
- Confirm the installer contains all required runtime assets

## Regression checks
- Login flow
- Memo list/detail selection consistency
- File download flow
- Offline installation on a clean Windows VM
