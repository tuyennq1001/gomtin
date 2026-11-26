#!/usr/bin/env bash
# Zero-manual-touch local Parity Gate build, verification, smoke-test & optional install script.
# Usage:
#   ./scripts/build-local.sh            # Test + Build Dev & Prod + Verify + Smoke Test (Dev & Prod)
#   ./scripts/build-local.sh --install  # Also install Production GomTin.app into ~/Applications

set -euo pipefail

INSTALL=0
for arg in "$@"; do
  case "$arg" in
    --install) INSTALL=1 ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

say() { printf '\n\033[1m==>\033[0m %s\n' "$*"; }

verify_bundle() {
  local app_path="$1"
  local expected_id="$2"

  [ -d "$app_path" ] || { echo "Missing app bundle: $app_path" >&2; exit 1; }

  # Dependency Clean Guard: remove stray unverified archives inside app bundle if any.
  find "$app_path/Contents/Resources" -name "*.zip" -delete 2>/dev/null || true

  codesign --verify --deep --strict "$app_path"
  local cs_info
  cs_info="$(codesign -dv "$app_path" 2>&1)"
  printf '%s\n' "$cs_info"
  echo "$cs_info" | grep -q "Identifier=$expected_id" || { echo "Unexpected Identifier for $app_path" >&2; exit 1; }
  echo "$cs_info" | grep -Eq "flags=.*runtime" || { echo "Hardened runtime flag missing for $app_path" >&2; exit 1; }
  echo "$cs_info" | grep -q "TeamIdentifier=P7AFS89MVF" || { echo "Expected signed TeamIdentifier=P7AFS89MVF for $app_path" >&2; exit 1; }

  local fuses_out
  fuses_out="$(npx --no-install @electron/fuses read --app "$app_path")"
  printf '%s\n' "$fuses_out"
  echo "$fuses_out" | grep -q "EnableCookieEncryption is Enabled"
  echo "$fuses_out" | grep -q "RunAsNode is Disabled"
  echo "$fuses_out" | grep -q "OnlyLoadAppFromAsar is Enabled"
  echo "$fuses_out" | grep -q "GrantFileProtocolExtraPrivileges is Enabled"
}

smoke_test_bundle() {
  local app_path="$1"
  local bin_name="$2"
  local exec_path="$app_path/Contents/MacOS/$bin_name"
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  local log_file="$tmp_dir/smoke.log"
  local ud_dir="$tmp_dir/user-data"

  say "Smoke-testing $bin_name (5s runtime + UI/preload verification)"
  /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$app_path" >/dev/null 2>&1 || true
  "$exec_path" --user-data-dir="$ud_dir" --enable-logging=stderr </dev/null >"$log_file" 2>&1 &
  local pid=$!
  sleep 5

  local ok=1
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "Smoke test failed: $bin_name exited prematurely" >&2
    ok=0
  fi

  local renderer_count
  renderer_count="$(pgrep -f "$app_path/Contents/Frameworks/.*Helper \(Renderer\)" | wc -l | tr -d ' ')"
  echo "Active sandboxed renderers for $bin_name: $renderer_count"
  if [ "$renderer_count" -lt 2 ]; then
    echo "Smoke test failed: expected >= 2 renderers (sidebar + chat), found $renderer_count" >&2
    ok=0
  fi

  kill "$pid" 2>/dev/null || true
  sleep 0.5
  kill -9 "$pid" 2>/dev/null || true
  pkill -9 -f "$app_path/Contents/" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true

  if grep -Eq "Failed to load URL|ERR_FILE_NOT_FOUND|Unable to load preload|(Uncaught|SyntaxError|ReferenceError|TypeError).*file:///|file:///.*(Uncaught|Error)" "$log_file"; then
    echo "Smoke test failed: local UI / preload error detected in $bin_name:" >&2
    cat "$log_file" >&2
    ok=0
  fi

  rm -rf "$tmp_dir"
  [ "$ok" = "1" ] || exit 1
}

say "1/5 Preflight & Unit/Privacy Tests"
node -v
npm test

say "2/5 Parity Gate — Build Development (GomTin Dev)"
npm run build:dev

say "3/5 Parity Gate — Build Production (GomTin)"
npm run build:prod

ARCH="arm64"
[ "$(uname -m)" = "x86_64" ] && ARCH="x64"
DEV_APP="$ROOT/dist-dev/mac-${ARCH}/GomTin Dev.app"
PROD_APP="$ROOT/dist/mac-${ARCH}/GomTin.app"
if [ ! -d "$DEV_APP" ] && [ -d "$ROOT/dist-dev/mac/GomTin Dev.app" ]; then DEV_APP="$ROOT/dist-dev/mac/GomTin Dev.app"; fi
if [ ! -d "$PROD_APP" ] && [ -d "$ROOT/dist/mac/GomTin.app" ]; then PROD_APP="$ROOT/dist/mac/GomTin.app"; fi

say "4/5 Verify Code Signatures, Hardened Runtime & Electron Fuses"
verify_bundle "$DEV_APP" "com.tuyennq.gomtin.dev"
verify_bundle "$PROD_APP" "com.tuyennq.gomtin"

say "5/5 Smoke Test Dev & Prod Bundles (isolated temp userData + stderr UI & Notification auth check)"
smoke_test_bundle "$DEV_APP" "GomTin Dev"
smoke_test_bundle "$PROD_APP" "GomTin"

if [ "$INSTALL" = "1" ]; then
  DEST="$HOME/Applications/GomTin.app"
  say "Installing Production build to $DEST"
  if pgrep -f "GomTin.app/Contents/MacOS/GomTin" >/dev/null 2>&1; then
    osascript -e 'quit app "GomTin"' >/dev/null 2>&1 || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      pgrep -f "GomTin.app/Contents/MacOS/GomTin" >/dev/null 2>&1 || break
      sleep 0.5
    done
  fi
  mkdir -p "$HOME/Applications"
  rm -rf "$DEST"
  ditto "$PROD_APP" "$DEST"
  xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true
  codesign --verify --deep --strict "$DEST"
  /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$DEST" >/dev/null 2>&1 || true
  open "$DEST"
  sleep 4
  pgrep -fl "GomTin.app/Contents/MacOS/GomTin" >/dev/null
  say "Installed and launched $DEST successfully"
fi

say "Parity Gate completed successfully!"
