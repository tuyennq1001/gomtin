'use strict';

// Supported chat services. Kept free of Electron imports so route/settings/unit
// tests can validate every service cleanly without spawning Electron.

const DEFAULT_SERVICE = 'messenger';

const SERVICES = Object.freeze({
  messenger: Object.freeze({
    id: 'messenger',
    label: 'Messenger',
    fullName: 'Facebook Messenger',
    homeUrl: 'https://www.facebook.com/messages/',
    originDomains: Object.freeze(['facebook.com', 'messenger.com']),
    hosts: new Set([
      'facebook.com', 'www.facebook.com', 'web.facebook.com', 'm.facebook.com',
      'accountscenter.facebook.com',
      'messenger.com', 'www.messenger.com',
    ]),
    fullAllowHosts: new Set([
      'messenger.com', 'www.messenger.com', 'accountscenter.facebook.com',
    ]),
    allowedPrefixes: Object.freeze([
      '/messages', '/t', '/groupcall', '/videocall', '/messenger_call', '/rtc',
      '/login', '/checkpoint', '/two_step_verification', '/two_factor', '/auth_platform',
      '/recover', '/confirmemail', '/privacy/consent', '/cookie', '/logout', '/security',
      '/encrypted_backups', '/secure_storage', '/e2ee',
      '/messenger_media', '/photo',
    ]),
    callPrefixes: Object.freeze(['/groupcall', '/videocall', '/messenger_call', '/rtc']),
    feedPaths: new Set(['/', '/home.php', '/index.php']),
    feedPrefixes: Object.freeze([
      '/watch', '/reel', '/reels', '/marketplace', '/gaming', '/stories', '/feeds',
      '/groups/feed', '/notifications', '/friends', '/memories', '/bookmarks',
    ]),
    downloadDomains: Object.freeze(['fbsbx.com']),
    linkShimHosts: new Set(['l.facebook.com', 'lm.facebook.com']),
    supportsHideTopBar: true,
    supportsLastChat: true,
  }),
  zalo: Object.freeze({
    id: 'zalo',
    label: 'Zalo',
    fullName: 'Zalo Web',
    homeUrl: 'https://chat.zalo.me/',
    originDomains: Object.freeze(['zalo.me', 'zaloapp.com']),
    hosts: new Set([
      'chat.zalo.me', 'id.zalo.me', 'accounts.zalo.me', 'zalo.me', 'www.zalo.me',
      'oauth.zaloapp.com',
    ]),
    fullAllowHosts: new Set([
      'chat.zalo.me', 'id.zalo.me', 'accounts.zalo.me', 'zalo.me', 'www.zalo.me',
      'oauth.zaloapp.com',
    ]),
    allowedPrefixes: Object.freeze([]),
    callPrefixes: Object.freeze([]),
    feedPaths: new Set(),
    feedPrefixes: Object.freeze([]),
    downloadDomains: Object.freeze(['zdn.vn', 'zadn.vn']),
    linkShimHosts: new Set(),
    supportsHideTopBar: false,
    supportsLastChat: false,
  }),
  telegram: Object.freeze({
    id: 'telegram',
    label: 'Telegram',
    fullName: 'Telegram Web',
    homeUrl: 'https://web.telegram.org/a/',
    originDomains: Object.freeze(['web.telegram.org', 'webz.telegram.org', 'webk.telegram.org']),
    hosts: new Set([
      'web.telegram.org', 'webz.telegram.org', 'webk.telegram.org',
    ]),
    fullAllowHosts: new Set([
      'web.telegram.org', 'webz.telegram.org', 'webk.telegram.org',
    ]),
    allowedPrefixes: Object.freeze([]),
    callPrefixes: Object.freeze([]),
    feedPaths: new Set(),
    feedPrefixes: Object.freeze([]),
    downloadDomains: Object.freeze([]),
    linkShimHosts: new Set(),
    supportsHideTopBar: false,
    supportsLastChat: false,
  }),
});

const SERVICE_LIST = Object.freeze(Object.values(SERVICES));

function isValidService(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(SERVICES, id);
}

function getService(id) {
  return isValidService(id) ? SERVICES[id] : SERVICES[DEFAULT_SERVICE];
}

module.exports = { SERVICES, SERVICE_LIST, DEFAULT_SERVICE, isValidService, getService };
