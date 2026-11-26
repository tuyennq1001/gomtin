'use strict';

// Guards all privacy, isolation and security invariants across Messenger,
// Zalo and Telegram views, local UI views (overlay, sidebar, settings), and
// both Development and Production build configs.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8').replace(/\r\n/g, '\n');
const sources = fs.readdirSync(SRC, { recursive: true })
  .map((f) => f.split(path.sep).join('/'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({
    file: f,
    code: fs.readFileSync(path.join(SRC, f), 'utf8')
      .replace(/\r\n/g, '\n')
      .replace(/(^|\s)\/\/.*$|\/\*[\s\S]*?\*\//gm, '$1'),
  }));
const code = (file) => sources.find((s) => s.file === file).code;
const main = code('main.js');
const pkg = require('../package.json');
const devBuild = require('../build/electron-builder.dev.json');

// Local app pages (lock/recovery overlay, sidebar dock, settings window) and
// the strictly read-only integer badge observer for chat views.
const APP_UI_FILES = [
  'overlay.js', 'ui/overlay-preload.js',
  'sidebar.js', 'ui/sidebar-preload.js',
  'settings-window.js', 'ui/settings-preload.js',
  'account-view.js', 'ui/chat-badge-preload.js',
];

const FORBIDDEN = {
  'runs script inside the page (could read form fields)': [/\bexecuteJavaScript(InIsolatedWorld)?\b/],
  'injects a preload script into the page': [/\bpreload\b/, APP_UI_FILES],
  'IPC channel between page and app': [/\b(ipcMain|ipcRenderer|contextBridge)\b/, APP_UI_FILES],
  'reads or writes cookies': [/\bcookies\s*\./],
  'intercepts or inspects network traffic': [/\b(webRequest|protocol\.handle|debugger\.attach)\b/],
  'makes its own network requests': [/\b(fetch\s*\(|net\.request|require\(['"]https?['"]\)|XMLHttpRequest)/],
  'uploads crash reports': [/\bcrashReporter\b/],
  'phones home for updates': [/\bautoUpdater\b/],
  'reads page console output': [/console-message/],
};

for (const [what, [re, allowedIn = []]] of Object.entries(FORBIDDEN)) {
  test(`app code never ${what}${allowedIn.length ? ` (except ${allowedIn.join(', ')})` : ''}`, () => {
    const hits = sources.filter((s) => re.test(s.code) && !allowedIn.includes(s.file)).map((s) => s.file);
    assert.deepStrictEqual(hits, [], `found in: ${hits.join(', ')}`);
  });
}

test('chat web pages only get the read-only integer badge preload and remain fully isolated', () => {
  assert.doesNotMatch(main, /\bpreload\b/);
  const account = code('account-view.js');
  assert.match(account, /preload: path\.join\(__dirname, 'ui', 'chat-badge-preload\.js'\)/);
  assert.match(account, /contextIsolation: true,\s*sandbox: true,\s*nodeIntegration: false/);
  assert.match(account, /ipcMain\.on\('chat:unread'/);
  assert.match(account, /viewsByWebContents\.get\(event\.sender\)/);
  assert.match(account, /!Number\.isInteger\(count\) \|\| count < -1 \|\| count > MAX_BADGE/);
  assert.match(main, /webPreferences: \{ session: wc\.session, contextIsolation: true, sandbox: true, nodeIntegration: false \}/);

  const badgePreload = code('ui/chat-badge-preload.js');
  assert.doesNotMatch(badgePreload, /\bcontextBridge\b/, 'badge preload must expose nothing to the web page');
  assert.doesNotMatch(badgePreload, /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/, 'badge preload must never touch storage or cookies');
  assert.doesNotMatch(badgePreload, /\bipcRenderer\.(invoke|sendSync|on|once)\b/, 'badge preload must be strictly one-way send only');
  assert.match(badgePreload, /ipcRenderer\.send\('chat:unread', next\)/);

  const overlay = code('overlay.js');
  assert.match(overlay, /new WebContentsView\(/);
  assert.match(overlay, /preload: path\.join\(__dirname, 'ui', 'overlay-preload\.js'\)/);
  assert.match(overlay, /wc\.loadFile\(/, 'overlay loads a local file only');
  assert.doesNotMatch(overlay, /loadURL\(/);
});

test('overlay IPC accepts only its own page and a fixed set of actions', () => {
  const overlay = code('overlay.js');
  assert.match(overlay, /if \(!this\.view \|\| event\.sender !== this\.view\.webContents \|\| !ACTIONS\.has\(action\)\) throw/);
  assert.match(overlay, /wc\.on\('will-navigate', \(e\) => e\.preventDefault\(\)\)/);
  assert.match(overlay, /setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/);
  const html = read('ui/overlay.html');
  assert.match(html, /Content-Security-Policy" content="default-src 'none'; script-src 'self'/);
  assert.doesNotMatch(html, /https?:\/\//, 'overlay page loads nothing remote');
});

test('sidebar IPC accepts only its own page and a fixed set of actions', () => {
  const sb = code('sidebar.js');
  assert.match(sb, /event\.sender !== this\.view\.webContents \|\| !ACTIONS\.has\(action\)\)/);
  assert.match(sb, /registerAppPage\(wc\)/);
  assert.match(sb, /wc\.on\('will-navigate', \(e\) => e\.preventDefault\(\)\)/);
  assert.match(sb, /setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/);
  assert.match(sb, /wc\.loadFile\(/);
  assert.doesNotMatch(sb, /loadURL\(/);
  const html = read('ui/sidebar.html');
  assert.match(html, /Content-Security-Policy" content="default-src 'none'; script-src 'self'/);
  assert.doesNotMatch(html, /https?:\/\//, 'sidebar loads nothing remote');
  // SVG and flex/grid elements require explicit [hidden] CSS rule so toggled icons never stack.
  assert.match(read('ui/sidebar.css'), /\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
  assert.match(read('ui/overlay.css'), /\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
});

test('settings window IPC accepts only its own page and a fixed set of actions', () => {
  const sw = code('settings-window.js');
  assert.match(sw, /event\.sender !== this\.view\.webContents \|\| !ACTIONS\.has\(action\)\) \{\s*throw/);
  assert.match(sw, /registerAppPage\(wc\)/);
  assert.match(sw, /wc\.on\('will-navigate', \(e\) => e\.preventDefault\(\)\)/);
  assert.match(sw, /wc\.loadFile\(/);
  assert.doesNotMatch(sw, /loadURL\(/);
  const html = read('ui/settings.html');
  assert.match(html, /Content-Security-Policy" content="default-src 'none'; script-src 'self'/);
  assert.doesNotMatch(html, /https?:\/\//);
});

test('accounts never share a session', () => {
  const account = code('account-view.js');
  assert.match(account, /return id === 'default' \? 'persist:messenger' : `persist:messenger-\$\{id\}`;/);
  assert.match(account, /if \(ephemeral\) return `messenger-private-\$\{id\}`;/);
  assert.match(account, /partition: this\.partition,/);
});

test('no updater or self-update modules exist and no external GitHub calls remain', () => {
  assert.ok(!fs.existsSync(path.join(SRC, 'updater.js')));
  assert.ok(!fs.existsSync(path.join(SRC, 'self-update.js')));
  for (const s of sources) {
    assert.doesNotMatch(s.code, /api\.github\.com|github\.com\/thangldw/, `unexpected GitHub URL in ${s.file}`);
  }
});

test('notifications are withheld while paused or locked, and tab audio mutes when paused', () => {
  assert.match(main, /permission === 'notifications' \? notificationsAllowed\(\) : true/);
  assert.match(main, /function notificationsAllowed\(\) \{\s*return !dnd\.isPaused\(\) && !\(lock && lock\.locked\);/);
  assert.match(main, /function applyAudioMute\(\) \{[^}]*dnd\.isPaused\(\) && settings\.get\('muteAudioWhenPaused'\)[^}]*setAudioMuted\(muted\)/);
  assert.strictEqual(require('../src/settings').SCHEMA.muteAudioWhenPaused.default, true);
});

test('while locked, DevTools, sidebar and "open in browser" are hidden/disabled', () => {
  assert.match(main, /label: t\('menuDevTools'\), [^\n]*enabled: !locked/);
  assert.match(main, /label: t\('menuOpenBrowser'\), enabled: !locked/);
  assert.match(main, /if \(sidebar\) sidebar\.setVisible\(!locked && settings\.get\('showSidebar'\)\)/);
});

test('the only thing injected into chat pages is CSS', () => {
  assert.match(code('account-view.js'), /this\.wc\.insertCSS\(css\)/);
});

test('page runs isolated from the app (contextIsolation, sandbox, no Node)', () => {
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.doesNotMatch(main, /nodeIntegration:\s*true|contextIsolation:\s*false|sandbox:\s*false/);
});

test('every window is guarded and <webview> is blocked', () => {
  assert.match(main, /app\.on\(['"]web-contents-created['"]/);
  assert.match(main, /will-attach-webview[^\n]*preventDefault/);
  assert.match(main, /guardContents\(wc\)/);
  for (const ev of ['will-navigate', 'will-redirect', 'did-navigate']) {
    assert.match(main, new RegExp(`wc\\.on\\(['"]${ev}['"]`), `missing ${ev} guard`);
  }
  assert.match(main, /setWindowOpenHandler/);
});

test('popups: shown only after opener origin matches service, hidden while locked', () => {
  assert.match(main, /overrideBrowserWindowOptions: \{\s*show: false,/);
  assert.match(main, /wc\.on\('did-create-window'[^]*?if \(opener && !isServiceUrl\(opener\.origin, svc\)\) \{ win\.destroy\(\); return; \}/);
  assert.match(main, /setWindowOpenHandler\(\(\{ url \}\) => \{\s*if \(lock && lock\.locked\) return \{ action: 'deny' \};/);
  const vis = main.slice(main.indexOf('function applyVisibility('), main.indexOf('function switchAccount('));
  assert.match(vis, /for \(const win of popups\)[^]*?win\.hide\(\)/);
  assert.match(main, /win\.on\('show', \(\) => \{ if \(lock && lock\.locked\)/);
});

test('permissions and screen capture are strictly scoped to the account service origin', () => {
  assert.match(main, /setPermissionRequestHandler\([^]*?isServiceUrl\(details\.requestingUrl, svc\)/);
  assert.match(main, /setPermissionCheckHandler\([^]*?isServiceUrl\(requestingOrigin, svc\)/);
  const share = code('screen-share.js');
  assert.match(share, /isServiceUrl\(request\.securityOrigin, serviceId\)/);
});

test('the session (user agent, permissions) is configured before an account view is created', () => {
  const fn = main.slice(main.indexOf('function mountAccountView('));
  assert.ok(fn.indexOf('configureSession(') > 0 && fn.indexOf('configureSession(') < fn.indexOf('new AccountView('));
});

test('packaged builds refuse remote-debugging and network-override switches', () => {
  assert.ok(main.includes('if (app.isPackaged && BLOCKED_SWITCHES.some((s) => app.commandLine.hasSwitch(s))) {\n  app.exit(1);'));
  const list = main.slice(main.indexOf('const BLOCKED_SWITCHES = ['), main.indexOf('];', main.indexOf('const BLOCKED_SWITCHES = [')));
  for (const s of ['remote-debugging-port', 'remote-debugging-pipe', 'remote-debugging-address', 'proxy-server', 'proxy-pac-url',
    'host-resolver-rules', 'host-rules', 'ignore-certificate-errors', 'ignore-certificate-errors-spki-list', 'disable-web-security']) {
    assert.ok(list.includes(`'${s}'`), `${s} not blocked`);
  }
});

test('no third-party spellcheck dictionary downloads (Windows/Linux)', () => {
  assert.match(main, /setSpellCheckerEnabled\(process\.platform === ['"]darwin['"]\)/);
});

test('external links only open http(s) in the browser', () => {
  const calls = sources.flatMap((s) => s.code.split('\n').filter((l) => l.includes('shell.openExternal')));
  assert.ok(calls.length > 0);
  for (const line of calls) assert.ok(line.includes('/^https?:'), `unguarded: ${line.trim()}`);
});

test('microphone and camera: automatic only in a call window, otherwise the user is asked', () => {
  assert.match(main, /if \(permission !== 'media'\) \{ cb\(true\); return; \}\s*allowMedia\(wc, partition, svc, details\)/);
  const fn = main.slice(main.indexOf('async function allowMedia('), main.indexOf('async function clearPartition('));
  assert.match(fn, /^async function allowMedia\(wc, partition, service, details\) \{\s*if \(isCallWindow\(wc, service\)\) return true;\s*if \(lock && lock\.locked\) return false;/);
  assert.match(fn, /dialog\.showMessageBox/);
});

test('macOS Dev and Prod builds both use hardened runtime, isolated appIds, and full fuses', () => {
  for (const [label, cfg] of [['prod', pkg.build], ['dev', devBuild]]) {
    assert.strictEqual(cfg.mac.hardenedRuntime, true, `${label} hardenedRuntime`);
    assert.strictEqual(cfg.mac.extendInfo.NSUserNotificationAlertStyle, 'alert', `${label} notification alert style`);
    assert.ok(cfg.mac.identity && cfg.mac.identity !== '-', `${label} should use a real signing identity for macOS notifications`);
    const f = cfg.electronFuses;
    assert.strictEqual(f.enableCookieEncryption, true, `${label} cookie encryption`);
    assert.strictEqual(f.runAsNode, false, `${label} runAsNode`);
    assert.strictEqual(f.enableNodeOptionsEnvironmentVariable, false, `${label} node options`);
    assert.strictEqual(f.enableNodeCliInspectArguments, false, `${label} cli inspect`);
    assert.strictEqual(f.onlyLoadAppFromAsar, true, `${label} asar only`);
    // Required on Electron 45+ so local app UI pages (sidebar, settings, overlay)
    // load via loadFile() from inside app.asar without ERR_FILE_NOT_FOUND.
    assert.strictEqual(f.grantFileProtocolExtraPrivileges, true, `${label} file protocol privileges for app.asar UI`);
  }
  assert.notStrictEqual(pkg.build.appId, devBuild.appId, 'Dev and Prod bundle IDs must be isolated');
  assert.strictEqual(devBuild.appId, 'com.tuyennq.gomtin.dev');
  assert.strictEqual(pkg.build.appId, 'com.tuyennq.gomtin');
  assert.notStrictEqual(pkg.build.mac.icon, devBuild.mac.icon, 'Dev and Prod must use visually distinct icons');
  assert.ok(fs.existsSync(path.join(__dirname, '..', pkg.build.mac.icon)), 'Prod icon missing');
  assert.ok(fs.existsSync(path.join(__dirname, '..', devBuild.mac.icon)), 'Dev icon missing');
});

test('permissions are an explicit allow-list', () => {
  const m = main.match(/const allowed = new Set\(\[([^\]]*)\]\)/);
  assert.ok(m, 'permission allow-list not found');
  const granted = m[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).sort();
  assert.deepStrictEqual(granted, ['clipboard-sanitized-write', 'display-capture', 'fullscreen', 'media', 'notifications']);
});

test('app has no runtime dependencies that could add behaviour', () => {
  assert.strictEqual(pkg.dependencies, undefined);
});
