'use strict';

// One-time, non-destructive userData migration when renaming from Messenger to
// GomTin (and Messenger Dev to GomTin Dev). Copies saved settings, account
// configurations and Chromium storage partitions into the new userData folder
// only if the new folder has not yet been initialized, skipping transient
// Chromium lock/socket files.

const fs = require('fs');
const path = require('path');

const MARKER = '.migrated-from-messenger';
const SKIP_BASENAMES = new Set([
  'SingletonLock',
  'SingletonSocket',
  'SingletonCookie',
  'RunningChromeVersion',
  'Crashpad',
  'lockfile',
  'LOCK',
]);

function shouldCopyEntry(srcPath) {
  const base = path.basename(srcPath);
  if (SKIP_BASENAMES.has(base) || base.startsWith('.org.chromium.')) return false;
  try {
    const st = fs.lstatSync(srcPath);
    if (st.isSocket() || st.isFIFO()) return false;
  } catch {
    return false;
  }
  return true;
}

function hasData(dir) {
  return fs.existsSync(path.join(dir, 'settings.json'))
    || fs.existsSync(path.join(dir, 'Partitions'))
    || fs.existsSync(path.join(dir, 'prefs.json'));
}

function migrateLegacyUserData(appDataDir, legacyName, nextName) {
  if (!appDataDir || !legacyName || !nextName || legacyName === nextName) return false;
  const legacyDir = path.join(appDataDir, legacyName);
  const targetDir = path.join(appDataDir, nextName);
  const markerPath = path.join(targetDir, MARKER);

  if (!fs.existsSync(legacyDir) || !hasData(legacyDir)) return false;
  if (fs.existsSync(markerPath) || hasData(targetDir)) return false;

  try {
    fs.mkdirSync(targetDir, { recursive: true });
    fs.cpSync(legacyDir, targetDir, {
      recursive: true,
      force: false,
      errorOnExist: false,
      filter: shouldCopyEntry,
    });
    fs.writeFileSync(markerPath, `migrated=${legacyName}\n`, { mode: 0o600 });
    return true;
  } catch {
    return false;
  }
}

module.exports = { migrateLegacyUserData, MARKER };
