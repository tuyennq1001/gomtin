'use strict';

// One chat account (Messenger, Zalo or Telegram): a WebContentsView with its
// own session partition, so accounts never share cookies or storage.
// Enabled accounts keep running in the background for notifications and unread
// counts; disabled accounts are destroyed to free RAM while keeping their
// partition on disk. Chat pages run sandboxed with contextIsolation and use
// ONLY the read-only chat-badge-preload.js to report a bounded integer unread
// count (-1..999) over 'chat:unread' — nothing is exposed to the web page.

const { WebContentsView, ipcMain } = require('electron');
const path = require('path');
const { Recovery } = require('./recovery');
const { DEFAULT_SERVICE, getService } = require('./services');
const { MAX_BADGE, parseTitleUnread, hasUnreadFavicon, combineUnread } = require('./unread');

const viewsByWebContents = new WeakMap();
let badgeIpcRegistered = false;

function ensureBadgeIpc() {
  if (badgeIpcRegistered || !ipcMain) return;
  badgeIpcRegistered = true;
  ipcMain.on('chat:unread', (event, count) => {
    const acc = viewsByWebContents.get(event.sender);
    if (!acc) return;
    if (!Number.isInteger(count) || count < -1 || count > MAX_BADGE) return;
    acc.setDomUnread(count);
  });
}

// The default account keeps the original partition so existing logins survive.
function partitionFor(id, ephemeral) {
  if (ephemeral) return `messenger-private-${id}`;
  return id === 'default' ? 'persist:messenger' : `persist:messenger-${id}`;
}

class AccountView {
  /**
   * @param {object} opts { id, name, service, ephemeral, startUrl(account), onUnread(account), onStatus(account), onLoading(account) }
   */
  constructor({ id, name, service = DEFAULT_SERVICE, ephemeral, startUrl, onUnread, onStatus, onLoading }) {
    ensureBadgeIpc();
    this.id = id;
    this.name = name;
    this.service = getService(service).id;
    this.partition = partitionFor(id, ephemeral);
    this.unread = 0;
    this.domUnread = 0;
    this.titleUnread = 0;
    this.faviconUnread = false;
    this.onUnread = onUnread;
    this.loading = true;
    this.status = { offline: null, crashed: null };
    this.css = { topbar: null, privacy: null };

    this.view = new WebContentsView({
      webPreferences: {
        partition: this.partition,
        preload: path.join(__dirname, 'ui', 'chat-badge-preload.js'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        spellcheck: true,
      },
    });
    this.view.setBackgroundColor('#111214');
    this.wc = this.view.webContents;
    viewsByWebContents.set(this.wc, this);

    this.wc.on('page-title-updated', (_e, title) => {
      this.titleUnread = parseTitleUnread(title);
      this.recomputeUnread();
    });
    this.wc.on('page-favicon-updated', (_e, favicons) => {
      this.faviconUnread = hasUnreadFavicon(favicons);
      this.recomputeUnread();
    });
    this.wc.on('did-start-navigation', (_e, _url, isInPlace, isMainFrame) => {
      if (isMainFrame && !isInPlace) {
        this.domUnread = 0;
        this.titleUnread = 0;
        this.faviconUnread = false;
        this.recomputeUnread();
      }
    });
    this.wc.on('did-finish-load', () => {
      this.titleUnread = parseTitleUnread(this.wc.getTitle());
      this.recomputeUnread();
    });

    const setLoading = (flag) => {
      if (this.loading !== flag) {
        this.loading = flag;
        if (onLoading) onLoading(this);
      }
    };
    this.wc.on('did-start-loading', () => setLoading(true));
    this.wc.on('did-stop-loading', () => setLoading(false));

    this.startUrl = () => startUrl(this);
    this.recovery = new Recovery({
      webContents: this.wc,
      startUrl: this.startUrl,
      onStatus: (layer, data) => { this.status[layer] = data; onStatus(this); },
    });
  }

  setDomUnread(count) {
    if (count === this.domUnread) return;
    this.domUnread = count;
    this.recomputeUnread();
  }

  recomputeUnread() {
    const next = combineUnread({
      dom: this.domUnread,
      title: this.titleUnread,
      favicon: this.faviconUnread,
    });
    if (next !== this.unread) {
      this.unread = next;
      this.onUnread(this);
    }
  }

  load() {
    this.wc.loadURL(this.startUrl());
  }

  async setCss(key, css, on) {
    if (this.wc.isDestroyed()) return;
    if (this.css[key]) {
      await this.wc.removeInsertedCSS(this.css[key]).catch(() => {});
      this.css[key] = null;
    }
    if (on) this.css[key] = await this.wc.insertCSS(css).catch(() => null);
  }

  destroy() {
    viewsByWebContents.delete(this.wc);
    this.recovery.destroy();
    if (!this.wc.isDestroyed()) this.wc.close();
  }
}

module.exports = { AccountView, partitionFor, parseTitleUnread };
