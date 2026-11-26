'use strict';

// Embedded Settings pane (src/ui/settings.html) rendered inside the main
// window alongside the left sidebar. Created on demand when opened and
// destroyed when closed so it consumes zero memory while hidden.
//
// Like overlay.js and sidebar.js, this is a local-file-only app view with its
// own preload and strictly whitelisted IPC. Chat pages never get this IPC.

const { WebContentsView, ipcMain } = require('electron');
const path = require('path');
const { registerAppPage } = require('./app-pages');

const ACTIONS = new Set([
  'getState', 'addAccount', 'renameAccount', 'toggleAccount', 'removeAccount',
  'setFocus', 'setAppearance', 'checkUpdates', 'installUpdate', 'setAutoUpdate', 'openReleasePage', 'close',
]);

class SettingsWindow {
  /**
   * @param {BaseWindow} win
   * @param {object} opts { getState(), getBgColor?(), handlers, onOpen?(), onClose?() }
   */
  constructor(win, { getState, getBgColor, handlers, onOpen, onClose }) {
    this.win = win;
    this.getState = getState;
    this.getBgColor = getBgColor;
    this.handlers = handlers;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.view = null;
    this.insetLeft = 0;
    this.pendingSection = null;
    this.bgColor = '#151821';

    ipcMain.handle('settings-ui', async (event, action, payload) => {
      if (!this.view || this.view.webContents.isDestroyed() || event.sender !== this.view.webContents || !ACTIONS.has(action)) {
        throw new Error('Rejected');
      }
      if (action === 'getState') return this.getState();
      if (action === 'close') {
        this.close();
        return { ok: true };
      }
      const result = await this.handlers[action](payload);
      this.push();
      return result;
    });
  }

  get visible() {
    return this.view !== null;
  }

  setBackgroundColor(hex) {
    if (!hex) return;
    this.bgColor = hex;
    if (this.view) this.view.setBackgroundColor(hex);
  }

  open(section) {
    this.pendingSection = section || null;
    if (this.view && !this.view.webContents.isDestroyed()) {
      this.view.webContents.send('settings:section', this.pendingSection);
      this.raise();
      if (this.win && !this.win.isDestroyed() && this.win.isFocused()) this.view.webContents.focus();
      return;
    }

    this.view = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, 'ui', 'settings-preload.js'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        spellcheck: false,
      },
    });
    this.view.setBackgroundColor((this.getBgColor && this.getBgColor()) || this.bgColor);

    const wc = this.view.webContents;
    registerAppPage(wc);
    wc.on('will-navigate', (e) => e.preventDefault());
    wc.setWindowOpenHandler(() => ({ action: 'deny' }));
    wc.on('did-finish-load', () => {
      this.push();
      if (this.pendingSection) wc.send('settings:section', this.pendingSection);
      if (this.win && !this.win.isDestroyed() && this.win.isFocused()) wc.focus();
    });
    wc.loadFile(path.join(__dirname, 'ui', 'settings.html'));

    this.win.contentView.addChildView(this.view);
    this.layout();
    if (this.onOpen) this.onOpen();
  }

  toggle(section) {
    if (this.visible) this.close();
    else this.open(section);
  }

  raise() {
    if (!this.view || !this.win || this.win.isDestroyed()) return;
    this.win.contentView.removeChildView(this.view);
    this.win.contentView.addChildView(this.view);
    this.layout();
  }

  layout(insetLeft = this.insetLeft) {
    this.insetLeft = insetLeft;
    if (!this.view || !this.win || this.win.isDestroyed()) return;
    const [width, height] = this.win.getContentSize();
    this.view.setBounds({ x: this.insetLeft, y: 0, width: Math.max(0, width - this.insetLeft), height });
  }

  push() {
    const wc = this.view && this.view.webContents;
    if (wc && !wc.isDestroyed()) wc.send('settings:state', this.getState());
  }

  focus() {
    const wc = this.view && this.view.webContents;
    if (wc && !wc.isDestroyed()) wc.focus();
  }

  close() {
    if (!this.view) return;
    const view = this.view;
    this.view = null;
    this.pendingSection = null;
    if (this.win && !this.win.isDestroyed()) this.win.contentView.removeChildView(view);
    const wc = view.webContents;
    if (wc && !wc.isDestroyed()) wc.close();
    if (this.onClose) this.onClose();
  }

  destroy() {
    ipcMain.removeHandler('settings-ui');
    this.close();
  }
}

module.exports = { SettingsWindow, ACTIONS };
