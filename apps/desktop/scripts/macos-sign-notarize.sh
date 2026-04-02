#!/usr/bin/env bash
set -euo pipefail

# Configurable variables (override via env when needed)
APP_ROOT="${APP_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
BUNDLE_DIR="${BUNDLE_DIR:-$APP_ROOT/src-tauri/target/release/bundle}"
DMG_PATH="${DMG_PATH:-}"
APP_PATH="${APP_PATH:-}"
APPLE_CERTIFICATE_IDENTITY="${APPLE_CERTIFICATE_IDENTITY:-Developer ID Application}"
APPLE_NOTARY_PROFILE="${APPLE_NOTARY_PROFILE:-tauri-notary}"
APPLE_ID="${APPLE_ID:-}"
APPLE_TEAM_ID="${APPLE_TEAM_ID:-}"
APPLE_APP_PASSWORD="${APPLE_APP_PASSWORD:-}"

if [[ -z "$DMG_PATH" ]]; then
  DMG_PATH="$(find "$BUNDLE_DIR" -type f -name "*.dmg" | head -n 1 || true)"
fi

if [[ -z "$APP_PATH" ]]; then
  APP_PATH="$(find "$BUNDLE_DIR" -type d -name "*.app" | head -n 1 || true)"
fi

if [[ -z "$DMG_PATH" || ! -f "$DMG_PATH" ]]; then
  echo "DMG not found. Set DMG_PATH or ensure tauri build produced *.dmg."
  exit 1
fi

if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "APP not found. Set APP_PATH or ensure tauri build produced *.app."
  exit 1
fi

echo "Using APP_PATH=$APP_PATH"
echo "Using DMG_PATH=$DMG_PATH"

if ! security find-identity -v -p codesigning | grep -q "$APPLE_CERTIFICATE_IDENTITY"; then
  echo "Signing identity not found in keychain: $APPLE_CERTIFICATE_IDENTITY"
  exit 1
fi

echo "Codesigning .app with identity: $APPLE_CERTIFICATE_IDENTITY"
codesign --force --sign "$APPLE_CERTIFICATE_IDENTITY" --options runtime --timestamp --deep "$APP_PATH"
codesign --verify --verbose=4 "$APP_PATH"

echo "Codesigning .dmg with identity: $APPLE_CERTIFICATE_IDENTITY"
codesign --force --sign "$APPLE_CERTIFICATE_IDENTITY" --timestamp "$DMG_PATH"
codesign --verify --verbose=4 "$DMG_PATH"

if [[ -n "$APPLE_ID" && -n "$APPLE_TEAM_ID" && -n "$APPLE_APP_PASSWORD" ]]; then
  echo "Storing notarytool profile: $APPLE_NOTARY_PROFILE"
  xcrun notarytool store-credentials "$APPLE_NOTARY_PROFILE" \
    --apple-id "$APPLE_ID" \
    --team-id "$APPLE_TEAM_ID" \
    --password "$APPLE_APP_PASSWORD"
fi

echo "Submitting DMG to notarization"
xcrun notarytool submit "$DMG_PATH" --keychain-profile "$APPLE_NOTARY_PROFILE" --wait

echo "Stapling DMG"
xcrun stapler staple "$DMG_PATH"
xcrun stapler validate "$DMG_PATH"

echo "Gatekeeper verification"
spctl -a -vvv -t install "$DMG_PATH"

echo "macOS sign + notarize + staple complete"
