'use strict';

// Renders the overlay for the current mode and forwards user actions to the
// app through the preload API (window.overlay).

(() => {
const $ = (id) => document.getElementById(id);
const { tr } = window.GomTinI18n;
let current = null;
let lastLang = 'vi';
let lastAppName = 'GomTin';

function applyThemeAndText(theme) {
  if (!theme) return;
  const root = document.documentElement;
  if (theme.themeColor) root.dataset.theme = theme.themeColor;
  if (theme.resolvedTheme) root.dataset.mode = theme.resolvedTheme;
  if (theme.language) root.lang = theme.language;

  lastLang = theme.language || 'vi';
  lastAppName = theme.appName || 'GomTin';
  const t = (key, vars) => tr(lastLang, key, vars);

  document.title = lastAppName;
  $('overlay-dev').hidden = !theme.isDev;

  $('lock-title').textContent = t('lockTitle', { app: lastAppName });
  $('lock-sub').textContent = t('lockSub');
  $('lock-pw-label').textContent = t('lockPlaceholder');
  $('unlock-password').placeholder = t('lockPlaceholder');
  $('lock-submit').textContent = t('lockUnlock');
  $('touchid').textContent = t('lockTouchId');
  $('forgot').textContent = t('lockForgot');

  $('setup-title').textContent = t('setupTitle');
  $('setup-sub').textContent = t('setupSub', { app: lastAppName });
  $('setup-new-label').textContent = t('setupNewPw');
  $('setup-password').placeholder = t('setupNewPw');
  $('setup-confirm-label').textContent = t('setupConfirmPw');
  $('setup-confirm').placeholder = t('setupConfirmPw');
  $('setup-cancel').textContent = t('cancel');
  $('setup-submit').textContent = t('setupTurnOn');

  $('offline-sub').textContent = t('offlineSub', { app: lastAppName });
  $('offline-retry').textContent = t('offlineRetryNow');

  $('crashed-title').textContent = t('crashedTitle');
  $('crashed-sub').textContent = t('crashedSub');
  $('crashed-retry').textContent = t('reload');

  $('empty-title').textContent = t('emptyTitle');
  $('empty-sub').textContent = t('emptySub');
  $('empty-settings').textContent = t('emptyOpenSettings');
}

function render(state) {
  if (!state) return;
  applyThemeAndText(state.theme);
  const t = (key, vars) => tr(lastLang, key, vars);

  const mode = state.mode;
  for (const section of document.querySelectorAll('section[data-mode]')) {
    section.hidden = section.dataset.mode !== mode;
  }
  if (mode !== current) {
    for (const input of document.querySelectorAll('input')) input.value = '';
    $('unlock-error').textContent = '';
    $('setup-error').textContent = '';
    current = mode;
    const first = document.querySelector(`section[data-mode="${mode}"] input, section[data-mode="${mode}"] button`);
    if (first) first.focus();
  }
  if (mode === 'lock') $('touchid').hidden = !state.touchId;
  if (mode === 'offline') {
    $('offline-title').textContent = state.serviceName
      ? t('offlineTitle', { service: state.serviceName })
      : t('offlineTitleGeneric');
    $('offline-status').textContent = state.status || t('offlineRetrying');
  }
}

async function busy(button, fn) {
  button.disabled = true;
  try { return await fn(); } finally { button.disabled = false; }
}

$('unlock-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('unlock-password');
  const result = await busy(e.submitter || e.target.querySelector('button'), () => window.overlay.unlock(input.value));
  if (result && !result.ok) {
    $('unlock-error').textContent = result.error || tr(lastLang, 'lockWrongPw');
    input.select();
  }
});

$('touchid').addEventListener('click', (e) => busy(e.currentTarget, () => window.overlay.touchId()));
$('forgot').addEventListener('click', () => window.overlay.reset());

$('setup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = $('setup-password').value;
  if (pw !== $('setup-confirm').value) {
    $('setup-error').textContent = tr(lastLang, 'setupMismatch');
    return;
  }
  const result = await busy(e.submitter || e.target.querySelector('button[type=submit]'), () => window.overlay.setPassword(pw));
  if (result && !result.ok) $('setup-error').textContent = result.error || tr(lastLang, 'setupErr');
});
$('setup-cancel').addEventListener('click', () => window.overlay.cancel());

$('offline-retry').addEventListener('click', (e) => busy(e.currentTarget, () => window.overlay.retry()));
$('crashed-retry').addEventListener('click', (e) => busy(e.currentTarget, () => window.overlay.retry()));
$('empty-settings').addEventListener('click', () => window.overlay.openSettings());

window.overlay.onState(render);
window.overlay.getState().then(render).catch(() => {});
})();
