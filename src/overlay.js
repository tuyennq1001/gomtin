'use strict';

// A local page (src/ui/overlay.html) layered over the Facebook pages for the
// lock screen, password setup and connection/crash recovery. Created only
// while something is shown, and released afterwards, so it costs no memory
// the rest of the time.
//
// Together with the settings window, this is the only page in the app with a
// preload script and IPC. Facebook's pages never get either. IPC requests are
// accepted only from this view's own webContents and only for ACTIONS.

const { WebContentsView, ipcMain } = require('electron');
const path = require('path');
const { registerAppPage, isAppPage } = require('./app-pages');

// Highest priority first: a locked app never reveals anything else.
const LAYERS = ['lock', 'setup', 'crashed', 'offline', 'empty'];
const ACTIONS = new Set(['getState', 'unlock', 'touchId', 'setPassword', 'cancel', 'retry', 'reset', 'openSettings']);

class Overlay {
  /**
   * @param {BaseWindow} win
   * @param {Record<string, Function>} handlers  action name -> async (payload) => result
   * @param {Function} focusContent  gives keyboard focus back to the page below
   */
  constructor(win, handlers, focusContent, getTheme = null) {
    this.win = win;
    this.handlers = handlers;
    this.focusContent = focusContent;
    this.getTheme = getTheme;
    this.layers = new Map();
    this.view = null;
    this.insetLeft = 0;
    this.bgColor = '#151821';

    win.on('resize', () => this.layout());

    ipcMain.handle('overlay', async (event, action, payload) => {
      if (!this.view || event.sender !== this.view.webContents || !ACTIONS.has(action)) throw new Error('Rejected');
      if (action === 'getState') return this.state();
      const fn = this.handlers[action];
      return fn ? fn(payload) : null;
    });
  }

  get visible() {
    return this.view !== null;
  }

  createView() {
    this.view = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, 'ui', 'overlay-preload.js'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        spellcheck: false,
      },
    });
    // Opaque from the first frame, before the page has loaded.
    this.view.setBackgroundColor(this.bgColor);
    const wc = this.view.webContents;
    registerAppPage(wc);
    // The overlay never navigates or opens windows.
    wc.on('will-navigate', (e) => e.preventDefault());
    wc.setWindowOpenHandler(() => ({ action: 'deny' }));
    wc.on('did-finish-load', () => { this.push(); if (this.win.isFocused()) wc.focus(); });
    wc.loadFile(path.join(__dirname, 'ui', 'overlay.html'));
  }

  setBackgroundColor(hex) {
    if (!hex) return;
    this.bgColor = hex;
    if (this.view) this.view.setBackgroundColor(hex);
  }

  top() {
    return LAYERS.find((name) => this.layers.has(name)) ?? null;
  }

  state() {
    const name = this.top();
    const theme = this.getTheme ? this.getTheme() : null;
    return name ? { mode: name, theme, ...this.layers.get(name) } : { mode: null, theme };
  }

  setLayer(name, data) {
    if (!LAYERS.includes(name)) throw new Error(`Unknown overlay layer ${name}`);
    if (data) this.layers.set(name, data); else this.layers.delete(name);
    this.update();
  }

  has(name) {
    return this.layers.has(name);
  }

  update() {
    const show = this.top() !== null;
    if (show && !this.view) {
      this.createView();
      this.win.contentView.addChildView(this.view);
      this.layout();
    } else if (!show && this.view) {
      this.win.contentView.removeChildView(this.view);
      const wc = this.view.webContents;
      this.view = null;
      if (wc && !wc.isDestroyed()) wc.close();
      this.focusContent();
      return;
    }
    this.push();
    if (show && this.win.isFocused()) this.view.webContents.focus();
  }

  // Keep the overlay above views added after it (e.g. a new account).
  raise() {
    if (!this.view) return;
    this.win.contentView.removeChildView(this.view);
    this.win.contentView.addChildView(this.view);
    this.layout();
  }

  layout(insetLeft = this.insetLeft) {
    this.insetLeft = insetLeft;
    if (!this.view) return;
    const [width, height] = this.win.getContentSize();
    // Lock and setup cover the entire window (including the sidebar);
    // offline, crashed and empty only cover the active chat pane.
    const mode = this.top();
    const x = mode === 'lock' || mode === 'setup' ? 0 : this.insetLeft;
    this.view.setBounds({ x, y: 0, width: Math.max(0, width - x), height });
  }

  push() {
    const wc = this.view && this.view.webContents;
    if (wc && !wc.isDestroyed()) wc.send('overlay:state', this.state());
  }

  focus() {
    if (this.view) this.view.webContents.focus();
  }

  destroy() {
    ipcMain.removeHandler('overlay');
    const wc = this.view && this.view.webContents;
    if (wc && !wc.isDestroyed()) wc.close();
    this.view = null;
  }
}

module.exports = { Overlay, isAppPage, LAYERS, ACTIONS };
