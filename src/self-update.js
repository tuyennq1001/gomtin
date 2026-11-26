'use strict';

// Installs a downloaded, SHA-256 verified GomTin release over the running app.
// No network here: downloads happen strictly in updater.js. The new version is
// unpacked and verified (including macOS deep codesign check) while the app
// still runs; the swap is done atomically after exit with automatic rollback
// if replacement fails.

const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const APP_NAME = 'GomTin';

function isWritable(p) {
  try { fs.accessSync(p, fs.constants.W_OK); return true; } catch { return false; }
}

const manual = (reason) => ({ kind: 'manual', reason });

function installInfo({
  platform = process.platform,
  arch = process.arch,
  execPath = process.execPath,
  env = process.env,
  isPackaged = true,
  exists = fs.existsSync,
  writable = isWritable,
} = {}) {
  if (!isPackaged) return manual('not-packaged');
  const p = platform === 'win32' ? path.win32 : path.posix;

  if (platform === 'darwin') {
    const target = p.resolve(execPath, '..', '..', '..');
    if (!target.endsWith('.app')) return manual('unknown-layout');
    const brew = ['/opt/homebrew/Caskroom/gomtin', '/usr/local/Caskroom/gomtin'].some((c) => exists(c));
    if (brew && target === `/Applications/${APP_NAME}.app`) return { kind: 'brew' };
    if (!['arm64', 'x64'].includes(arch)) return manual('unsupported-arch');
    if (!writable(p.dirname(target)) || !writable(target)) return manual('not-writable');
    return { kind: 'mac', target, asset: (v) => `${APP_NAME}-${v}-mac-${arch}.zip` };
  }

  if (platform === 'win32') {
    const dir = p.dirname(execPath);
    if (!['arm64', 'x64'].includes(arch)) return manual('unsupported-arch');
    if (!writable(dir)) return manual('not-writable');
    if (exists(p.join(dir, `Uninstall ${APP_NAME}.exe`))) {
      return { kind: 'win-setup', target: dir, asset: (v) => `${APP_NAME}-${v}-win-${arch}-setup.exe` };
    }
    return { kind: 'win-zip', target: dir, asset: (v) => `${APP_NAME}-${v}-win-${arch}.zip` };
  }

  if (platform === 'linux') {
    const image = env.APPIMAGE;
    if (!image || arch !== 'x64') return manual('package-manager');
    if (!writable(path.dirname(image))) return manual('not-writable');
    return { kind: 'appimage', target: image, asset: (v) => `${APP_NAME}-${v}-linux-x64.AppImage` };
  }
  return manual('unsupported-platform');
}

function workDir(info) {
  const base = info.kind === 'appimage' ? path.dirname(info.target) : os.tmpdir();
  return fs.mkdtempSync(path.join(base, '.gomtin-update-'));
}

function prepare(info, file, dir) {
  if (info.kind === 'mac') {
    const extract = path.join(dir, 'extract');
    execFileSync('/usr/bin/ditto', ['-x', '-k', file, extract]);
    const appBundle = path.join(extract, `${APP_NAME}.app`);
    if (!fs.existsSync(appBundle)) throw new Error(`The download does not contain ${APP_NAME}.app`);
    execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', appBundle], { stdio: 'ignore' });
    try { execFileSync('/usr/bin/xattr', ['-dr', 'com.apple.quarantine', appBundle], { stdio: 'ignore' }); } catch { /* not set */ }
    return { ...info, dir, source: appBundle };
  }
  if (info.kind === 'win-zip') {
    const extract = path.join(dir, 'extract');
    fs.mkdirSync(extract);
    execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-xf', file, '-C', extract], { windowsHide: true });
    if (!fs.existsSync(path.join(extract, `${APP_NAME}.exe`))) throw new Error(`The download does not contain ${APP_NAME}.exe`);
    return { ...info, dir, source: extract };
  }
  if (info.kind === 'win-setup') return { ...info, dir, source: file };
  if (info.kind === 'appimage') {
    fs.chmodSync(file, 0o755);
    return { ...info, dir, source: file };
  }
  throw new Error('This install cannot update itself');
}

const MAC_HELPER = `#!/bin/sh
# GomTin updater: swap the app bundle once the old version has exited.
PID="$1"; NEW="$2"; APP="$3"; WORK="$4"; RELAUNCH="$5"
i=0; while kill -0 "$PID" 2>/dev/null && [ $i -lt 600 ]; do sleep 0.1; i=$((i+1)); done
sleep 1
OLD="$APP.previous-version"
rm -rf "$OLD"
if mv "$APP" "$OLD"; then
  if mv "$NEW" "$APP"; then
    rm -rf "$OLD"
    /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP" >/dev/null 2>&1 || true
  else
    mv "$OLD" "$APP"
  fi
fi
rm -rf "$WORK"
if [ "$RELAUNCH" = 1 ]; then open "$APP"; fi
`;

const WIN_HELPER = `# GomTin updater: replace the app once the old version has exited.
param([int]$AppPid, [string]$Kind, [string]$Source, [string]$Target, [string]$Work, [int]$Relaunch)
$ErrorActionPreference = 'Stop'
try { Wait-Process -Id $AppPid -Timeout 60 -ErrorAction SilentlyContinue } catch {}
Start-Sleep -Seconds 1
$exe = Join-Path $Target 'GomTin.exe'
try {
  if ($Kind -eq 'win-setup') {
    Start-Process -FilePath $Source -ArgumentList '/S' -Wait
  } else {
    $old = "$Target.previous-version"
    if (Test-Path $old) { Remove-Item -Recurse -Force $old }
    $moved = $false
    for ($i = 0; $i -lt 20 -and -not $moved; $i++) {
      try { Rename-Item -Path $Target -NewName (Split-Path $old -Leaf); $moved = $true } catch { Start-Sleep -Milliseconds 500 }
    }
    if ($moved) {
      try { Move-Item -Path $Source -Destination $Target; Remove-Item -Recurse -Force $old }
      catch { if (-not (Test-Path $exe)) { Rename-Item -Path $old -NewName (Split-Path $Target -Leaf) } }
    }
  }
} finally {
  Remove-Item -Recurse -Force $Work -ErrorAction SilentlyContinue
  if ($Relaunch -eq 1 -and (Test-Path $exe)) { Start-Process -FilePath $exe }
}
`;

function apply(prepared, { relaunch, relaunchApp }) {
  const { kind, source, target, dir } = prepared;
  if (kind === 'appimage') {
    fs.renameSync(source, target);
    fs.rmSync(dir, { recursive: true, force: true });
    if (relaunch) relaunchApp({ execPath: target, args: [] });
    return;
  }
  if (kind === 'mac') {
    const script = path.join(dir, 'update.sh');
    fs.writeFileSync(script, MAC_HELPER, { mode: 0o700 });
    spawn('/bin/sh', [script, String(process.pid), source, target, dir, relaunch ? '1' : '0'], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  if (kind === 'win-zip' || kind === 'win-setup') {
    const script = path.join(dir, 'update.ps1');
    fs.writeFileSync(script, WIN_HELPER);
    const ps = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    spawn(ps, [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', script,
      '-AppPid', String(process.pid), '-Kind', kind, '-Source', source, '-Target', target, '-Work', dir, '-Relaunch', relaunch ? '1' : '0',
    ], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    return;
  }
  throw new Error('This install cannot update itself');
}

module.exports = { APP_NAME, installInfo, workDir, prepare, apply, MAC_HELPER, WIN_HELPER };
