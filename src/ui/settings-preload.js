'use strict';

// Preload for the app's own embedded settings view only (never for chat web pages).

const { contextBridge, ipcRenderer } = require('electron');

const call = (action, payload) => ipcRenderer.invoke('settings-ui', action, payload);

contextBridge.exposeInMainWorld('settingsApi', {
  getState: () => call('getState'),
  addAccount: (service) => call('addAccount', { service: String(service || 'messenger') }),
  renameAccount: (id, name) => call('renameAccount', { id: String(id), name: String(name) }),
  toggleAccount: (id, enabled) => call('toggleAccount', { id: String(id), enabled: Boolean(enabled) }),
  removeAccount: (id) => call('removeAccount', { id: String(id) }),
  setFocus: (enabled, rules) => call('setFocus', { enabled: Boolean(enabled), rules: JSON.parse(JSON.stringify(rules)) }),
  setAppearance: (patch) => call('setAppearance', {
    ...(patch && patch.themeColor !== undefined ? { themeColor: String(patch.themeColor) } : {}),
    ...(patch && patch.appearance !== undefined ? { appearance: String(patch.appearance) } : {}),
    ...(patch && patch.language !== undefined ? { language: String(patch.language) } : {}),
  }),
  close: () => call('close'),
  onState: (cb) => ipcRenderer.on('settings:state', (_e, state) => cb(state)),
  onSection: (cb) => ipcRenderer.on('settings:section', (_e, section) => cb(section)),
});
