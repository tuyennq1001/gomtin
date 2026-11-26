'use strict';

const { BaseWindow, desktopCapturer, dialog } = require('electron');
const { isServiceUrl } = require('./routes');

const MAX_SOURCES = 12;

function label(source) {
  const name = source.name.length > 48 ? `${source.name.slice(0, 45)}...` : source.name;
  return source.id.startsWith('screen:') ? `Screen: ${name}` : `Window: ${name}`;
}

// Fallback picker for getDisplayMedia() where the OS has no native picker
// (Windows, Linux, macOS < 15). Scoped to the account's own service origins.
function createDisplayMediaHandler(serviceId = 'messenger') {
  return async function handleDisplayMediaRequest(request, callback) {
    // Only the account's own service frames may ask to capture the screen.
    if (!isServiceUrl(request.securityOrigin, serviceId)) return callback(null);
    try {
      const sources = (await desktopCapturer.getSources({ types: ['screen', 'window'] }))
        .filter((s) => s.name)
        .slice(0, MAX_SOURCES);
      if (sources.length === 0) return callback(null);

      const options = {
        type: 'question',
        title: 'Share your screen',
        message: 'Choose what to share',
        buttons: [...sources.map(label), 'Cancel'],
        cancelId: sources.length,
        noLink: false,
      };
      const parent = BaseWindow.getFocusedWindow();
      const { response } = parent
        ? await dialog.showMessageBox(parent, options)
        : await dialog.showMessageBox(options);
      if (response >= sources.length) return callback(null);

      const stream = { video: sources[response] };
      // System audio loopback is only supported on Windows.
      if (process.platform === 'win32') stream.audio = 'loopback';
      return callback(stream);
    } catch {
      return callback(null);
    }
  };
}

const handleDisplayMediaRequest = createDisplayMediaHandler('messenger');

module.exports = { handleDisplayMediaRequest, createDisplayMediaHandler };
