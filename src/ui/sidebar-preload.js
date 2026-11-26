'use strict';

// Preload for the app's own sidebar view only (never for chat web pages).
// Exposes a fixed set of actions over the isolated sidebar IPC channel.

const { contextBridge, ipcRenderer } = require('electron');

const call = (action, payload) => ipcRenderer.invoke('sidebar', action, payload);

contextBridge.exposeInMainWorld('sidebarApi', {
  getState: () => call('getState'),
  switchAccount: (id) => call('switchAccount', String(id)),
  openAddMenu: () => call('openAddMenu'),
  openAccountMenu: (id) => call('openAccountMenu', String(id)),
  openDndMenu: () => call('openDndMenu'),
  openSettings: () => call('openSettings'),
  lockNow: () => call('lockNow'),
  onState: (cb) => ipcRenderer.on('sidebar:state', (_e, state) => cb(state)),
});
