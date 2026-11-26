'use strict';

// Menu bar (macOS) / system tray (Windows, Linux) icon with unread state.

const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

const ASSETS = path.join(__dirname, 'assets');
const isMac = process.platform === 'darwin';

function load(name) {
  const img = nativeImage.createFromPath(path.join(ASSETS, `${name}.png`));
  if (isMac) img.setTemplateImage(true);
  return img;
}

class AppTray {
  /**
   * @param {object} handlers  { toggleWindow(), buildMenu(): MenuItemConstructorOptions[] }
   */
  constructor(handlers) {
    this.handlers = handlers;
    this.appName = handlers.appName || 'GomTin';
    this.unread = 0;
    this.icons = isMac
      ? { normal: load('trayTemplate'), unread: load('trayUnreadTemplate') }
      : { normal: load('tray'), unread: load('trayUnread') };
    this.tray = new Tray(this.icons.normal);
    this.tray.setToolTip(this.appName);
    // Left click toggles the window; right click (or click on macOS with a
    // modifier) shows the menu. On Linux most trays only support the menu.
    this.tray.on('click', () => this.handlers.toggleWindow());
    this.tray.on('right-click', () => this.tray.popUpContextMenu(this.menu()));
    if (process.platform === 'linux') this.refreshMenu();
  }

  menu() {
    return Menu.buildFromTemplate(this.handlers.buildMenu());
  }

  // Linux trays (AppIndicator) ignore click events and need a static menu.
  refreshMenu() {
    if (process.platform === 'linux') this.tray.setContextMenu(this.menu());
  }

  setUnread(count, { paused = false, unreadText, pausedText } = {}) {
    this.unread = count;
    this.tray.setImage(count > 0 ? this.icons.unread : this.icons.normal);
    if (isMac) this.tray.setTitle(count > 0 ? String(count) : '', { fontType: 'monospacedDigit' });
    const parts = [this.appName];
    if (count > 0) parts.push(unreadText || `${count} unread`);
    if (paused) parts.push(pausedText || 'notifications paused');
    this.tray.setToolTip(parts.join(' — '));
    this.refreshMenu();
  }

  displayBalloon(title, content) {
    if (process.platform === 'win32') {
      this.tray.displayBalloon({ title, content, icon: nativeImage.createFromPath(path.join(ASSETS, 'icon.png')) });
    }
  }

  destroy() {
    this.tray.destroy();
  }
}

module.exports = { AppTray };
