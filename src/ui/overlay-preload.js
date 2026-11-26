'use strict';

// Preload for the app's own overlay page only (never for Facebook's pages).
// Exposes a fixed set of calls; arguments are coerced to strings.

const { contextBridge, ipcRenderer } = require('electron');

const call = (action, payload) => ipcRenderer.invoke('overlay', action, payload);

contextBridge.exposeInMainWorld('overlay', {
  getState: () => call('getState'),
  unlock: (password) => call('unlock', String(password)),
  touchId: () => call('touchId'),
  setPassword: (password) => call('setPassword', String(password)),
  cancel: () => call('cancel'),
  retry: () => call('retry'),
  reset: () => call('reset'),
  openSettings: () => call('openSettings'),
  onState: (callback) => ipcRenderer.on('overlay:state', (_event, state) => callback(state)),
});
