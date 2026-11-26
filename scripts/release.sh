#!/usr/bin/env bash
# Zero-manual-touch release automation script for GomTin.
# Runs full Dev+Prod Parity Gate, builds signed macOS zip + SHA256SUMS.txt,
# tags git, pushes tag and creates a GitHub Release on tuyennq1001/gomtin.
#
# Usage:
#   ./scripts/release.sh <version> [--install]
# Example:
#   ./scripts/release.sh 1.0.0 --install

set -euo pipefail

VERSION="${1:-}"
INSTALL=0
if [ -z "$VERSION" ] || ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage: ./scripts/release.sh <major.minor.patch> [--install]" >&2
  exit 1
fi
shift
for arg in "$@"; do
  case "$arg" in
    --install) INSTALL=1 ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

say() { printf '\n\033[1m==>\033[0m %s\n' "$*"; }

PKG_VER="$(node -p "require('./package.json').version")"
if [ "$PKG_VER" != "$VERSION" ]; then
  say "Bumping package.json version $PKG_VER -> $VERSION"
  npm version "$VERSION" --no-git-tag-version
fi

say "1/4 Running full Dev/Prod Parity Gate & Smoke Tests"
./scripts/build-local.sh

ARCH="arm64"
[ "$(uname -m)" = "x86_64" ] && ARCH="x64"
PROD_APP="$ROOT/dist/mac-${ARCH}/GomTin.app"
[ -d "$PROD_APP" ] || { echo "Missing Production app: $PROD_APP" >&2; exit 1; }

say "2/4 Packaging signed archive & SHA256SUMS.txt"
REL_DIR="$ROOT/dist/release-v${VERSION}"
rm -rf "$REL_DIR"
mkdir -p "$REL_DIR"
ZIP_NAME="GomTin-${VERSION}-mac-${ARCH}.zip"
ZIP_PATH="$REL_DIR/$ZIP_NAME"

# Preserve macOS extended attributes, code signature & symlinks with ditto
/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$PROD_APP" "$ZIP_PATH"
(cd "$REL_DIR" && shasum -a 256 "$ZIP_NAME" > SHA256SUMS.txt && shasum -a 256 -c SHA256SUMS.txt)
cat "$REL_DIR/SHA256SUMS.txt"

say "3/4 Tagging & Publishing GitHub Release v${VERSION}"
TAG="v${VERSION}"
if ! git rev-parse "$TAG" >/dev/null 2>&1; then
  git tag -a "$TAG" -m "Release GomTin ${TAG}"
fi
git push origin "$TAG"

if gh release view "$TAG" >/dev/null 2>&1; then
  gh release upload "$TAG" "$ZIP_PATH" "$REL_DIR/SHA256SUMS.txt" --clobber
else
  gh release create "$TAG" "$ZIP_PATH" "$REL_DIR/SHA256SUMS.txt" \
    --title "GomTin ${TAG}" \
    --generate-notes
fi

if [ "$INSTALL" = "1" ]; then
  say "4/4 Installing Production GomTin.app to ~/Applications"
  ./scripts/build-local.sh --install
fi

say "Release ${TAG} published successfully!"
