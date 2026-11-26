<p align="center">
  <img src="build/icon.png" width="128" height="128" alt="GomTin App Icon"/>
</p>

<h1 align="center">GomTin</h1>

<p align="center">
  <b>Distraction-free, privacy-first multi-account desktop chat hub for Messenger, Zalo &amp; Telegram on macOS</b>
</p>

---

## Features

- **Multi-Service & Multi-Account**: Run Facebook Messenger, Zalo Web, and Telegram Web side by side (up to 9 isolated accounts), switch instantly from the fixed `58px` sidebar or `⌘1…9`.
- **Save RAM without Logging Out**: Toggle any account **Off** in Settings to destroy its `WebContentsView` and free memory while keeping its encrypted session partition intact on disk.
- **Distraction-Free & Private**:
  - Blocks Facebook News Feed, Watch, Reels, Marketplace, and external link tracking shims.
  - Strict per-service isolation (`contextIsolation`, `sandbox`, no `executeJavaScript`, zero telemetry).
  - App password lock + Touch ID, privacy blur screen when unfocused, Do Not Disturb & weekly Focus schedule with automatic tab audio mute.
- **Soft Kawaii Glass UI** (matching [Buzzy](https://github.com/tuyennq1001/buzzy)):
  - Embedded single-window Settings (`Accounts`, `Focus`, `Appearance`).
  - **6 Pastel Themes** (Sky Blue, Mint Green, Strawberry Pink, Sunny Peach, Lavender Purple, Tomato Red), **System / Light / Dark** mode, and **Tiếng Việt / English**.
- **Safe Production Updates**:
  - Production builds check [GitHub Releases](https://github.com/tuyennq1001/gomtin/releases) periodically with zero cookies, verify **SHA-256 (`SHA256SUMS.txt`)** + macOS `codesign --verify --deep --strict`, and swap atomically with rollback.
  - Development builds (`GomTin Dev`) use an isolated `userData` directory, distinct orange `DEV` icon, and hard-disable all update checks.

## Local Development & Build

```bash
# Install dev dependencies
npm ci

# Run unit, route, privacy and self-update tests
npm test

# Run full Dev + Prod Parity Gate (tests, builds, signing, Fuses & smoke tests)
./scripts/build-local.sh

# Build, verify and install Production build to ~/Applications/GomTin.app
./scripts/build-local.sh --install
```

## Release Automation

```bash
./scripts/release.sh <version> [--install]
```

## License & Credits

Licensed under the [Apache-2.0 License](LICENSE). Built upon the privacy-focused architecture of [Thrum](https://github.com/thangldw/thrum) and styled in harmony with [Buzzy](https://github.com/tuyennq1001/buzzy).
