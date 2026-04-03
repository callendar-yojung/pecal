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
POLL_INTERVAL_SEC="${POLL_INTERVAL_SEC:-20}"
TIMEOUT_SEC="${TIMEOUT_SEC:-3600}"
NOTARY_RETRY_MAX="${NOTARY_RETRY_MAX:-5}"
NOTARY_RETRY_DELAY_SEC="${NOTARY_RETRY_DELAY_SEC:-15}"
RUNNER_TMP="${RUNNER_TEMP:-/tmp}"

is_transient_notary_error() {
  local error_text="$1"
  [[ "$error_text" == *"Code=-1009"* ]] ||
    [[ "$error_text" == *"The Internet connection appears to be offline."* ]] ||
    [[ "$error_text" == *"timed out"* ]] ||
    [[ "$error_text" == *"network connection was lost"* ]] ||
    [[ "$error_text" == *"Connection reset by peer"* ]] ||
    [[ "$error_text" == *"HTTPError(statusCode: nil"* ]]
}

run_notarytool_with_retries() {
  local description="$1"
  shift

  local attempt=1
  local output=""
  local exit_code=0
  while (( attempt <= NOTARY_RETRY_MAX )); do
    set +e
    output="$("$@" 2>&1)"
    exit_code=$?
    set -e

    if (( exit_code == 0 )); then
      printf '%s' "$output"
      return 0
    fi

    if is_transient_notary_error "$output"; then
      echo "$description transient network error (attempt ${attempt}/${NOTARY_RETRY_MAX}). Retrying in ${NOTARY_RETRY_DELAY_SEC}s..." >&2
      echo "$output" >&2
      sleep "$NOTARY_RETRY_DELAY_SEC"
      attempt=$((attempt + 1))
      continue
    fi

    echo "$output" >&2
    return "$exit_code"
  done

  echo "$description failed after ${NOTARY_RETRY_MAX} retries due to transient network errors." >&2
  echo "$output" >&2
  return 1
}

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

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for notarytool JSON parsing."
  exit 1
fi

if [[ "$APPLE_CERTIFICATE_IDENTITY" != Developer\ ID\ Application:* ]]; then
  echo "Invalid signing identity for external macOS distribution: $APPLE_CERTIFICATE_IDENTITY"
  echo "Use a Developer ID Application identity."
  exit 1
fi

if ! security find-identity -v -p codesigning | grep -q "$APPLE_CERTIFICATE_IDENTITY"; then
  echo "Signing identity not found in keychain: $APPLE_CERTIFICATE_IDENTITY"
  exit 1
fi

echo "Codesigning .app with identity: $APPLE_CERTIFICATE_IDENTITY"
codesign --force --sign "$APPLE_CERTIFICATE_IDENTITY" --options runtime --timestamp --deep "$APP_PATH"
codesign --verify --deep --strict --verbose=4 "$APP_PATH"

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
NOTARY_DMG="$RUNNER_TMP/notary-target.dmg"
cp -f "$DMG_PATH" "$NOTARY_DMG"

SUBMIT_JSON="$(run_notarytool_with_retries \
  "notary submit" \
  xcrun notarytool submit "$NOTARY_DMG" --keychain-profile "$APPLE_NOTARY_PROFILE" --output-format json)"
SUBMISSION_ID="$(echo "$SUBMIT_JSON" | jq -r '.id // empty')"
if [[ -z "$SUBMISSION_ID" ]]; then
  echo "Could not parse notary submission id."
  echo "$SUBMIT_JSON"
  exit 1
fi

echo "Submission ID: $SUBMISSION_ID"
START_TS="$(date +%s)"

while true; do
  INFO_JSON="$(run_notarytool_with_retries \
    "notary info" \
    xcrun notarytool info "$SUBMISSION_ID" --keychain-profile "$APPLE_NOTARY_PROFILE" --output-format json)" || {
    echo "Notary status check failed with non-transient error."
    exit 1
  }
  STATUS="$(echo "$INFO_JSON" | jq -r '.status // "Unknown"')"
  echo "Current status: $STATUS"

  case "$STATUS" in
    Accepted)
      break
      ;;
    Invalid|Rejected)
      echo "Notarization failed with status: $STATUS"
      run_notarytool_with_retries \
        "notary log" \
        xcrun notarytool log "$SUBMISSION_ID" --keychain-profile "$APPLE_NOTARY_PROFILE" --output-format json || true
      exit 1
      ;;
    "In Progress"|Submitted)
      ;;
    *)
      echo "Unexpected notarization status: $STATUS"
      ;;
  esac

  NOW_TS="$(date +%s)"
  ELAPSED=$((NOW_TS - START_TS))
  if (( ELAPSED > TIMEOUT_SEC )); then
    echo "Notarization timeout after ${TIMEOUT_SEC}s"
    run_notarytool_with_retries \
      "notary log" \
      xcrun notarytool log "$SUBMISSION_ID" --keychain-profile "$APPLE_NOTARY_PROFILE" --output-format json || true
    exit 1
  fi

  sleep "$POLL_INTERVAL_SEC"
done

echo "Stapling DMG"
xcrun stapler staple "$DMG_PATH"
xcrun stapler validate "$DMG_PATH"

echo "Gatekeeper verification"
spctl -a -vvv -t install "$DMG_PATH"

echo "macOS sign + notarize + staple complete"
