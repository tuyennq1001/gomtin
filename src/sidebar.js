'use strict';

// Left sidebar (src/ui/sidebar.html): fixed-width vertical account dock for
// switching between Messenger, Zalo and Telegram accounts, adding new services
// via "+", and quick DND / Lock / Settings actions.
//
// Like overlay.js and settings-window.js, this is a local-file-only app view
// with its own preload and strictly whitelisted IPC. Chat pages never get
// a preload or IPC.

const { WebContentsView, ipcMain } = require('electron');
const path = require('path');
const { registerAppPage } = require('./app-pages');

const SIDEBAR_WIDTH = 58;
const ACTIONS = new Set([
  'getState',
  'switchAccount',
  'openAddMenu',
  'openAccountMenu',
  'openDndMenu',
  'openSettings',
  'lockNow',
]);

class Sidebar {
  /**
   * @param {BaseWindow} win
   * @param {object} opts { getState(), handlers: Record<string, Function> }
   */
  constructor(win, { getState, handlers }) {
    this.win = win;
    this.getState = getState;
    this.handlers = handlers;
    this.visible = false;

    this.view = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, 'ui', 'sidebar-preload.js'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        spellcheck: false,
      },
    });
    this.view.setBackgroundColor('#141518');
    this.view.setVisible(false);

    const wc = this.view.webContents;
    registerAppPage(wc);
    wc.on('will-navigate', (e) => e.preventDefault());
    wc.setWindowOpenHandler(() => ({ action: 'deny' }));
    wc.on('did-finish-load', () => this.push());
    wc.loadFile(path.join(__dirname, 'ui', 'sidebar.html'));

    this.win.contentView.addChildView(this.view);

    ipcMain.handle('sidebar', async (event, action, payload) => {
      if (!this.view || this.view.webContents.isDestroyed() || event.sender !== this.view.webContents || !ACTIONS.has(action)) {
        throw new Error('Rejected');
      }
      if (action === 'getState') return this.getState();
      const fn = this.handlers[action];
      return fn ? fn(payload) : null;
    });
  }

  setVisible(on) {
    this.visible = Boolean(on);
    if (this.view) this.view.setVisible(this.visible);
  }

  setBackgroundColor(hex) {
    if (this.view && hex) this.view.setBackgroundColor(hex);
  }

  layout() {
    if (!this.view) return;
    const [, height] = this.win.getContentSize();
    this.view.setBounds({ x: 0, y: 0, width: SIDEBAR_WIDTH, height });
  }

  push() {
    const wc = this.view && this.view.webContents;
    if (wc && !wc.isDestroyed()) wc.send('sidebar:state', this.getState());
  }

  destroy() {
    ipcMain.removeHandler('sidebar');
    const wc = this.view && this.view.webContents;
    if (wc && !wc.isDestroyed()) wc.close();
    this.view = null;
  }
}

module.exports = { Sidebar, SIDEBAR_WIDTH, ACTIONS };
