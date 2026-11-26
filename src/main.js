'use strict';

const {
  app, BaseWindow, Menu, shell, session, dialog, globalShortcut, nativeImage, nativeTheme,
} = require('electron');
const crypto = require('crypto');
const path = require('path');
const pkg = require('../package.json');
const { DEFAULT_SERVICE, SERVICE_LIST, isValidService, getService } = require('./services');
const { classify, isServiceUrl, isCallUrl, downloadTarget, homeUrlFor } = require('./routes');
const { createDisplayMediaHandler } = require('./screen-share');
const {
  Settings, isChatPath, cleanName, LOCK_MINUTES, MAX_ACCOUNTS, THEME_COLORS, APPEARANCES, LANGUAGES,
} = require('./settings');
const { migrateLegacyUserData } = require('./migrate');
const { tr } = require('./ui/i18n');
const { AccountView, partitionFor } = require('./account-view');
const { isAppPage } = require('./app-pages');
const { AppTray } = require('./tray');
const { Overlay } = require('./overlay');
const { Sidebar, SIDEBAR_WIDTH } = require('./sidebar');
const { AppLock } = require('./lock');
const { Dnd, HOUR } = require('./dnd');
const { normalizeRules, MAX_RULES } = require('./focus');
const { SettingsWindow } = require('./settings-window');

// Dev vs Prod environment separation: Dev uses its own bundle ID, isolated
// userData folder and clear visual DEV indicators so testing never touches
// Production sessions.
const IS_DEV = !app.isPackaged || pkg.env === 'development' || process.env.NODE_ENV === 'development';
const APP_ID = IS_DEV ? 'com.tuyennq.gomtin.dev' : 'com.tuyennq.gomtin';
const APP_NAME = IS_DEV ? 'GomTin Dev' : 'GomTin';
const LEGACY_APP_NAME = IS_DEV ? 'Messenger Dev' : 'Messenger';
const TITLE_PREFIX = IS_DEV ? '[DEV] ' : '';

const hasCustomUserData = app.commandLine.hasSwitch('user-data-dir');
if (!hasCustomUserData) {
  if (!app.isPackaged && IS_DEV) {
    app.setName(APP_NAME);
    app.setPath('userData', path.join(app.getPath('appData'), APP_NAME));
  }
  migrateLegacyUserData(app.getPath('appData'), LEGACY_APP_NAME, APP_NAME);
}

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const FB_ORIGIN = 'https://www.facebook.com';
// Chosen to avoid common system and app shortcuts; Ctrl+Alt alone is AltGr on
// many Windows keyboard layouts, so Shift is added there.
const SHORTCUT = isMac ? 'Control+Alt+M' : 'Control+Alt+Shift+M';
const SHORTCUT_LABEL = isMac ? '⌃⌥M' : 'Ctrl+Alt+Shift+M';

// Hides Facebook's global top bar (Home/Watch/Marketplace...). Applied only
// to Facebook Messenger accounts.
const HIDE_TOPBAR_CSS = `
  div[role="banner"] { display: none !important; }
  :root, :root * { --header-height: 0px !important; }
`;
// Privacy screen: blur the page while the window is not focused.
const PRIVACY_CSS = 'html { filter: blur(24px) saturate(0.6) !important; }';

// Chromium switches that would let another local program get at chat sessions:
// a remote-debugging port exposes pages and cookies over the DevTools protocol,
// and network switches let a local process intercept traffic. Packaged builds
// refuse these; a proxy still works through OS system proxy settings.
const BLOCKED_SWITCHES = [
  'remote-debugging-port', 'remote-debugging-pipe', 'remote-debugging-address',
  'proxy-server', 'proxy-pac-url', 'host-resolver-rules', 'host-rules',
  'ignore-certificate-errors', 'ignore-certificate-errors-spki-list', 'disable-web-security',
];
if (app.isPackaged && BLOCKED_SWITCHES.some((s) => app.commandLine.hasSwitch(s))) {
  app.exit(1);
}

let settings;
let ephemeral = false;
// The shell window has no renderer of its own; each enabled account runs in
// its own sandboxed WebContentsView alongside the isolated left sidebar view.
let mainWindow = null;
const accounts = new Map(); // enabled account id -> AccountView
let activeId = null;
let tray = null;
let sidebar = null;
let overlay = null;
let lock = null;
let dnd = null;
let settingsWin = null;
let winBadgeImage = null;
let isQuitting = false;
const configuredPartitions = new Set();
const sessionServices = new WeakMap(); // Electron.Session -> serviceId
// Call windows and other popups opened by chat pages. They are separate
// windows, so the app lock hides them explicitly (see applyVisibility).
const popups = new Set();
const hiddenByLock = new Set();

// ---------------------------------------------------------------- helpers

// Chat web clients may degrade or block UAs containing "Electron".
function chromeUserAgent() {
  const escapedName = app.getName().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return app.userAgentFallback
    .replace(/\sElectron\/\S+/, '')
    .replace(new RegExp(`\\s${escapedName}\\/\\S+`), '');
}

function openExternal(url) {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
}

const active = () => (activeId ? accounts.get(activeId) || null : null);
const accountFor = (wc) => [...accounts.values()].find((a) => a.wc === wc);
const serviceFor = (wc) => {
  const acc = accountFor(wc);
  if (acc) return acc.service;
  return sessionServices.get(wc.session) || DEFAULT_SERVICE;
};
const totalUnread = () => [...accounts.values()].reduce((n, a) => n + (a.unread > 0 ? a.unread : 0), 0);
const hasAnyUnread = () => [...accounts.values()].some((a) => a.unread > 0 || a.unread === -1);

function enabledAccountConfigs() {
  return settings ? settings.get('accounts').filter((a) => a.enabled) : [];
}

function startUrlFor(acc) {
  const svc = getService(acc.service);
  if (svc.supportsLastChat) {
    const last = settings.get('lastChats')[acc.id];
    if (settings.get('restoreLastChat') && !ephemeral && isChatPath(last)) return FB_ORIGIN + last;
  }
  return svc.homeUrl;
}

const saveChatTimers = new Map();
function rememberChat(acc, url) {
  if (!getService(acc.service).supportsLastChat) return;
  if (!settings.get('restoreLastChat') || ephemeral) return;
  let p;
  try { p = new URL(url).pathname; } catch { return; }
  if (!isChatPath(p) || settings.get('lastChats')[acc.id] === p) return;
  clearTimeout(saveChatTimers.get(acc.id));
  saveChatTimers.set(acc.id, setTimeout(() => {
    if (!accounts.has(acc.id)) return;
    settings.set('lastChats', { ...settings.get('lastChats'), [acc.id]: p });
  }, 2000));
}

function notificationsAllowed() {
  return !dnd.isPaused() && !(lock && lock.locked);
}

function applyCss(acc) {
  const hideTop = getService(acc.service).supportsHideTopBar && settings.get('hideTopBar');
  acc.setCss('topbar', HIDE_TOPBAR_CSS, hideTop);
  acc.setCss('privacy', PRIVACY_CSS, settings.get('privacyScreen') && !(mainWindow && mainWindow.isFocused()));
}

function applyCssAll() {
  for (const acc of accounts.values()) applyCss(acc);
}

// Silence in-page notification chimes while DND / Focus schedule is active.
// Separate call popups live in their own BrowserWindows and stay unmuted.
function applyAudioMute() {
  const muted = Boolean(dnd && dnd.isPaused() && settings.get('muteAudioWhenPaused'));
  for (const acc of accounts.values()) {
    if (!acc.wc.isDestroyed()) acc.wc.setAudioMuted(muted);
  }
}

const lang = () => (settings ? settings.get('language') : 'vi');
const t = (key, vars) => tr(lang(), key, vars);

function isDarkMode() {
  return nativeTheme.shouldUseDarkColors;
}

function surfaceBgHex() {
  return isDarkMode() ? '#151821' : '#F4F7FB';
}

function railBgHex() {
  return isDarkMode() ? '#13161E' : '#EEF3F9';
}

function uiThemeState() {
  return {
    themeColor: settings ? settings.get('themeColor') : 'blue',
    appearance: settings ? settings.get('appearance') : 'system',
    resolvedTheme: isDarkMode() ? 'dark' : 'light',
    language: lang(),
    appName: APP_NAME,
    isDev: IS_DEV,
  };
}

function applyAppearance() {
  if (settings) nativeTheme.themeSource = settings.get('appearance');
  const surface = surfaceBgHex();
  const rail = railBgHex();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setBackgroundColor(surface);
  if (sidebar) sidebar.setBackgroundColor(rail);
  if (overlay) overlay.setBackgroundColor(surface);
  if (settingsWin) settingsWin.setBackgroundColor(surface);
  pushUi();
}

function setAppearance({ themeColor, appearance, language } = {}) {
  let langChanged = false;
  if (themeColor !== undefined && THEME_COLORS.includes(themeColor)) {
    settings.set('themeColor', themeColor);
  }
  if (appearance !== undefined && APPEARANCES.includes(appearance)) {
    settings.set('appearance', appearance);
  }
  if (language !== undefined && LANGUAGES.includes(language)) {
    langChanged = settings.get('language') !== language;
    settings.set('language', language);
  }
  applyAppearance();
  if (langChanged) {
    updateTitle();
    refreshStatus();
    rebuildMenus();
  }
  return { ok: true };
}

function confirmParent() {
  return mainWindow && mainWindow.isVisible() ? mainWindow : null;
}

async function confirm(message, detail, okLabel) {
  const options = { type: 'question', message, detail, buttons: [okLabel, t('cancel')], defaultId: 0, cancelId: 1 };
  const parent = confirmParent();
  const { response } = parent ? await dialog.showMessageBox(parent, options) : await dialog.showMessageBox(options);
  return response === 0;
}

function pushUi() {
  if (sidebar) sidebar.push();
  if (settingsWin) settingsWin.push();
  if (overlay && overlay.visible) overlay.push();
}

// ---------------------------------------------------------------- window

function sidebarInset() {
  if (!sidebar || !settings || !settings.get('showSidebar') || (lock && lock.locked)) return 0;
  return SIDEBAR_WIDTH;
}

function focusActive() {
  if (overlay && overlay.visible) overlay.focus();
  else if (settingsWin && settingsWin.visible) settingsWin.focus();
  else if (active()) active().wc.focus();
}

function showWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  focusActive();
}

function toggleWindow() {
  if (mainWindow && mainWindow.isVisible() && mainWindow.isFocused()) mainWindow.hide();
  else showWindow();
}

function layout() {
  if (!mainWindow) return;
  const [width, height] = mainWindow.getContentSize();
  const inset = sidebarInset();
  if (sidebar) sidebar.layout();
  const chatWidth = Math.max(0, width - inset);
  for (const acc of accounts.values()) acc.view.setBounds({ x: inset, y: 0, width: chatWidth, height });
  if (settingsWin) settingsWin.layout(inset);
  if (overlay) overlay.layout(inset);
}

function updateTitle() {
  if (!mainWindow) return;
  const total = totalUnread();
  const cur = active();
  const prefix = total > 0 ? `(${total}) ` : (hasAnyUnread() ? '• ' : '');
  const suffix = cur && (accounts.size > 1 || cur.service !== DEFAULT_SERVICE) ? ` — ${cur.name}` : '';
  mainWindow.setTitle(`${prefix}${TITLE_PREFIX}${APP_NAME}${suffix}`);
}

function onUnread() {
  const total = totalUnread();
  const anyUnread = hasAnyUnread();
  if (total > 0) {
    app.setBadgeCount(total); // macOS dock, supported Linux launchers
  } else if (anyUnread) {
    if (isMac && app.dock) app.dock.setBadge('•');
    else app.setBadgeCount(0);
  } else {
    app.setBadgeCount(0);
    if (isMac && app.dock) app.dock.setBadge('');
  }
  if (isWin && mainWindow) {
    if (!winBadgeImage) winBadgeImage = nativeImage.createFromPath(path.join(__dirname, 'assets', 'badge.png'));
    const desc = total > 0 ? t('unreadCount', { n: total }) : (anyUnread ? t('unreadCount', { n: '•' }) : '');
    mainWindow.setOverlayIcon(anyUnread ? winBadgeImage : null, desc);
  }
  updateTitle();
  if (lock && dnd) buildAppMenu(); // unread counts in the Accounts menu
  if (tray) {
    const count = total > 0 ? total : (anyUnread ? 1 : 0);
    tray.setUnread(count, {
      paused: dnd.isPaused(),
      unreadText: total > 0 ? t('unreadCount', { n: total }) : t('unreadCount', { n: '•' }),
      pausedText: t('notificationsPaused'),
    });
  }
  pushUi();
}

// Show the offline/crashed/empty screen for the current pane (hidden while
// embedded Settings is open so Settings stays interactive even if all accounts are off).
function refreshStatus() {
  if (!overlay) return;
  if (settingsWin && settingsWin.visible) {
    overlay.setLayer('empty', null);
    overlay.setLayer('offline', null);
    overlay.setLayer('crashed', null);
    overlay.layout(sidebarInset());
    return;
  }
  const acc = active();
  if (!acc) {
    overlay.setLayer('offline', null);
    overlay.setLayer('crashed', null);
    overlay.setLayer('empty', {});
    overlay.layout(sidebarInset());
    return;
  }
  overlay.setLayer('empty', null);
  const offline = acc.status.offline ? { ...acc.status.offline, serviceName: getService(acc.service).label } : null;
  overlay.setLayer('offline', offline);
  overlay.setLayer('crashed', acc.status.crashed);
  overlay.layout(sidebarInset());
}

// ---------------------------------------------------------------- guards

// Navigation and window-creation policy, applied to every window the app
// creates: account views, call windows and any popup they open. App windows
// have no address bar, so nothing outside the account's own service may ever
// render in one.
function guardContents(wc) {
  const account = () => accountFor(wc);
  // The app's own pages register themselves after creation, so this is checked per event.
  const skip = () => isAppPage(wc);

  // Full navigations triggered by the page (link clicks, form posts).
  wc.on('will-navigate', (event, url) => {
    if (skip()) { event.preventDefault(); return; }
    const svc = serviceFor(wc);
    const file = downloadTarget(url, svc);
    if (file) { event.preventDefault(); wc.downloadURL(file); return; }
    const kind = classify(url, svc);
    if (kind === 'allowed') return;
    event.preventDefault();
    if (kind === 'feed') { if (account()) wc.loadURL(homeUrlFor(svc)); }
    else openExternal(url);
  });

  // Server redirects may pass through unlisted paths of the service (login,
  // checkpoint, QR SSO), but must never land on a third-party site in-app.
  wc.on('will-redirect', (event) => {
    if (skip()) { event.preventDefault(); return; }
    const svc = serviceFor(wc);
    if (!event.isMainFrame || event.url === 'about:blank' || isServiceUrl(event.url, svc)) return;
    event.preventDefault();
    const file = downloadTarget(event.url, svc);
    if (file) wc.downloadURL(file); else openExternal(event.url);
  });

  // Last line of defence if a non-service page still loads in an app window.
  wc.on('did-navigate', (_e, url) => {
    if (skip() || url === 'about:blank') return;
    const svc = serviceFor(wc);
    if (!isServiceUrl(url, svc)) {
      if (account()) wc.loadURL(homeUrlFor(svc)); else wc.close();
      return;
    }
    // Post-login redirect to "/" and similar on Facebook: back to the inbox.
    if (account() && classify(url, svc) === 'feed') wc.loadURL(homeUrlFor(svc));
  });

  wc.setWindowOpenHandler(({ url }) => {
    // A locked app opens nothing: a new window would show above the lock screen.
    if (lock && lock.locked) return { action: 'deny' };
    const svc = serviceFor(wc);
    // Attachments and "Download" buttons: save the file, never render it.
    const file = downloadTarget(url, svc);
    if (file) { wc.downloadURL(file); return { action: 'deny' }; }
    // In-service popups (e.g. Facebook call windows) keep the account's session and guards.
    if (classify(url, svc) === 'allowed') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          // Shown by did-create-window below, once its opener has been checked.
          show: false,
          autoHideMenuBar: true,
          webPreferences: { session: wc.session, contextIsolation: true, sandbox: true, nodeIntegration: false },
        },
      };
    }
    openExternal(url);
    return { action: 'deny' };
  });

  wc.on('did-create-window', (win) => {
    // A popup starts as about:blank and its opener can document.write into it.
    // Only the account's own service frames may hold that handle.
    const { opener } = win.webContents;
    const svc = serviceFor(win.webContents);
    if (opener && !isServiceUrl(opener.origin, svc)) { win.destroy(); return; }
    trackPopup(win);
  });
}

function trackPopup(win) {
  popups.add(win);
  win.on('closed', () => { popups.delete(win); hiddenByLock.delete(win); });
  // Whatever tries to bring it back while locked (page script, Window menu).
  win.on('show', () => { if (lock && lock.locked) { hiddenByLock.add(win); win.hide(); } });
  if (lock && lock.locked) hiddenByLock.add(win); else win.show();
}

function attachAccountBehaviour(acc) {
  const { wc } = acc;
  // Chat web apps are SPAs: clicking links may pushState to disallowed routes.
  wc.on('did-navigate-in-page', (_e, url, isMainFrame) => {
    if (!isMainFrame) return;
    const kind = classify(url, acc.service);
    if (kind === 'allowed') { rememberChat(acc, url); return; }
    if (kind !== 'feed') openExternal(url);
    wc.loadURL(homeUrlFor(acc.service));
  });
  wc.on('did-navigate', (_e, url) => rememberChat(acc, url));
  wc.on('dom-ready', () => applyCss(acc));
}

// ---------------------------------------------------------------- sessions

function configureSession(partition, service = DEFAULT_SERVICE) {
  const ses = session.fromPartition(partition);
  sessionServices.set(ses, service);
  if (configuredPartitions.has(partition)) return;
  configuredPartitions.add(partition);
  ses.setUserAgent(chromeUserAgent());

  // Granted only to the account's own service frames, never third-party iframes.
  // Notifications are additionally withheld while paused (DND) or locked.
  const allowed = new Set(['notifications', 'media', 'display-capture', 'clipboard-sanitized-write', 'fullscreen']);
  ses.setPermissionRequestHandler((wc, permission, cb, details) => {
    const svc = sessionServices.get(ses) || service;
    if (!allowed.has(permission) || !isServiceUrl(details.requestingUrl, svc)) { cb(false); return; }
    if (permission !== 'media') { cb(true); return; }
    allowMedia(wc, partition, svc, details).then(cb, () => cb(false));
  });
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
    const svc = sessionServices.get(ses) || service;
    if (!allowed.has(permission) || !isServiceUrl(requestingOrigin, svc)) return false;
    return permission === 'notifications' ? notificationsAllowed() : true;
  });
  // Spellcheck dictionaries are downloaded from Google's CDN on Windows/Linux;
  // macOS uses the OS spellchecker. Keep network traffic strictly chat-only.
  ses.setSpellCheckerEnabled(process.platform === 'darwin');
  // macOS 15+ shows the native system picker; elsewhere our service-scoped handler asks.
  ses.setDisplayMediaRequestHandler(createDisplayMediaHandler(service), { useSystemPicker: true });

  // Downloads (chat attachments, saved photos): ask where to save, starting in
  // Downloads, and reveal the file when done, like a browser.
  ses.on('will-download', (_e, item) => {
    item.setSaveDialogOptions({ defaultPath: path.join(app.getPath('downloads'), item.getFilename()) });
    item.once('done', (_ev, state) => {
      if (state === 'completed') shell.showItemInFolder(item.getSavePath());
    });
  });
}

// Microphone and camera: granted without asking only to a dedicated call popup
// (Facebook Messenger calls). Anywhere else (voice clips, inline Telegram WebRTC
// calls), the user is asked first, with an option to remember until quit.
const mediaChoices = new Map(); // "<partition> audio|video" -> boolean

function isCallWindow(wc, service) {
  return [...popups].some((win) => !win.isDestroyed() && win.webContents === wc) && isCallUrl(wc.getURL(), service);
}

async function allowMedia(wc, partition, service, details) {
  if (isCallWindow(wc, service)) return true;
  if (lock && lock.locked) return false;
  let types = (details.mediaTypes || []).filter((t) => t === 'audio' || t === 'video');
  if (types.length === 0) types = ['audio', 'video'];
  const keys = types.map((t) => `${partition} ${t}`);
  if (keys.some((k) => mediaChoices.get(k) === false)) return false;
  if (keys.every((k) => mediaChoices.get(k) === true)) return true;

  const what = types.length === 2 ? t('dlgMediaBoth') : types[0] === 'video' ? t('dlgMediaCam') : t('dlgMediaMic');
  const acc = accountFor(wc);
  const svcName = getService(service).fullName;
  const options = {
    type: 'question',
    message: t('dlgMediaTitle', { service: svcName, what }),
    detail: t('dlgMediaDetail', {
      accPrefix: acc && accounts.size > 1 ? t('dlgMediaAccPrefix', { name: acc.name }) : '',
      host: new URL(details.requestingUrl).hostname,
    }),
    buttons: [t('dlgMediaAllow'), t('dlgMediaDeny')],
    defaultId: 1,
    cancelId: 1,
    checkboxLabel: t('dlgMediaRemember', { app: APP_NAME }),
  };
  const parent = confirmParent();
  const { response, checkboxChecked } = parent ? await dialog.showMessageBox(parent, options) : await dialog.showMessageBox(options);
  const ok = response === 0;
  if (checkboxChecked) for (const k of keys) mediaChoices.set(k, ok);
  return ok;
}

// Deletes everything the app keeps for an account: cookies (the login session),
// local/IndexedDB storage, service workers and HTTP cache.
async function clearPartition(partition) {
  for (const k of mediaChoices.keys()) if (k.startsWith(`${partition} `)) mediaChoices.delete(k);
  const ses = session.fromPartition(partition);
  await ses.clearStorageData();
  await ses.clearCache();
  await ses.clearAuthCache();
}

// ---------------------------------------------------------------- accounts

function mountAccountView({ id, name, service }) {
  if (accounts.has(id)) return accounts.get(id);
  const svc = getService(service).id;
  // Before the view exists: a webContents takes its user agent from the session
  // when it is created, so a later setUserAgent would not reach the page.
  configureSession(partitionFor(id, ephemeral), svc);
  const acc = new AccountView({
    id,
    name,
    service: svc,
    ephemeral,
    startUrl: startUrlFor,
    onUnread,
    onStatus: (a) => { if (a.id === activeId) refreshStatus(); },
    onLoading: () => { if (sidebar) sidebar.push(); },
  });
  attachAccountBehaviour(acc);
  accounts.set(id, acc);
  mainWindow.contentView.addChildView(acc.view);
  const settingsOpen = Boolean(settingsWin && settingsWin.visible);
  acc.view.setVisible(id === activeId && !(lock && lock.locked) && !settingsOpen);
  layout();
  if (settingsWin) settingsWin.raise();
  if (overlay) overlay.raise();
  applyAudioMute();
  acc.load();
  return acc;
}

function unmountAccountView(id) {
  const acc = accounts.get(id);
  if (!acc) return;
  clearTimeout(saveChatTimers.get(id));
  saveChatTimers.delete(id);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.contentView.removeChildView(acc.view);
  acc.destroy();
  accounts.delete(id);
}

// Only the active account is shown, and none while locked or while embedded
// Settings is open. Popups (call windows) are hidden while locked and come
// back on unlock.
function applyVisibility() {
  const locked = Boolean(lock && lock.locked);
  const settingsOpen = Boolean(settingsWin && settingsWin.visible && !locked);
  if (sidebar) sidebar.setVisible(!locked && settings.get('showSidebar'));
  for (const acc of accounts.values()) acc.view.setVisible(!locked && !settingsOpen && acc.id === activeId);
  if (locked) {
    for (const win of popups) {
      if (!win.isDestroyed() && win.isVisible()) { hiddenByLock.add(win); win.hide(); }
    }
  } else {
    for (const win of hiddenByLock) if (!win.isDestroyed()) win.show();
    hiddenByLock.clear();
  }
  layout();
}

function switchAccount(id) {
  if (!accounts.has(id) || (lock && lock.locked)) return;
  if (settingsWin && settingsWin.visible) settingsWin.close();
  activeId = id;
  if (settings.get('activeAccount') !== id) settings.set('activeAccount', id);
  applyVisibility();
  refreshStatus();
  updateTitle();
  rebuildMenus();
  pushUi();
  if (mainWindow && mainWindow.isVisible()) focusActive();
}

function nextAccountName(list, serviceId) {
  const base = getService(serviceId).label;
  if (!list.some((a) => a.name === base)) return base;
  let n = 2;
  while (list.some((a) => a.name === `${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

async function addAccount({ service = DEFAULT_SERVICE, stayInSettings = false } = {}) {
  const svc = isValidService(service) ? service : DEFAULT_SERVICE;
  const list = settings.get('accounts');
  if (list.length >= MAX_ACCOUNTS) return { ok: false, error: t('errMaxAccounts', { max: MAX_ACCOUNTS }) };
  let id;
  do { id = crypto.randomBytes(4).toString('hex'); } while (list.some((a) => a.id === id));
  const name = nextAccountName(list, svc);
  const entry = { id, name, service: svc, enabled: true };
  settings.set('accounts', [...list, entry]);
  mountAccountView(entry);
  if (stayInSettings && settingsWin && settingsWin.visible) {
    activeId = id;
    settings.set('activeAccount', id);
    applyVisibility();
    updateTitle();
    rebuildMenus();
    pushUi();
    return { ok: true };
  }
  switchAccount(id);
  showWindow();
  return { ok: true };
}

function renameAccount({ id, name } = {}) {
  const clean = cleanName(name);
  if (!clean) return { ok: false, error: t('errEnterName') };
  const list = settings.get('accounts');
  const current = list.find((a) => a.id === id);
  if (!current) return { ok: false, error: t('errUnknownAccount') };
  if (current.name === clean) return { ok: true };
  settings.set('accounts', list.map((a) => (a.id === id ? { ...a, name: clean } : a)));
  if (accounts.has(id)) accounts.get(id).name = clean;
  updateTitle();
  rebuildMenus();
  pushUi();
  return { ok: true };
}

async function toggleAccount({ id, enabled } = {}) {
  if (typeof enabled !== 'boolean') return { ok: false, error: t('errInvalidToggle') };
  const list = settings.get('accounts');
  const target = list.find((a) => a.id === id);
  if (!target) return { ok: false, error: t('errUnknownAccount') };
  if (target.enabled === enabled) return { ok: true };

  const updated = list.map((a) => (a.id === id ? { ...a, enabled } : a));
  settings.set('accounts', updated);

  if (enabled) {
    mountAccountView({ ...target, enabled: true });
    if (!active()) activeId = id;
    if (activeId === id && settings.get('activeAccount') !== id) settings.set('activeAccount', id);
  } else {
    unmountAccountView(id);
    if (activeId === id) {
      const next = updated.find((a) => a.enabled);
      activeId = next ? next.id : null;
      if (activeId) settings.set('activeAccount', activeId);
    }
  }

  applyVisibility();
  refreshStatus();
  onUnread();
  rebuildMenus();
  pushUi();
  return { ok: true };
}

async function removeAccount({ id } = {}) {
  const list = settings.get('accounts');
  const entry = list.find((a) => a.id === id);
  if (!entry) return { ok: false, error: t('errUnknownAccount') };
  if (list.length === 1) return { ok: false, error: t('errKeepOneAccount') };
  const svcLabel = getService(entry.service).fullName;
  const ok = await confirm(
    t('dlgRemoveTitle', { name: entry.name, service: svcLabel }),
    t('dlgRemoveDetail', { app: APP_NAME, service: svcLabel }),
    t('remove'),
  );
  if (!ok) return { ok: false };
  const remaining = list.filter((a) => a.id !== id);
  settings.set('accounts', remaining);
  const chats = settings.get('lastChats');
  delete chats[id];
  settings.set('lastChats', chats);
  const part = partitionFor(id, ephemeral);
  unmountAccountView(id);
  if (!ephemeral) await clearPartition(part);
  if (activeId === id) {
    const next = remaining.find((a) => a.enabled);
    activeId = next ? next.id : null;
    if (activeId) settings.set('activeAccount', activeId);
  }
  applyVisibility();
  refreshStatus();
  onUnread();
  rebuildMenus();
  pushUi();
  return { ok: true };
}

// ---------------------------------------------------------------- actions

async function logOutAccount(id) {
  const acc = id ? accounts.get(id) : active();
  if (!acc) return;
  const svcLabel = getService(acc.service).fullName;
  const ok = await confirm(
    accounts.size > 1 ? t('dlgLogoutTitle', { name: acc.name }) : t('dlgLogoutSingleTitle', { service: svcLabel }),
    t('dlgLogoutDetail', { service: svcLabel }),
    t('dlgLogoutBtn'),
  );
  if (!ok) return;
  await clearPartition(acc.partition);
  const chats = settings.get('lastChats');
  delete chats[acc.id];
  settings.set('lastChats', chats);
  acc.wc.loadURL(homeUrlFor(acc.service));
}

// "Forgot password" on the lock screen: the only way past the lock without the
// password is to wipe every account's session and the lock together.
async function resetEverything() {
  const ok = await confirm(
    t('dlgResetTitle', { app: APP_NAME }),
    t('dlgResetDetail'),
    t('dlgResetBtn'),
  );
  if (!ok) return;
  for (const entry of settings.get('accounts')) await clearPartition(partitionFor(entry.id, ephemeral));
  settings.set('lastChats', {});
  lock.disable();
  for (const acc of accounts.values()) acc.wc.loadURL(homeUrlFor(acc.service));
}

async function setEphemeral(on) {
  const ok = await confirm(
    on ? t('dlgPrivateOnTitle') : t('dlgPrivateOffTitle'),
    on ? t('dlgPrivateOnDetail', { app: APP_NAME }) : t('dlgPrivateOffDetail', { app: APP_NAME }),
    t('dlgRestart'),
  );
  if (!ok) { rebuildMenus(); return; }
  if (on) {
    for (const { id } of settings.get('accounts')) await clearPartition(partitionFor(id, false));
    settings.set('lastChats', {});
  }
  settings.set('ephemeral', on);
  app.relaunch();
  isQuitting = true;
  app.exit(0);
}

function setOpenAtLogin(on) {
  app.setLoginItemSettings({ openAtLogin: on, args: isWin ? ['--hidden'] : [] });
  settings.set('openAtLogin', on);
  if (isMac && on && app.getLoginItemSettings().status === 'requires-approval') {
    dialog.showMessageBox({
      type: 'info',
      message: t('dlgLoginItemTitle', { app: APP_NAME }),
      detail: t('dlgLoginItemDetail', { app: APP_NAME }),
    });
  }
  rebuildMenus();
}

function applyGlobalShortcut() {
  globalShortcut.unregisterAll();
  if (!settings.get('globalShortcut')) return;
  if (!globalShortcut.register(SHORTCUT, toggleWindow)) {
    settings.set('globalShortcut', false);
    dialog.showMessageBox({
      type: 'warning',
      message: t('dlgShortcutTitle', { shortcut: SHORTCUT_LABEL }),
      detail: t('dlgShortcutDetail'),
    });
  }
}

function setFocusSchedule({ enabled, rules } = {}) {
  const clean = normalizeRules(rules);
  if (!clean) return { ok: false, error: t('focusNeedDiffTime') };
  settings.set('focusRules', clean);
  settings.set('focusEnabled', Boolean(enabled));
  settings.set('focusOverrideUntil', 0);
  dnd.changed(true);
  return { ok: true };
}

function openSettings(section) {
  if (lock.locked || !settingsWin) return;
  showWindow();
  settingsWin.open(section);
}

function toggleSettings(section) {
  if (lock.locked || !settingsWin) return;
  if (settingsWin.visible) settingsWin.close();
  else openSettings(section);
}

function settingsState() {
  const end = dnd.focusUntil();
  const timeStr = end ? new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  return {
    isDev: IS_DEV,
    appName: APP_NAME,
    theme: uiThemeState(),
    accounts: settings.get('accounts').map((a) => ({
      ...a,
      active: a.id === activeId,
      unread: accounts.has(a.id) ? accounts.get(a.id).unread : 0,
    })),
    maxAccounts: MAX_ACCOUNTS,
    maxRules: MAX_RULES,
    focus: {
      enabled: settings.get('focusEnabled'),
      rules: settings.get('focusRules'),
      status: dnd.focusPaused() ? t('focusNowUntil', { time: timeStr }) : '',
    },
  };
}

function sidebarState() {
  const all = settings.get('accounts');
  return {
    isDev: IS_DEV,
    appName: APP_NAME,
    theme: uiThemeState(),
    settingsOpen: Boolean(settingsWin && settingsWin.visible),
    totalAccounts: all.length,
    maxAccounts: MAX_ACCOUNTS,
    dndPaused: dnd.isPaused(),
    dndLabel: dnd.label(lang()),
    lockEnabled: lock.enabled,
    accounts: all.filter((a) => a.enabled).map((a) => {
      const live = accounts.get(a.id);
      return {
        id: a.id,
        name: a.name,
        service: a.service,
        active: a.id === activeId,
        unread: live ? live.unread : 0,
        loading: live ? live.loading : false,
      };
    }),
  };
}

function openAddMenu() {
  if (!mainWindow || (lock && lock.locked)) return;
  const atMax = settings.get('accounts').length >= MAX_ACCOUNTS;
  const menu = Menu.buildFromTemplate(SERVICE_LIST.map((svc) => ({
    label: t('menuAddService', { service: svc.fullName }),
    enabled: !atMax,
    click: () => addAccount({ service: svc.id }),
  })));
  menu.popup({ window: mainWindow });
}

function openAccountMenu(id) {
  if (!mainWindow || (lock && lock.locked)) return;
  const list = settings.get('accounts');
  const entry = list.find((a) => a.id === id);
  const live = accounts.get(id);
  if (!entry || !live) return;
  const svc = getService(entry.service);
  const menu = Menu.buildFromTemplate([
    { label: `${entry.name} (${svc.label})`, enabled: false },
    { type: 'separator' },
    { label: t('menuReload'), click: () => live.wc.reload() },
    { label: t('menuGoHome', { service: svc.label }), click: () => live.wc.loadURL(svc.homeUrl) },
    { type: 'separator' },
    { label: t('menuTurnOffRam'), click: () => toggleAccount({ id, enabled: false }) },
    { label: t('menuManageAccounts'), click: () => openSettings('accounts') },
    { type: 'separator' },
    { label: t('menuLogoutGeneric'), click: () => logOutAccount(id) },
    { label: t('menuRemoveAccount'), enabled: list.length > 1, click: () => removeAccount({ id }) },
  ]);
  menu.popup({ window: mainWindow });
}

function openDndMenu() {
  if (!mainWindow || (lock && lock.locked)) return;
  Menu.buildFromTemplate(pauseItems()).popup({ window: mainWindow });
}

// ---------------------------------------------------------------- menus

function pauseItems() {
  const label = dnd.label(lang());
  return [
    ...(label ? [{ label, enabled: false }, { label: t('menuResumeNotif'), click: () => dnd.resume() }, { type: 'separator' }] : []),
    { label: t('menuPause1h'), click: () => dnd.pauseFor(HOUR) },
    { label: t('menuPauseMorning'), click: () => dnd.pauseUntilMorning() },
    { label: t('menuPauseIndef'), click: () => dnd.pauseIndefinitely() },
    { type: 'separator' },
    settingToggle(t('menuMuteAudio'), 'muteAudioWhenPaused', (on) => {
      settings.set('muteAudioWhenPaused', on);
      applyAudioMute();
      rebuildMenus();
    }),
    { type: 'separator' },
    {
      label: t('menuUseFocus'),
      type: 'checkbox',
      checked: settings.get('focusEnabled'),
      click: (item) => { settings.set('focusEnabled', item.checked); settings.set('focusOverrideUntil', 0); dnd.changed(true); },
    },
    { label: t('menuEditFocus'), enabled: !lock.locked, click: () => { showWindow(); openSettings('focus'); } },
  ];
}

function settingToggle(label, key, onChange) {
  return {
    label,
    type: 'checkbox',
    checked: settings.get(key),
    click: (item) => {
      if (onChange) { onChange(item.checked); return; }
      settings.set(key, item.checked);
      rebuildMenus();
    },
  };
}

function lockItems() {
  const { locked } = lock;
  const openSetup = () => {
    if (settingsWin) settingsWin.close();
    showWindow();
    lock.startSetup();
  };
  if (!lock.enabled) return [{ label: t('menuTurnOnLock'), enabled: !locked, click: openSetup }];
  return [
    { label: t('menuLockNow'), accelerator: 'CmdOrCtrl+Shift+L', enabled: !locked, click: () => lock.lock() },
    {
      label: t('menuLockAfter'),
      enabled: !locked,
      submenu: LOCK_MINUTES.map((m) => ({
        label: m === 60 ? t('menuOneHour') : t('menuMinutes', { m }),
        type: 'radio',
        checked: settings.get('lockAfterMinutes') === m,
        click: () => settings.set('lockAfterMinutes', m),
      })),
    },
    { label: t('menuChangePw'), enabled: !locked, click: openSetup },
    { label: t('menuTurnOffLock'), enabled: !locked, click: () => lock.disable() },
  ];
}

function accountSwitchItems({ withShortcuts }) {
  const enabled = enabledAccountConfigs();
  if (enabled.length === 0) return [{ label: t('menuAllOff'), enabled: false }];
  return enabled.map((a, i) => {
    const acc = accounts.get(a.id);
    const unread = acc && acc.unread > 0 ? ` (${acc.unread})` : (acc && acc.unread === -1 ? ' (•)' : '');
    const svc = getService(a.service).label;
    const tag = a.name.toLowerCase().includes(svc.toLowerCase()) ? '' : ` [${svc}]`;
    return {
      label: `${a.name}${tag}${unread}`,
      type: 'radio',
      checked: a.id === activeId,
      enabled: !lock.locked,
      ...(withShortcuts && i < 9 ? { accelerator: `CmdOrCtrl+${i + 1}` } : {}),
      click: () => { switchAccount(a.id); showWindow(); },
    };
  });
}

function addServiceItems() {
  const atMax = settings.get('accounts').length >= MAX_ACCOUNTS;
  return SERVICE_LIST.map((svc) => ({
    label: svc.fullName,
    enabled: !lock.locked && !atMax,
    click: () => addAccount({ service: svc.id }),
  }));
}

function zoom(delta) {
  const acc = active();
  if (!acc) return;
  acc.wc.setZoomLevel(delta === 0 ? 0 : acc.wc.getZoomLevel() + delta);
}

function buildAppMenu() {
  const { locked } = lock;
  const cur = active();
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: t('menuSettings'), accelerator: 'Cmd+,', enabled: !locked, click: () => openSettings() },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : [{
      label: t('menuFile'),
      submenu: [
        { label: t('menuSettings'), accelerator: 'Ctrl+,', enabled: !locked, click: () => openSettings() },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }]),
    { role: 'editMenu' },
    {
      label: t('menuView'),
      submenu: [
        { label: t('menuHome'), accelerator: 'CmdOrCtrl+Shift+M', enabled: !locked && Boolean(cur), click: () => cur && cur.wc.loadURL(homeUrlFor(cur.service)) },
        { label: t('menuReload'), accelerator: 'CmdOrCtrl+R', enabled: Boolean(cur), click: () => cur && cur.wc.reload() },
        {
          label: t('menuShowSidebar'),
          type: 'checkbox',
          accelerator: 'CmdOrCtrl+Shift+S',
          checked: settings.get('showSidebar'),
          click: (item) => { settings.set('showSidebar', item.checked); applyVisibility(); rebuildMenus(); },
        },
        { type: 'separator' },
        { label: t('menuOpenBrowser'), enabled: !locked && Boolean(cur), click: () => cur && openExternal(cur.wc.getURL()) },
        { type: 'separator' },
        { label: t('menuActualSize'), accelerator: 'CmdOrCtrl+0', click: () => zoom(0) },
        { label: t('menuZoomIn'), accelerator: 'CmdOrCtrl+=', click: () => zoom(0.5) },
        { label: t('menuZoomOut'), accelerator: 'CmdOrCtrl+-', click: () => zoom(-0.5) },
        { type: 'separator' },
        { label: t('menuFullScreen'), accelerator: isMac ? 'Ctrl+Cmd+F' : 'F11', click: () => mainWindow && mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
        // DevTools would expose the page behind the lock screen.
        { label: t('menuDevTools'), accelerator: isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I', enabled: !locked && Boolean(cur), click: () => cur && cur.wc.toggleDevTools() },
      ],
    },
    {
      label: t('menuAccounts'),
      submenu: [
        ...accountSwitchItems({ withShortcuts: true }),
        { type: 'separator' },
        { label: t('menuAddAccount'), enabled: !locked && settings.get('accounts').length < MAX_ACCOUNTS, submenu: addServiceItems() },
        { label: t('menuManageAccounts'), enabled: !locked, click: () => openSettings('accounts') },
        { type: 'separator' },
        { label: cur ? t('menuLogoutAccount', { name: cur.name }) : t('menuLogoutGeneric'), enabled: !locked && Boolean(cur), click: () => logOutAccount() },
      ],
    },
    { label: t('menuNotifications'), submenu: pauseItems() },
    {
      label: t('menuSettingsTop'),
      submenu: [
        settingToggle(t('menuRunInBg'), 'runInBackground'),
        ...(process.platform !== 'linux' ? [settingToggle(t('menuOpenAtLogin'), 'openAtLogin', setOpenAtLogin)] : []),
        settingToggle(t('menuGlobalShortcut', { shortcut: SHORTCUT_LABEL }), 'globalShortcut', (on) => { settings.set('globalShortcut', on); applyGlobalShortcut(); rebuildMenus(); }),
        { type: 'separator' },
        settingToggle(t('menuHideTopBar'), 'hideTopBar', (on) => { settings.set('hideTopBar', on); applyCssAll(); rebuildMenus(); }),
        settingToggle(t('menuRestoreLastChat'), 'restoreLastChat', (on) => { settings.set('restoreLastChat', on); if (!on) settings.set('lastChats', {}); rebuildMenus(); }),
        { type: 'separator' },
        settingToggle(t('menuPrivacyScreen'), 'privacyScreen', (on) => { settings.set('privacyScreen', on); applyCssAll(); rebuildMenus(); }),
        settingToggle(t('menuPrivateMode'), 'ephemeral', (on) => setEphemeral(on)),
        { label: t('menuAppLock'), submenu: lockItems() },
        { type: 'separator' },
        { label: t('menuMoreSettings'), enabled: !locked, click: () => openSettings('appearance') },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function trayMenu() {
  if (!lock || !dnd) return [{ label: t('open', { app: APP_NAME }), click: () => showWindow() }];
  const total = totalUnread();
  const enabled = enabledAccountConfigs();
  return [
    { label: t('open', { app: APP_NAME }), click: () => showWindow() },
    ...(enabled.length > 1
      ? [{ type: 'separator' }, ...accountSwitchItems({ withShortcuts: false })]
      : total > 0 ? [{ label: t('unreadCount', { n: total }), enabled: false }] : []),
    { type: 'separator' },
    { label: t('menuNotifications'), submenu: pauseItems() },
    ...(lock.enabled ? [{ label: t('menuLockNow'), enabled: !lock.locked, click: () => lock.lock() }] : []),
    { type: 'separator' },
    { label: t('quit', { app: APP_NAME }), click: () => { isQuitting = true; app.quit(); } },
  ];
}

function rebuildMenus() {
  if (!lock || !dnd) return;
  buildAppMenu();
  if (tray) {
    const total = totalUnread();
    const anyUnread = hasAnyUnread();
    const count = total > 0 ? total : (anyUnread ? 1 : 0);
    tray.setUnread(count, {
      paused: dnd.isPaused(),
      unreadText: total > 0 ? t('unreadCount', { n: total }) : t('unreadCount', { n: '•' }),
      pausedText: t('notificationsPaused'),
    });
  }
}

// ---------------------------------------------------------------- startup

// Windows only shows notifications for apps with a Start menu shortcut that
// carries the app's AppUserModelID. The zip install has none, so the app
// creates (or refreshes) its own.
function ensureWindowsShortcut() {
  if (!isWin || !app.isPackaged) return;
  const lnk = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', `${APP_NAME}.lnk`);
  shell.writeShortcutLink(lnk, 'create', {
    target: process.execPath,
    cwd: path.dirname(process.execPath),
    appUserModelId: APP_ID,
    description: APP_NAME,
    icon: process.execPath,
    iconIndex: 0,
  });
}

function startedHidden() {
  if (!settings.get('runInBackground')) return false;
  if (process.argv.includes('--hidden')) return true;
  return isMac && app.getLoginItemSettings().wasOpenedAtLogin === true;
}

let saveBoundsTimer = null;
function saveBounds() {
  if (!mainWindow || mainWindow.isMaximized() || mainWindow.isFullScreen() || mainWindow.isMinimized()) return;
  clearTimeout(saveBoundsTimer);
  saveBoundsTimer = setTimeout(() => {
    if (mainWindow) settings.set('bounds', mainWindow.getNormalBounds());
  }, 500);
}

function createWindow({ show }) {
  mainWindow = new BaseWindow({
    width: 1100,
    height: 780,
    ...(settings.get('bounds') || {}),
    minWidth: 520,
    minHeight: 400,
    show,
    title: `${TITLE_PREFIX}${APP_NAME}`,
    backgroundColor: surfaceBgHex(),
    autoHideMenuBar: true,
  });
  mainWindow.on('resize', () => { layout(); saveBounds(); });
  mainWindow.on('move', saveBounds);
  mainWindow.on('focus', () => { applyCssAll(); focusActive(); });
  mainWindow.on('blur', () => applyCssAll());

  // Run in background: closing the window hides it; quit from the tray or menu.
  mainWindow.on('close', (e) => {
    if (isQuitting) return;
    if (!settings.get('runInBackground')) { isQuitting = true; app.quit(); return; }
    e.preventDefault();
    mainWindow.hide();
    if (isWin && !settings.get('trayHintShown')) {
      tray.displayBalloon(t('balloonStillRunning', { app: APP_NAME }), t('balloonDetail'));
      settings.set('trayHintShown', true);
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });

  sidebar = new Sidebar(mainWindow, {
    getState: sidebarState,
    handlers: {
      switchAccount: (id) => switchAccount(id),
      openAddMenu: () => openAddMenu(),
      openAccountMenu: (id) => openAccountMenu(id),
      openDndMenu: () => openDndMenu(),
      openSettings: () => toggleSettings('accounts'),
      lockNow: () => lock && lock.lock(),
    },
  });
  sidebar.setBackgroundColor(railBgHex());

  settingsWin = new SettingsWindow(mainWindow, {
    getState: settingsState,
    getBgColor: surfaceBgHex,
    handlers: {
      addAccount: (p) => addAccount({ ...p, stayInSettings: true }),
      renameAccount,
      toggleAccount,
      removeAccount,
      setFocus: setFocusSchedule,
      setAppearance,
    },
    onOpen: () => {
      applyVisibility();
      refreshStatus();
      if (overlay) overlay.raise();
      pushUi();
    },
    onClose: () => {
      applyVisibility();
      refreshStatus();
      focusActive();
      pushUi();
    },
  });
  settingsWin.setBackgroundColor(surfaceBgHex());

  overlay = new Overlay(mainWindow, {
    unlock: (pw) => lock.tryPassword(pw),
    touchId: () => lock.tryTouchId(),
    setPassword: (pw) => lock.finishSetup(pw),
    cancel: () => lock.cancelSetup(),
    retry: () => active() && active().recovery.retryNow(),
    reset: () => resetEverything(),
    openSettings: () => openSettings('accounts'),
  }, () => { if (active()) active().wc.focus(); }, uiThemeState);
  overlay.setBackgroundColor(surfaceBgHex());
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  app.on('web-contents-created', (_e, wc) => {
    // No <webview> tags anywhere: they would bypass the guards below.
    wc.on('will-attach-webview', (event) => event.preventDefault());
    if (wc.getType() === 'window') guardContents(wc);
  });

  app.whenReady().then(() => {
    if (isWin) app.setAppUserModelId(APP_ID);
    settings = new Settings(app.getPath('userData'));
    ephemeral = settings.get('ephemeral');
    nativeTheme.themeSource = settings.get('appearance');
    nativeTheme.on('updated', () => applyAppearance());
    ensureWindowsShortcut();

    dnd = new Dnd({
      settings,
      onChange: () => {
        applyAudioMute();
        rebuildMenus();
        pushUi();
      },
    });
    tray = new AppTray({ appName: APP_NAME, toggleWindow, buildMenu: trayMenu });

    createWindow({ show: !startedHidden() });
    lock = new AppLock({
      settings,
      overlay,
      appName: APP_NAME,
      onChange: () => {
        applyVisibility();
        if (lock.locked && settingsWin) settingsWin.close();
        if (!lock.locked) focusActive();
        rebuildMenus();
        pushUi();
      },
    });

    const configured = settings.get('accounts');
    for (const a of configured) {
      if (a.enabled) mountAccountView(a);
    }
    const savedActive = settings.get('activeAccount');
    activeId = accounts.has(savedActive) ? savedActive : (accounts.keys().next().value || null);
    if (activeId) switchAccount(activeId);
    else {
      applyVisibility();
      refreshStatus();
      updateTitle();
    }
    if (lock.enabled) lock.lock();
    applyAudioMute();
    rebuildMenus();
    pushUi();
    applyGlobalShortcut();

    app.on('activate', () => showWindow());
    // macOS: clicking a notification or the app in the Dock/app switcher brings
    // back a window that was hidden to the menu bar.
    if (isMac) app.on('did-become-active', () => { if (mainWindow && !mainWindow.isVisible()) showWindow(); });
  });

  app.on('before-quit', () => { isQuitting = true; });
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });
  app.on('window-all-closed', () => app.quit());
}
