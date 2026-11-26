#!/usr/bin/env bash
# GomTin installer for macOS.
#
#   curl -fsSL https://raw.githubusercontent.com/tuyennq1001/gomtin/main/install.sh | bash
#
# Downloads the prebuilt app from the latest GitHub Release, verifies its
# SHA-256 against the release's SHA256SUMS.txt and macOS code signature, and
# installs it into ~/Applications. Re-run to update; your sessions are kept.
#
# Environment overrides:
#   GOMTIN_VERSION   install a specific tag, e.g. v1.0.0 (default: latest)
#   GOMTIN_DIR       install directory (default: ~/Applications)
#   GOMTIN_ZIP       install from a local zip instead of downloading (testing)
#   GOMTIN_NO_OPEN=1 do not launch the app after installing

set -euo pipefail

REPO="tuyennq1001/gomtin"
APP_NAME="GomTin"
LEGACY_NAME="Messenger"
TMP_DIR=""
# HTTPS only (including redirects), TLS 1.2+, fail on HTTP errors.
CURL_OPTS="--proto =https --proto-redir =https --tlsv1.2 -f"
# Global, not local: the EXIT trap runs after main() has returned.
trap 'if [ -n "${TMP_DIR:-}" ]; then rm -rf "$TMP_DIR"; fi' EXIT

main() {
  say() { printf '\033[1m==>\033[0m %s\n' "$*"; }
  die() { printf '\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }

  [ "$(uname -s)" = "Darwin" ] || die "This installer is for macOS only."

  local arch
  case "$(uname -m)" in
    arm64) arch="arm64" ;;
    x86_64)
      # An Apple Silicon Mac running this shell under Rosetta still wants arm64.
      if [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = "1" ]; then arch="arm64"; else arch="x64"; fi ;;
    *) die "Unsupported CPU architecture: $(uname -m)" ;;
  esac

  local dest="${GOMTIN_DIR:-$HOME/Applications}"
  TMP_DIR="$(mktemp -d)"
  local tmp="$TMP_DIR"

  local zip
  if [ -n "${GOMTIN_ZIP:-}" ]; then
    zip="$GOMTIN_ZIP"
    [ -f "$zip" ] || die "No such file: $zip"
    say "Installing from local file $zip (checksum not verified)"
  else
    local tag="${GOMTIN_VERSION:-}"
    if [ -z "$tag" ]; then
      # /releases/latest redirects to /releases/tag/<tag>; no API token needed.
      tag="$(curl $CURL_OPTS -sSLI -o /dev/null -w '%{url_effective}' "https://github.com/$REPO/releases/latest")"
      tag="${tag##*/}"
      case "$tag" in v*) ;; *) die "No release found for $REPO." ;; esac
    fi
    # The tag becomes part of a file path and URL; accept only vX.Y.Z.
    [[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "Invalid version tag: $tag"
    local asset="${APP_NAME}-${tag#v}-mac-${arch}.zip"
    local base="https://github.com/$REPO/releases/download/$tag"

    say "Downloading $APP_NAME $tag ($arch)"
    curl $CURL_OPTS -L --progress-bar -o "$tmp/$asset" "$base/$asset" \
      || die "Download failed: $base/$asset (if on Intel x64, build locally with ./scripts/build-local.sh --install)"
    curl $CURL_OPTS -sSL -o "$tmp/SHA256SUMS.txt" "$base/SHA256SUMS.txt" \
      || die "Could not download SHA256SUMS.txt"

    say "Verifying SHA-256"
    # Fixed-string match on the whole line: no regex surprises from dots in the name.
    awk -v a="$asset" '$2 == a || $2 == "*" a' "$tmp/SHA256SUMS.txt" > "$tmp/expected.txt"
    [ -s "$tmp/expected.txt" ] || die "$asset is not listed in SHA256SUMS.txt"
    (cd "$tmp" && shasum -a 256 -c expected.txt >/dev/null) \
      || die "Checksum mismatch: the download is corrupt or was tampered with."
    zip="$tmp/$asset"
  fi

  say "Extracting"
  ditto -x -k "$zip" "$tmp/extract"
  local app="$tmp/extract/$APP_NAME.app"
  [ -d "$app" ] || die "Archive does not contain $APP_NAME.app"
  codesign --verify --deep --strict "$app" 2>/dev/null || die "App signature is invalid."
  # Clear quarantine flag so macOS does not block a freshly downloaded archive.
  xattr -dr com.apple.quarantine "$app" 2>/dev/null || true

  if pgrep -f "$APP_NAME.app/Contents/MacOS/$APP_NAME" >/dev/null 2>&1; then
    say "Closing the running $APP_NAME"
    osascript -e "quit app \"$APP_NAME\"" >/dev/null 2>&1 || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      pgrep -f "$APP_NAME.app/Contents/MacOS/$APP_NAME" >/dev/null 2>&1 || break
      sleep 0.5
    done
  fi

  # Carry legacy Messenger userData over once if GomTin data folder is empty.
  local support="$HOME/Library/Application Support"
  if [ -d "$support/$LEGACY_NAME" ] && { [ ! -d "$support/$APP_NAME" ] || [ -z "$(ls -A "$support/$APP_NAME" 2>/dev/null)" ]; }; then
    rmdir "$support/$APP_NAME" 2>/dev/null || true
    mv "$support/$LEGACY_NAME" "$support/$APP_NAME"
  fi

  mkdir -p "$dest"
  rm -rf "$dest/$APP_NAME.app"
  ditto "$app" "$dest/$APP_NAME.app"
  /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$dest/$APP_NAME.app" >/dev/null 2>&1 || true
  say "Installed to $dest/$APP_NAME.app"

  if [ -z "${GOMTIN_NO_OPEN:-}" ]; then
    open "$dest/$APP_NAME.app"
  fi
}

main "$@"
