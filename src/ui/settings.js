'use strict';

// GomTin Settings Window: multi-service accounts (On/Off + IME-safe debounced
// rename), Focus schedule, and Buzzy-style Appearance (6 pastel themes,
// System/Light/Dark mode, Vietnamese/English). Communicates only via settingsApi.

(() => {
const $ = (id) => document.getElementById(id);
const api = window.settingsApi;
const { tr, getDict } = window.GomTinI18n;

const RENAME_DEBOUNCE_MS = 500;
// eslint-disable-next-line no-control-regex
const UNSAFE_NAME_CHARS_RE = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g;
const isMac = /Mac/.test(navigator.platform);
const KEYS_LABEL = isMac ? '⌘1…9' : 'Ctrl+1…9';

let state = null;
let rules = [];
let dirty = false;
let activeTab = 'accounts';
const accountRows = new Map();
let accountsMsgTimer = null;

function curLang() {
  return (state && state.theme && state.theme.language) || 'vi';
}

function t(key, vars) {
  return tr(curLang(), key, vars);
}

// ---- Pill tabs

function setTab(tab) {
  const valid = tab === 'focus' || tab === 'appearance' ? tab : 'accounts';
  activeTab = valid;
  for (const btn of document.querySelectorAll('.pill-tab')) {
    btn.setAttribute('aria-selected', String(btn.dataset.tab === valid));
  }
  for (const panel of document.querySelectorAll('.tab-panel')) {
    panel.hidden = panel.dataset.panel !== valid;
  }
}

for (const btn of document.querySelectorAll('.pill-tab')) {
  btn.addEventListener('click', () => setTab(btn.dataset.tab));
}

// ---- Theme & Localization

function applyThemeAndLocale() {
  const theme = (state && state.theme) || {};
  const root = document.documentElement;
  if (theme.themeColor) root.dataset.theme = theme.themeColor;
  if (theme.resolvedTheme) root.dataset.mode = theme.resolvedTheme;
  const lang = curLang();
  root.lang = lang;

  const appName = (state && state.appName) || 'GomTin';
  document.title = t('settingsTitle', { app: appName });
  $('brand-name').textContent = appName;
  $('back-label').textContent = t('backToChat');
  $('back-btn').title = t('backToChatTip');
  $('back-btn').setAttribute('aria-label', t('backToChatTip'));
  $('header-dev').hidden = !(state && state.isDev);
  $('dev-banner').hidden = !(state && state.isDev);
  $('dev-banner-title').textContent = t('devBannerTitle');
  $('dev-banner-body').textContent = t('devBannerBody');

  $('tab-label-accounts').textContent = t('tabAccounts');
  $('tab-label-focus').textContent = t('tabFocus');
  $('tab-label-appearance').textContent = t('tabAppearance');

  $('accounts-title').textContent = t('accountsHeading');
  $('accounts-sub').textContent = t('accountsSub', { keys: KEYS_LABEL });
  $('accounts-add-label').textContent = t('accountsAddLabel');

  $('focus-title').textContent = t('focusHeading');
  $('focus-sub').textContent = t('focusSub');
  $('focus-enable-label').textContent = t('focusEnableLabel');
  $('focus-enable-sub').textContent = t('focusEnableSub');
  $('add-rule').textContent = t('focusAddRule');
  $('save-focus').textContent = t('focusSave');

  $('theme-card-title').textContent = t('themeCardTitle');
  $('theme-card-sub').textContent = t('themeCardSub');
  $('mode-card-title').textContent = t('modeCardTitle');
  $('mode-card-sub').textContent = t('modeCardSub');
  $('lang-card-title').textContent = t('langCardTitle');
  $('lang-card-sub').textContent = t('langCardSub');
  $('mode-system').textContent = t('modeSystem');
  $('mode-light').textContent = t('modeLight');
  $('mode-dark').textContent = t('modeDark');

  const themeNames = getDict(lang).themeNames || {};
  for (const el of document.querySelectorAll('[data-color-label]')) {
    const c = el.dataset.colorLabel;
    if (themeNames[c]) el.textContent = themeNames[c];
  }

  for (const chip of document.querySelectorAll('.theme-chip')) {
    chip.setAttribute('aria-checked', String(chip.dataset.color === theme.themeColor));
  }
  for (const btn of document.querySelectorAll('[data-appearance]')) {
    btn.setAttribute('aria-checked', String(btn.dataset.appearance === theme.appearance));
  }
  for (const btn of document.querySelectorAll('[data-lang]')) {
    btn.setAttribute('aria-checked', String(btn.dataset.lang === lang));
  }
}

// ---- Accounts

function cleanAccountName(raw) {
  return String(raw || '').replace(UNSAFE_NAME_CHARS_RE, '').trim().slice(0, 40);
}

function setAccountsMessage(text, { isError = false, autoClearMs = 0 } = {}) {
  if (accountsMsgTimer) {
    clearTimeout(accountsMsgTimer);
    accountsMsgTimer = null;
  }
  const el = $('accounts-error');
  el.textContent = text || '';
  el.classList.toggle('error', Boolean(text && isError));
  el.classList.toggle('saved', Boolean(text && !isError));
  el.setAttribute('role', isError ? 'alert' : 'status');
  if (text && autoClearMs > 0) {
    accountsMsgTimer = setTimeout(() => {
      accountsMsgTimer = null;
      if (el.textContent === text && el.classList.contains('saved')) {
        el.textContent = '';
        el.classList.remove('saved');
      }
    }, autoClearMs);
  }
}

async function commitRename(id, { revertIfEmpty = false } = {}) {
  const entry = accountRows.get(id);
  if (!entry) return;
  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }

  const raw = entry.input.value;
  const cleaned = cleanAccountName(raw);

  if (!cleaned) {
    if (revertIfEmpty) {
      entry.input.value = entry.savedName;
      if ($('accounts-error').getAttribute('role') === 'alert') setAccountsMessage('');
    }
    return;
  }

  if (cleaned === entry.savedName) {
    if (revertIfEmpty && raw !== entry.savedName) entry.input.value = entry.savedName;
    return;
  }

  if (entry.saving && cleaned === entry.pendingName) return;

  entry.seq += 1;
  const seq = entry.seq;
  entry.saving = true;
  entry.pendingName = cleaned;

  let result;
  try {
    result = await api.renameAccount(id, raw);
  } catch {
    result = { ok: false, error: t('errRename') };
  }

  if (accountRows.get(id) !== entry || entry.seq !== seq) return;
  entry.saving = false;
  entry.pendingName = null;

  if (result && result.ok) {
    entry.savedName = cleaned;
    if (document.activeElement !== entry.input && entry.input.value !== cleaned) {
      entry.input.value = cleaned;
    }
    setAccountsMessage(t('saved'), { isError: false, autoClearMs: 1500 });
  } else {
    setAccountsMessage((result && result.error) || t('errRename'), { isError: true });
    if (revertIfEmpty) entry.input.value = entry.savedName;
  }
}

function scheduleRename(id) {
  const entry = accountRows.get(id);
  if (!entry) return;
  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    entry.timer = null;
    commitRename(id, { revertIfEmpty: false });
  }, RENAME_DEBOUNCE_MS);
}

function flushPendingRenames() {
  for (const [id, entry] of accountRows.entries()) {
    if (entry.timer || document.activeElement === entry.input) {
      commitRename(id, { revertIfEmpty: false });
    }
  }
}

function serviceIconNode(service) {
  const tpl = document.getElementById(`tpl-icon-${service}`) || document.getElementById('tpl-icon-messenger');
  return tpl.content.firstElementChild.cloneNode(true);
}

function createAccountRow(acc) {
  const row = $('account-row').content.firstElementChild.cloneNode(true);
  row.dataset.id = acc.id;

  const toggleWrap = row.querySelector('.toggle-wrap');
  const toggle = row.querySelector('.toggle');
  const iconSlot = row.querySelector('.row-icon-slot');
  const input = row.querySelector('.name');
  const chip = row.querySelector('.state-chip');
  const badge = row.querySelector('.badge');
  const remove = row.querySelector('.remove');

  input.dataset.id = acc.id;
  input.value = acc.name;

  const entry = {
    row,
    toggleWrap,
    toggle,
    iconSlot,
    service: null,
    input,
    chip,
    badge,
    remove,
    savedName: acc.name,
    timer: null,
    composing: false,
    saving: false,
    pendingName: null,
    seq: 0,
  };

  toggle.addEventListener('change', async () => {
    toggle.disabled = true;
    try {
      const result = await api.toggleAccount(acc.id, toggle.checked);
      setAccountsMessage(result && !result.ok && result.error ? result.error : '', { isError: true });
    } finally {
      toggle.disabled = false;
    }
  });

  input.addEventListener('compositionstart', () => {
    entry.composing = true;
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
  });
  input.addEventListener('compositionend', () => {
    entry.composing = false;
    scheduleRename(acc.id);
  });
  input.addEventListener('input', () => {
    if (!entry.composing) scheduleRename(acc.id);
  });
  input.addEventListener('keydown', (e) => {
    if (e.isComposing || entry.composing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename(acc.id, { revertIfEmpty: true });
      input.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (entry.timer) {
        clearTimeout(entry.timer);
        entry.timer = null;
      }
      input.value = entry.savedName;
      input.blur();
    }
  });
  input.addEventListener('blur', () => {
    entry.composing = false;
    commitRename(acc.id, { revertIfEmpty: true });
  });

  remove.addEventListener('click', async () => {
    const result = await api.removeAccount(acc.id);
    setAccountsMessage(result && !result.ok && result.error ? result.error : '', { isError: true });
  });

  return entry;
}

function renderAccounts() {
  const list = $('account-list');
  const activeCount = state.accounts.filter((a) => a.enabled).length;
  $('account-count').textContent = t('accountsCountPill', {
    on: activeCount,
    total: state.accounts.length,
    max: state.maxAccounts,
  });

  if (state.accounts.length === 0) {
    for (const entry of accountRows.values()) {
      if (entry.timer) clearTimeout(entry.timer);
    }
    accountRows.clear();
    const empty = document.createElement('li');
    empty.className = 'empty-row';
    empty.textContent = t('accountsEmpty');
    list.replaceChildren(empty);
  } else {
    for (const placeholder of list.querySelectorAll('.loading-row, .empty-row')) {
      placeholder.remove();
    }

    const nextIds = new Set(state.accounts.map((a) => a.id));
    for (const [id, entry] of accountRows.entries()) {
      if (!nextIds.has(id)) {
        if (entry.timer) clearTimeout(entry.timer);
        entry.row.remove();
        accountRows.delete(id);
      }
    }

    state.accounts.forEach((acc, index) => {
      let entry = accountRows.get(acc.id);
      if (!entry) {
        entry = createAccountRow(acc);
        accountRows.set(acc.id, entry);
      }

      entry.savedName = acc.name;
      entry.row.classList.toggle('active', Boolean(acc.active && acc.enabled));
      entry.row.classList.toggle('off', !acc.enabled);
      entry.toggle.checked = Boolean(acc.enabled);
      entry.toggleWrap.title = t('accountToggleTip');
      entry.toggle.setAttribute('aria-label', t(acc.enabled ? 'accountToggleOff' : 'accountToggleOn', { name: acc.name }));

      if (entry.service !== acc.service) {
        entry.service = acc.service;
        entry.iconSlot.replaceChildren(serviceIconNode(acc.service));
      }

      entry.input.placeholder = t('accountsPlaceholder');
      entry.input.setAttribute('aria-label', t('accountsPlaceholder'));
      entry.chip.textContent = acc.enabled ? t('accountRunning') : t('accountSleeping');

      const hasUnread = acc.enabled && (acc.unread > 0 || acc.unread === -1);
      entry.badge.hidden = !hasUnread;
      entry.badge.textContent = acc.unread > 0 ? (acc.unread > 99 ? '99+' : String(acc.unread)) : (acc.unread === -1 ? '•' : '');

      entry.remove.textContent = t('remove');
      entry.remove.disabled = state.accounts.length === 1;

      if (document.activeElement !== entry.input && !entry.timer && !entry.saving) {
        entry.input.value = acc.name;
      }

      if (list.children[index] !== entry.row) {
        list.insertBefore(entry.row, list.children[index] || null);
      }
    });
  }

  const atMax = state.accounts.length >= state.maxAccounts;
  for (const btn of document.querySelectorAll('.add-service')) btn.disabled = atMax;
}

window.addEventListener('blur', flushPendingRenames);
window.addEventListener('pagehide', flushPendingRenames);

$('back-btn').addEventListener('click', () => {
  flushPendingRenames();
  api.close();
});

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  e.preventDefault();
  flushPendingRenames();
  api.close();
});

for (const btn of document.querySelectorAll('.add-service')) {
  btn.addEventListener('click', async () => {
    const result = await api.addAccount(btn.dataset.service);
    setAccountsMessage(result && !result.ok ? result.error : '', { isError: true });
  });
}

// ---- Focus schedule

function renderRules() {
  const list = $('rule-list');
  list.replaceChildren();
  const daysSpec = getDict(curLang()).days;

  if (rules.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-row';
    empty.textContent = t('focusEmpty');
    list.appendChild(empty);
  } else {
    rules.forEach((rule, index) => {
      const row = $('rule-row').content.firstElementChild.cloneNode(true);
      const days = row.querySelector('.days');
      for (const [d, label] of daysSpec) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'day';
        b.textContent = label;
        b.setAttribute('aria-pressed', String(rule.days.includes(d)));
        b.addEventListener('click', () => {
          rule.days = rule.days.includes(d) ? rule.days.filter((x) => x !== d) : [...rule.days, d];
          markDirty();
          renderRules();
        });
        days.appendChild(b);
      }
      row.querySelector('.lbl-from').textContent = t('focusFrom');
      row.querySelector('.lbl-to').textContent = t('focusTo');
      const start = row.querySelector('.start');
      const end = row.querySelector('.end');
      start.value = rule.start;
      end.value = rule.end;
      start.addEventListener('change', () => { rule.start = start.value; markDirty(); });
      end.addEventListener('change', () => { rule.end = end.value; markDirty(); });
      row.querySelector('.remove-rule').addEventListener('click', () => {
        rules.splice(index, 1);
        markDirty();
        renderRules();
      });
      list.appendChild(row);
    });
  }
  $('add-rule').disabled = Boolean(state && rules.length >= state.maxRules);
}

function markDirty() {
  dirty = true;
  $('focus-status').textContent = t('focusUnsaved');
}

$('add-rule').addEventListener('click', () => {
  rules.push({ days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' });
  markDirty();
  renderRules();
});
$('focus-enabled').addEventListener('change', markDirty);

$('save-focus').addEventListener('click', async () => {
  for (const r of rules) {
    if (r.days.length === 0) { $('focus-status').textContent = t('focusNeedDay'); return; }
    if (!r.start || !r.end || r.start === r.end) { $('focus-status').textContent = t('focusNeedDiffTime'); return; }
  }
  const result = await api.setFocus($('focus-enabled').checked, rules);
  if (result && result.ok) {
    dirty = false;
    $('focus-status').textContent = t('savedDot');
  } else {
    $('focus-status').textContent = (result && result.error) || t('focusSaveErr');
  }
});

// ---- Appearance controls

for (const chip of document.querySelectorAll('.theme-chip')) {
  chip.addEventListener('click', () => api.setAppearance({ themeColor: chip.dataset.color }));
}
for (const btn of document.querySelectorAll('[data-appearance]')) {
  btn.addEventListener('click', () => api.setAppearance({ appearance: btn.dataset.appearance }));
}
for (const btn of document.querySelectorAll('[data-lang]')) {
  btn.addEventListener('click', () => api.setAppearance({ language: btn.dataset.lang }));
}

// ---- State sync

function render(next) {
  if (!next) return;
  state = next;
  applyThemeAndLocale();
  renderAccounts();
  if (!dirty) {
    rules = JSON.parse(JSON.stringify(state.focus.rules));
    $('focus-enabled').checked = state.focus.enabled;
  }
  renderRules();
  $('focus-status').textContent = dirty ? t('focusUnsaved') : (state.focus.status || '');
  setTab(activeTab);
}

api.onState(render);
api.onSection((section) => {
  if (section === 'accounts' || section === 'focus' || section === 'appearance') {
    setTab(section);
  }
});
api.getState().then(render).catch(() => {
  setAccountsMessage(t('errLoadSettings'), { isError: true });
});
})();
