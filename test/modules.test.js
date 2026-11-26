'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { sanitize, isChatPath, Settings } = require('../src/settings');
const { hashPassword, verifyPassword, Throttle } = require('../src/password');

// dnd.js does not require electron at runtime, keep stub helper minimal.
const { Dnd, nextMorning } = require('../src/dnd');

// ---- settings

test('settings: defaults for empty or garbage input', () => {
  for (const raw of [undefined, null, 42, 'x', [], {}]) {
    const s = sanitize(raw);
    assert.strictEqual(s.hideTopBar, true);
    assert.strictEqual(s.showSidebar, true);
    assert.strictEqual(s.muteAudioWhenPaused, true, 'DND audio mute defaults to on');
    assert.strictEqual(s.lockEnabled, false);
    assert.strictEqual(s.bounds, null);
  }
});

test('settings: unknown keys are dropped, wrong types fall back to defaults', () => {
  const s = sanitize({ webPreferences: { nodeIntegration: true }, preload: '/tmp/x.js', hideTopBar: 'no', dndUntil: -5, lockAfterMinutes: 7 });
  assert.ok(!('webPreferences' in s) && !('preload' in s));
  assert.strictEqual(s.hideTopBar, true);
  assert.strictEqual(s.dndUntil, 0);
  assert.strictEqual(s.lockAfterMinutes, 5);
});

test('settings: bounds only carry numeric geometry', () => {
  const s = sanitize({ bounds: { x: 10.4, y: 20, width: 900, height: 700, webPreferences: { sandbox: false } } });
  assert.deepStrictEqual(s.bounds, { x: 10, y: 20, width: 900, height: 700 });
  assert.strictEqual(sanitize({ bounds: { width: 50, height: 700 } }).bounds, null);
  assert.strictEqual(sanitize({ bounds: { width: 'big', height: 700 } }).bounds, null);
});

test('settings: lock hash fields must be well-formed hex', () => {
  assert.strictEqual(sanitize({ lockHash: 'nothex' }).lockHash, '');
  assert.strictEqual(sanitize({ lockSalt: 'a'.repeat(32) }).lockSalt, 'a'.repeat(32));
});

test('settings: last chat must be a conversation path', () => {
  assert.ok(isChatPath('/messages/t/1234567890'));
  assert.ok(isChatPath('/messages/e2ee/t/7034/'));
  for (const p of ['/messages/', '/profile.php', 'https://evil.example/messages/t/1', '/messages/t/../../x', '/messages/t/a b', '//evil.example/messages/t/1']) {
    assert.ok(!isChatPath(p), p);
  }
});

test('settings: persist, reload, migrate v0.1 files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-settings-'));
  fs.writeFileSync(path.join(dir, 'prefs.json'), JSON.stringify({ hideTopBar: false }));
  fs.writeFileSync(path.join(dir, 'window-state.json'), JSON.stringify({ x: 5, y: 6, width: 1000, height: 800 }));
  const a = new Settings(dir);
  assert.strictEqual(a.get('hideTopBar'), false);
  assert.deepStrictEqual(a.get('bounds'), { x: 5, y: 6, width: 1000, height: 800 });
  a.set('dndUntil', -1);
  const b = new Settings(dir);
  assert.strictEqual(b.get('dndUntil'), -1);
  assert.throws(() => b.set('nope', 1));
  assert.throws(() => b.set('lockAfterMinutes', 7));
  if (process.platform !== 'win32') assert.strictEqual(fs.statSync(path.join(dir, 'settings.json')).mode & 0o777, 0o600);
});

// ---- password

test('password: hash verifies, wrong password does not, hash is salted', () => {
  const a = hashPassword('correct horse');
  const b = hashPassword('correct horse');
  assert.notStrictEqual(a.hash, b.hash, 'same password must hash differently (salt)');
  assert.ok(verifyPassword('correct horse', a.salt, a.hash));
  assert.ok(!verifyPassword('correct horsE', a.salt, a.hash));
  assert.ok(!verifyPassword('', a.salt, a.hash));
  assert.ok(!verifyPassword('x', '', ''));
  assert.match(a.hash, /^[0-9a-f]{128}$/);
  assert.match(a.salt, /^[0-9a-f]{32}$/);
});

test('password: too short or too long is rejected', () => {
  assert.throws(() => hashPassword('abc'));
  assert.throws(() => hashPassword('abcde'));
  assert.doesNotThrow(() => hashPassword('abcdef'));
  assert.throws(() => hashPassword('x'.repeat(257)));
});

test('password: throttle after 5 failures, growing, reset on success', () => {
  let now = 0;
  const t = new Throttle(() => now);
  for (let i = 0; i < 4; i += 1) t.fail();
  assert.strictEqual(t.waitMs(), 0);
  t.fail();
  assert.strictEqual(t.waitMs(), 30000);
  t.fail();
  assert.strictEqual(t.waitMs(), 60000);
  now += 60000;
  assert.strictEqual(t.waitMs(), 0);
  t.succeed();
  t.fail();
  assert.strictEqual(t.waitMs(), 0);
});

test('password: an existing shorter password (old 4-character minimum) still verifies', () => {
  const crypto = require('crypto');
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync('abcd', salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  assert.ok(verifyPassword('abcd', salt.toString('hex'), hash.toString('hex')));
});

test('password: throttle state survives a restart through its store, capped after a clock change', () => {
  let now = 0;
  let saved = { failures: 0, blockedUntil: 0 };
  const store = { load: () => saved, save: (s) => { saved = s; } };
  const t = new Throttle(() => now, store);
  for (let i = 0; i < 5; i += 1) t.fail();
  assert.deepStrictEqual(saved, { failures: 5, blockedUntil: 30000 });
  const restarted = new Throttle(() => now, store);
  assert.strictEqual(restarted.waitMs(), 30000);
  restarted.fail();
  assert.strictEqual(restarted.waitMs(), 60000);
  now = -1e9; // clock moved far back
  assert.strictEqual(restarted.waitMs(), 300000);
  restarted.succeed();
  assert.deepStrictEqual(saved, { failures: 0, blockedUntil: 0 });
});

// ---- do not disturb

function memSettings(init = {}) {
  const v = { dndUntil: 0, focusEnabled: false, focusRules: [], focusOverrideUntil: 0, ...init };
  return { get: (k) => v[k], set: (k, x) => { v[k] = x; } };
}

test('dnd: pause for a duration, indefinitely, resume', () => {
  let now = 1_000_000;
  const changes = [];
  const d = new Dnd({ settings: memSettings(), onChange: () => changes.push(1), now: () => now });
  assert.ok(!d.isPaused());
  d.pauseFor(3600000);
  assert.ok(d.isPaused());
  now += 3600001;
  assert.ok(!d.isPaused(), 'timed pause ends by itself');
  d.pauseIndefinitely();
  assert.ok(d.isPaused());
  d.resume();
  assert.ok(!d.isPaused());
  assert.ok(changes.length >= 3);
  clearTimeout(d.timer); clearInterval(d.ticker);
});

test('dnd: next morning is 08:00 local, today or tomorrow', () => {
  const early = new Date(2026, 10, 24, 6, 0);
  const late = new Date(2026, 10, 24, 22, 0);
  assert.strictEqual(new Date(nextMorning(early)).getDate(), 24);
  assert.strictEqual(new Date(nextMorning(late)).getDate(), 25);
  assert.strictEqual(new Date(nextMorning(late)).getHours(), 8);
});

// ---- focus schedule

const { focusEnd, normalizeRules } = require('../src/focus');

test('focus: weekday office hours', () => {
  const rules = [{ days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' }];
  const mon = (h, m = 0) => new Date(2026, 10, 23, h, m); // Mon 23 Nov 2026
  assert.strictEqual(focusEnd(rules, mon(8, 59)), null);
  assert.strictEqual(focusEnd(rules, mon(9, 0)), new Date(2026, 10, 23, 18, 0).getTime());
  assert.strictEqual(focusEnd(rules, mon(17, 59)), new Date(2026, 10, 23, 18, 0).getTime());
  assert.strictEqual(focusEnd(rules, mon(18, 0)), null, 'end time is exclusive');
  assert.strictEqual(focusEnd(rules, new Date(2026, 10, 22, 10, 0)), null, 'Sunday is off');
});

test('focus: overnight range belongs to the day it starts', () => {
  const rules = [{ days: [5], start: '22:00', end: '07:00' }]; // Friday night
  assert.strictEqual(focusEnd(rules, new Date(2026, 10, 27, 23, 0)), new Date(2026, 10, 28, 7, 0).getTime());
  assert.strictEqual(focusEnd(rules, new Date(2026, 10, 28, 6, 59)), new Date(2026, 10, 28, 7, 0).getTime(), 'Saturday morning');
  assert.strictEqual(focusEnd(rules, new Date(2026, 10, 28, 7, 0)), null);
  assert.strictEqual(focusEnd(rules, new Date(2026, 10, 27, 6, 0)), null, 'Friday morning belongs to Thursday');
});

test('focus: overlapping ranges extend to the latest end', () => {
  const rules = [{ days: [1], start: '09:00', end: '12:00' }, { days: [1], start: '11:00', end: '14:00' }];
  assert.strictEqual(focusEnd(rules, new Date(2026, 10, 23, 11, 30)), new Date(2026, 10, 23, 14, 0).getTime());
});

test('focus: rules are validated', () => {
  assert.deepStrictEqual(normalizeRules([{ days: [5, 1, 1], start: '09:00', end: '17:30' }]), [{ days: [1, 5], start: '09:00', end: '17:30' }]);
  for (const bad of [[{ days: [], start: '09:00', end: '10:00' }], [{ days: [1], start: '9:00', end: '10:00' }], [{ days: [1], start: '10:00', end: '10:00' }], [{ days: [7], start: '09:00', end: '10:00' }], 'x', [null]]) {
    assert.strictEqual(normalizeRules(bad), null, JSON.stringify(bad));
  }
  assert.strictEqual(normalizeRules(Array(20).fill({ days: [1], start: '09:00', end: '10:00' })).length, 10);
});

test('dnd: focus schedule pauses; resume lasts until the period ends; manual pause wins', () => {
  let now = new Date(2026, 10, 23, 10, 0).getTime(); // Monday 10:00
  const s = memSettings({ focusEnabled: true, focusRules: [{ days: [1], start: '09:00', end: '18:00' }], focusOverrideUntil: 0 });
  const d = new Dnd({ settings: s, onChange: () => {}, now: () => now });
  assert.ok(d.isPaused(), 'in focus period');
  assert.match(d.label(), /^Focus time until/);
  d.resume();
  assert.ok(!d.isPaused(), 'resumed for the rest of the period');
  d.pauseFor(HOUR_MS);
  assert.ok(d.isPaused(), 'manual pause still applies');
  d.resume();
  now = new Date(2026, 10, 24, 10, 0).getTime(); // Tuesday: rule is Monday only
  assert.ok(!d.isPaused());
  now = new Date(2026, 10, 30, 10, 0).getTime(); // next Monday: override has expired
  assert.ok(d.isPaused(), 'next period pauses again');
  s.set('focusEnabled', false);
  assert.ok(!d.isPaused());
  clearInterval(d.ticker); clearTimeout(d.timer);
});
const HOUR_MS = 3600000;

// ---- accounts in settings

test('settings: accounts are validated (multi-service + enabled) and active account prefers enabled', () => {
  const s = sanitize({
    accounts: [
      { id: 'default', name: ' Personal‮ ' }, // legacy shape without service/enabled
      { id: 'z1', name: 'Zalo Work', service: 'zalo', enabled: true },
      { id: 't1', name: 'Telegram', service: 'telegram', enabled: false },
    ],
    activeAccount: 'zz99',
    lastChats: { default: '/messages/t/1', z1: 'https://evil.example', ghost: '/messages/t/2' },
  });
  assert.deepStrictEqual(s.accounts, [
    { id: 'default', name: 'Personal', service: 'messenger', enabled: true },
    { id: 'z1', name: 'Zalo Work', service: 'zalo', enabled: true },
    { id: 't1', name: 'Telegram', service: 'telegram', enabled: false },
  ]);
  assert.strictEqual(s.activeAccount, 'default', 'unknown active account falls back to first enabled');
  assert.deepStrictEqual(s.lastChats, { default: '/messages/t/1' });

  // Disabling the active account shifts activeAccount to the next enabled account.
  const shifted = sanitize({
    accounts: [
      { id: 'default', name: 'Messenger', service: 'messenger', enabled: false },
      { id: 'z1', name: 'Zalo', service: 'zalo', enabled: true },
    ],
    activeAccount: 'default',
  });
  assert.strictEqual(shifted.activeAccount, 'z1');

  // All accounts disabled is valid (renders empty state cleanly without crashing).
  const allOff = sanitize({
    accounts: [{ id: 'default', name: 'Messenger', service: 'messenger', enabled: false }],
    activeAccount: 'default',
  });
  assert.strictEqual(allOff.accounts[0].enabled, false);
  assert.strictEqual(allOff.activeAccount, 'default');

  for (const bad of [
    [],
    [{ id: 'A!', name: 'x' }],
    [{ id: 'a', name: '' }],
    [{ id: 'a', name: 'x', service: 'unknown' }],
    [{ id: 'a', name: 'x', enabled: 'yes' }],
    [{ id: 'a', name: 'x' }, { id: 'a', name: 'y' }],
    Array(10).fill(0).map((_, i) => ({ id: `a${i}`, name: 'x' })),
  ]) {
    assert.deepStrictEqual(
      sanitize({ accounts: bad }).accounts,
      [{ id: 'default', name: 'Messenger', service: 'messenger', enabled: true }],
      JSON.stringify(bad),
    );
  }
});

test('unread: parses Messenger, Zalo, Telegram titles (EN/VI/JA/bidi), favicons, and combines signals', () => {
  const { parseTitleUnread, hasUnreadFavicon, combineUnread } = require('../src/unread');
  assert.strictEqual(parseTitleUnread('(3) Messenger'), 3);
  assert.strictEqual(parseTitleUnread('(20+) Messenger | Facebook'), 20);
  assert.strictEqual(parseTitleUnread('\u200e(5) メッセンジャー | Facebook'), 5);
  assert.strictEqual(parseTitleUnread('（7）Messenger'), 7);
  assert.strictEqual(parseTitleUnread('(99+) Zalo'), 99);
  assert.strictEqual(parseTitleUnread('[4] Zalo - Tuyen'), 4);
  assert.strictEqual(parseTitleUnread('Zalo (6)'), 6);
  assert.strictEqual(parseTitleUnread('(12) Telegram'), 12);
  assert.strictEqual(parseTitleUnread('• (2) Telegram'), 2);
  assert.strictEqual(parseTitleUnread('Telegram'), 0);
  assert.strictEqual(parseTitleUnread('(99999) Flood'), 999);
  assert.strictEqual(hasUnreadFavicon(['https://web.telegram.org/a/favicon-unread.svg']), true);
  assert.strictEqual(hasUnreadFavicon(['https://web.telegram.org/a/favicon.svg']), false);
  assert.strictEqual(combineUnread({ dom: 4, title: 2, favicon: true }), 4);
  assert.strictEqual(combineUnread({ dom: 0, title: 3, favicon: false }), 3);
  assert.strictEqual(combineUnread({ dom: 0, title: 0, favicon: true }), -1);
  assert.strictEqual(combineUnread({ dom: -1, title: 0, favicon: false }), -1);
  assert.strictEqual(combineUnread({ dom: 0, title: 0, favicon: false }), 0);
});

test('settings: v0.2 single lastChat migrates to the default account', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-mig-'));
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ lastChat: '/messages/t/42' }));
  assert.deepStrictEqual(new Settings(dir).get('lastChats'), { default: '/messages/t/42' });
});

test('settings: themeColor, appearance and language validate with Buzzy defaults', () => {
  const d = sanitize({});
  assert.strictEqual(d.themeColor, 'blue');
  assert.strictEqual(d.appearance, 'system');
  assert.strictEqual(d.language, 'vi');

  const ok = sanitize({ themeColor: 'pink', appearance: 'light', language: 'en' });
  assert.strictEqual(ok.themeColor, 'pink');
  assert.strictEqual(ok.appearance, 'light');
  assert.strictEqual(ok.language, 'en');

  const bad = sanitize({ themeColor: 'neon', appearance: 'sepia', language: 'fr' });
  assert.strictEqual(bad.themeColor, 'blue');
  assert.strictEqual(bad.appearance, 'system');
  assert.strictEqual(bad.language, 'vi');
});

test('migrate: copies legacy Messenger userData once while skipping lock files', () => {
  const { migrateLegacyUserData, MARKER } = require('../src/migrate');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-mig-'));
  const legacy = path.join(root, 'Messenger');
  const next = path.join(root, 'GomTin');
  fs.mkdirSync(path.join(legacy, 'Partitions', 'messenger'), { recursive: true });
  fs.mkdirSync(path.join(legacy, 'Crashpad'), { recursive: true });
  fs.writeFileSync(path.join(legacy, 'settings.json'), JSON.stringify({ accounts: [{ id: 'z1', name: 'Zalo', service: 'zalo', enabled: true }] }));
  fs.writeFileSync(path.join(legacy, 'Partitions', 'messenger', 'session.dat'), 'ok');
  fs.writeFileSync(path.join(legacy, 'SingletonLock'), 'lock');
  fs.writeFileSync(path.join(legacy, 'Crashpad', 'dump.dmp'), 'crash');

  assert.strictEqual(migrateLegacyUserData(root, 'Messenger', 'GomTin'), true);
  assert.ok(fs.existsSync(path.join(next, 'settings.json')));
  assert.strictEqual(fs.readFileSync(path.join(next, 'Partitions', 'messenger', 'session.dat'), 'utf8'), 'ok');
  assert.ok(fs.existsSync(path.join(next, MARKER)));
  assert.ok(!fs.existsSync(path.join(next, 'SingletonLock')), 'transient lock files must be skipped');
  assert.ok(!fs.existsSync(path.join(next, 'Crashpad')), 'Crashpad directory must be skipped');

  // Running again is a no-op and never overwrites newer GomTin data.
  fs.writeFileSync(path.join(next, 'settings.json'), JSON.stringify({ themeColor: 'purple' }));
  assert.strictEqual(migrateLegacyUserData(root, 'Messenger', 'GomTin'), false);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(next, 'settings.json'), 'utf8')), { themeColor: 'purple' });
});

test('i18n: Vietnamese and English dictionaries stay in key parity and interpolate', () => {
  const { STRINGS, tr } = require('../src/ui/i18n');
  assert.deepStrictEqual(Object.keys(STRINGS.vi).sort(), Object.keys(STRINGS.en).sort());
  assert.strictEqual(tr('vi', 'settingsTitle', { app: 'GomTin' }), 'Cài đặt GomTin');
  assert.strictEqual(tr('en', 'settingsTitle', { app: 'GomTin' }), 'GomTin Settings');
  assert.strictEqual(tr('vi', 'dndPausedUntilResumed'), 'Đang tạm tắt thông báo');
});

test('ui scripts: i18n.js + page scripts load together without global identifier collisions', () => {
  const vm = require('node:vm');
  const uiDir = path.join(__dirname, '..', 'src', 'ui');
  const i18nSrc = fs.readFileSync(path.join(uiDir, 'i18n.js'), 'utf8');

  const makeEl = () => ({
    hidden: false,
    disabled: false,
    checked: false,
    value: '',
    textContent: '',
    placeholder: '',
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {},
    getAttribute: () => '',
    toggleAttribute() {},
    addEventListener() {},
    replaceChildren() {},
    appendChild() {},
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    focus() {},
    blur() {},
    select() {},
    content: { firstElementChild: { cloneNode: () => makeEl() } },
  });

  for (const script of ['sidebar.js', 'settings.js', 'overlay.js']) {
    const src = fs.readFileSync(path.join(uiDir, script), 'utf8');
    const noopApi = new Proxy({}, { get: (_t, prop) => (prop === 'getState' ? () => Promise.resolve(null) : () => {}) });
    const sandbox = {
      document: {
        documentElement: { dataset: {}, lang: 'vi' },
        title: '',
        activeElement: null,
        getElementById: () => makeEl(),
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => makeEl(),
      },
      navigator: { platform: 'MacIntel' },
      addEventListener() {},
      setTimeout,
      clearTimeout,
      Promise,
    };
    sandbox.window = sandbox;
    sandbox.sidebarApi = noopApi;
    sandbox.settingsApi = noopApi;
    sandbox.overlay = noopApi;

    const ctx = vm.createContext(sandbox);
    assert.doesNotThrow(() => {
      vm.runInContext(i18nSrc, ctx, { filename: 'i18n.js' });
      vm.runInContext(src, ctx, { filename: script });
    }, `i18n.js + ${script} must execute cleanly in shared browser global scope`);
    assert.ok(sandbox.GomTinI18n && typeof sandbox.GomTinI18n.tr === 'function');
  }
});
