'use strict';

// Renders the isolated left sidebar dock and forwards clicks to the app
// through window.sidebarApi (see sidebar-preload.js).

(() => {
const $ = (id) => document.getElementById(id);
const api = window.sidebarApi;
const { tr } = window.GomTinI18n;
const isMac = /Mac/.test(navigator.platform);
const MOD_LABEL = isMac ? '⌘' : 'Ctrl+';

const SERVICE_NAMES = {
  messenger: 'Messenger',
  zalo: 'Zalo',
  telegram: 'Telegram',
};

function iconFor(service) {
  const tpl = document.getElementById(`icon-${service}`) || document.getElementById('icon-messenger');
  return tpl.content.firstElementChild.cloneNode(true);
}

function applyTheme(theme) {
  if (!theme) return;
  const root = document.documentElement;
  if (theme.themeColor) root.dataset.theme = theme.themeColor;
  if (theme.resolvedTheme) root.dataset.mode = theme.resolvedTheme;
  if (theme.language) root.lang = theme.language;
}

function render(state) {
  if (!state) return;
  applyTheme(state.theme);

  const lang = (state.theme && state.theme.language) || 'vi';
  const t = (key, vars) => tr(lang, key, vars);

  const devBadge = $('dev-badge');
  devBadge.hidden = !state.isDev;
  devBadge.title = t('devTooltip');

  const rail = $('account-rail');
  rail.replaceChildren();

  const enabledAccounts = Array.isArray(state.accounts) ? state.accounts : [];
  if (enabledAccounts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-dot';
    empty.textContent = '0';
    empty.title = t('sidebarEmptyTip');
    rail.appendChild(empty);
  } else {
    const perService = {};
    for (const acc of enabledAccounts) perService[acc.service] = (perService[acc.service] || 0) + 1;
    const seen = {};

    enabledAccounts.forEach((acc, idx) => {
      seen[acc.service] = (seen[acc.service] || 0) + 1;
      const wrap = document.createElement('div');
      wrap.className = 'acc-item';
      wrap.dataset.service = acc.service;
      if (acc.active && !state.settingsOpen) wrap.classList.add('active');
      if (acc.loading) wrap.classList.add('loading');

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rail-btn acc-btn';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(Boolean(acc.active && !state.settingsOpen)));

      const svcName = SERVICE_NAMES[acc.service] || acc.service;
      const shortcut = idx < 9 ? ` · ${MOD_LABEL}${idx + 1}` : '';
      const unreadTxt = acc.unread > 0
        ? ` (${t('unreadCount', { n: acc.unread })})`
        : (acc.unread === -1 ? ` (${t('unreadCount', { n: '•' })})` : '');
      btn.title = `${acc.name} — ${svcName}${shortcut}${unreadTxt}\n${t('sidebarRightClick')}`;
      btn.setAttribute('aria-label', `${acc.name} (${svcName})`);

      btn.appendChild(iconFor(acc.service));

      if (perService[acc.service] > 1) {
        const tag = document.createElement('span');
        tag.className = 'acc-tag';
        tag.textContent = String(seen[acc.service]);
        btn.appendChild(tag);
      }

      if (acc.unread > 0) {
        const badge = document.createElement('span');
        badge.className = 'acc-badge';
        badge.textContent = acc.unread > 99 ? '99+' : String(acc.unread);
        btn.appendChild(badge);
      } else if (acc.unread === -1) {
        const dot = document.createElement('span');
        dot.className = 'acc-badge dot';
        dot.setAttribute('aria-hidden', 'true');
        btn.appendChild(dot);
      }

      btn.addEventListener('click', () => api.switchAccount(acc.id));
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        api.openAccountMenu(acc.id);
      });

      wrap.appendChild(btn);
      rail.appendChild(wrap);
    });
  }

  const addBtn = $('add-btn');
  addBtn.disabled = Boolean(state.totalAccounts >= state.maxAccounts);
  addBtn.title = addBtn.disabled
    ? t('sidebarMaxTip', { max: state.maxAccounts })
    : t('sidebarAddTip');
  addBtn.setAttribute('aria-label', addBtn.title);

  const dndBtn = $('dnd-btn');
  dndBtn.classList.toggle('paused', Boolean(state.dndPaused));
  $('dnd-icon-on').toggleAttribute('hidden', Boolean(state.dndPaused));
  $('dnd-icon-off').toggleAttribute('hidden', !state.dndPaused);
  dndBtn.title = state.dndLabel || t('sidebarDndOn');
  dndBtn.setAttribute('aria-label', dndBtn.title);

  const lockBtn = $('lock-btn');
  lockBtn.hidden = !state.lockEnabled;
  lockBtn.title = t('sidebarLockTip');
  lockBtn.setAttribute('aria-label', lockBtn.title);

  const settingsBtn = $('settings-btn');
  settingsBtn.classList.toggle('active', Boolean(state.settingsOpen));
  settingsBtn.setAttribute('aria-pressed', String(Boolean(state.settingsOpen)));
  settingsBtn.title = t('sidebarSettingsTip', { mod: MOD_LABEL });
  settingsBtn.setAttribute('aria-label', settingsBtn.title);
}

$('add-btn').addEventListener('click', () => api.openAddMenu());
$('dnd-btn').addEventListener('click', () => api.openDndMenu());
$('lock-btn').addEventListener('click', () => api.lockNow());
$('settings-btn').addEventListener('click', () => api.openSettings());

api.onState(render);
api.getState().then(render).catch(() => {});
})();
