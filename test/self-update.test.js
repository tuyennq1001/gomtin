'use strict';

// Tests for GomTin's Production-only SHA-256 updater and atomic self-update
// swap helper (including strict Dev lockout and macOS rollback safety).

const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  Updater, REPO, API_URL, RELEASES_URL, isNewer, parseRelease,
  releaseFileUrl, parseSums, allowedDownloadUrl,
} = require('../src/updater');
const { installInfo, MAC_HELPER, WIN_HELPER } = require('../src/self-update');

const yes = () => true;
const no = () => false;

test('updater: version comparison and release parsing strictly enforce tuyennq1001/gomtin', () => {
  assert.strictEqual(REPO, 'tuyennq1001/gomtin');
  assert.strictEqual(API_URL, 'https://api.github.com/repos/tuyennq1001/gomtin/releases/latest');
  assert.ok(isNewer('1.0.1', '1.0.0'));
  assert.ok(isNewer('v1.2.0', '1.1.9'));
  assert.ok(!isNewer('1.0.0', '1.0.0'));
  assert.ok(!isNewer('0.9.9', '1.0.0'));
  assert.ok(!isNewer('1.0.1-beta', '1.0.0'));

  assert.deepStrictEqual(
    parseRelease({ tag_name: 'v1.0.1', html_url: `${RELEASES_URL}tag/v1.0.1` }),
    { version: '1.0.1', url: `${RELEASES_URL}tag/v1.0.1` },
  );
  // Reject releases pointing to any other repo or non-semver tag.
  assert.strictEqual(parseRelease({ tag_name: 'v1.0.1', html_url: 'https://github.com/evil/gomtin/releases/tag/v1.0.1' }), null);
  assert.strictEqual(parseRelease({ tag_name: 'nightly', html_url: `${RELEASES_URL}tag/nightly` }), null);
});

test('updater: checksum parsing and HTTPS GitHub-only download host allowlist', () => {
  const sums = parseSums(`${'a'.repeat(64)}  GomTin-1.0.1-mac-arm64.zip\n${'b'.repeat(64)} *GomTin-1.0.1-win-x64.zip\r\njunk\n`);
  assert.deepStrictEqual(sums, {
    'GomTin-1.0.1-mac-arm64.zip': 'a'.repeat(64),
    'GomTin-1.0.1-win-x64.zip': 'b'.repeat(64),
  });
  assert.strictEqual(
    releaseFileUrl('1.0.1', 'SHA256SUMS.txt'),
    'https://github.com/tuyennq1001/gomtin/releases/download/v1.0.1/SHA256SUMS.txt',
  );
  assert.throws(() => releaseFileUrl('1.0.1', '../evil.zip'));
  assert.ok(allowedDownloadUrl('https://github.com/tuyennq1001/gomtin/releases/download/v1.0.1/SHA256SUMS.txt'));
  assert.ok(allowedDownloadUrl('https://objects.githubusercontent.com/some/path'));
  assert.ok(allowedDownloadUrl('https://release-assets.githubusercontent.com/some/path'));
  assert.ok(!allowedDownloadUrl('http://github.com/tuyennq1001/gomtin/releases/download/v1.0.1/SHA256SUMS.txt'));
  assert.ok(!allowedDownloadUrl('https://evil.example/GomTin.zip'));
});

test('updater: Dev builds hard-disable all update checks, toggles, and installs', async () => {
  const store = { autoCheckUpdates: true, lastUpdateCheck: 0 };
  const settings = { get: (k) => store[k], set: (k, v) => { store[k] = v; } };
  const u = new Updater({ settings, isDev: true, currentVersion: '1.0.0' });
  const st = u.getState();
  assert.strictEqual(st.disabledDev, true);
  assert.strictEqual(st.enabled, false);
  assert.strictEqual(st.status, 'disabled-dev');
  assert.strictEqual(st.canSelfUpdate, false);

  u.start();
  assert.strictEqual(u.timer, null);
  assert.deepStrictEqual(await u.check(), { ok: false, reason: 'dev' });
  assert.deepStrictEqual(u.setEnabled(true), { ok: false, reason: 'dev' });
  assert.deepStrictEqual(u.installNow(), { ok: false });
});

test('self-update: installInfo detects macOS ~/Applications, Homebrew, Windows and Linux', () => {
  const mac = installInfo({
    platform: 'darwin',
    arch: 'arm64',
    execPath: '/Users/me/Applications/GomTin.app/Contents/MacOS/GomTin',
    exists: no,
    writable: yes,
  });
  assert.strictEqual(mac.kind, 'mac');
  assert.strictEqual(mac.target, '/Users/me/Applications/GomTin.app');
  assert.strictEqual(mac.asset('1.0.1'), 'GomTin-1.0.1-mac-arm64.zip');

  assert.strictEqual(installInfo({
    platform: 'darwin',
    arch: 'arm64',
    execPath: '/Applications/GomTin.app/Contents/MacOS/GomTin',
    exists: (p) => p.includes('Caskroom/gomtin'),
    writable: yes,
  }).kind, 'brew');

  assert.strictEqual(installInfo({
    platform: 'darwin',
    arch: 'arm64',
    execPath: '/Applications/GomTin.app/Contents/MacOS/GomTin',
    isPackaged: false,
    exists: no,
    writable: yes,
  }).reason, 'not-packaged');

  assert.strictEqual(installInfo({
    platform: 'darwin',
    arch: 'arm64',
    execPath: '/Applications/GomTin.app/Contents/MacOS/GomTin',
    exists: no,
    writable: no,
  }).reason, 'not-writable');

  assert.strictEqual(installInfo({
    platform: 'linux',
    arch: 'x64',
    execPath: '/opt/GomTin/gomtin',
    env: {},
    writable: yes,
  }).reason, 'package-manager');
});

function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gomtin-helper-'));
  const work = path.join(root, 'work');
  fs.mkdirSync(work);
  return { root, work };
}

function fakeApp(ms) {
  const child = spawn(process.execPath, ['-e', `setTimeout(() => {}, ${ms})`], { stdio: 'ignore' });
  const exited = new Promise((r) => child.on('exit', () => r(Date.now())));
  return { pid: child.pid, exited };
}

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('exit', (status) => resolve({ status, stderr, at: Date.now() }));
  });
}

const posix = process.platform !== 'win32';

test('macOS swap helper: waits for app exit, replaces bundle atomically, cleans work dir', { skip: !posix }, async () => {
  const { root, work } = scratch();
  const target = path.join(root, 'GomTin.app');
  const source = path.join(work, 'GomTin.app');
  fs.mkdirSync(target); fs.writeFileSync(path.join(target, 'version'), 'old');
  fs.mkdirSync(source); fs.writeFileSync(path.join(source, 'version'), 'new');
  const script = path.join(root, 'update.sh');
  fs.writeFileSync(script, MAC_HELPER);
  const app = fakeApp(1200);
  const r = await run('/bin/sh', [script, String(app.pid), source, target, work, '0']);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(r.at >= await app.exited, 'swapped only after app exited');
  assert.strictEqual(fs.readFileSync(path.join(target, 'version'), 'utf8'), 'new');
  assert.ok(!fs.existsSync(`${target}.previous-version`));
  assert.ok(!fs.existsSync(work), 'work folder removed');
});

test('macOS swap helper: rolls back to old bundle if new bundle is missing', { skip: !posix }, async () => {
  const { root, work } = scratch();
  const target = path.join(root, 'GomTin.app');
  fs.mkdirSync(target); fs.writeFileSync(path.join(target, 'version'), 'old');
  const script = path.join(root, 'update.sh');
  fs.writeFileSync(script, MAC_HELPER);
  await run('/bin/sh', [script, '999999', path.join(work, 'missing.app'), target, work, '0']);
  assert.strictEqual(fs.readFileSync(path.join(target, 'version'), 'utf8'), 'old');
  assert.ok(!fs.existsSync(`${target}.previous-version`));
  assert.ok(WIN_HELPER.includes('GomTin.exe'));
});
