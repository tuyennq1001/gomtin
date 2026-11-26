'use strict';

// Strictly read-only, sandboxed badge observer for chat WebContentsViews.
// - Exposes NOTHING to the web page (no contextBridge, no window globals).
// - Never reads message bodies, form inputs, cookies, or web storage.
// - Never makes network requests or modifies page state.
// - Sends ONLY a single bounded integer (-1 = dot unread, 0..999 = count)
//   over the one-way 'chat:unread' IPC channel when the count changes.

const { ipcRenderer } = require('electron');

const MAX_BADGE = 999;
const DEBOUNCE_MS = 600;
const POLL_MS = 4000;

// Pre-compiled patterns (allocated once, never inside mutation/poll hot paths).
// eslint-disable-next-line no-control-regex
const INVISIBLE_RE = /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
const LEADING_TITLE_RE = /^[•●*\s]*[([（]\s*(\d+)\s*\+?\s*[)\]）]/;
const TRAILING_TITLE_RE = /[([（]\s*(\d+)\s*\+?\s*[)\]）]\s*$/;
const PURE_NUM_RE = /^\d+\+?$/;
const COMPACT_NUM_RE = /^(\d+(?:\.\d+)?)([KM])?$/i;
const DIGITS_RE = /(\d+)/;
const ZALO_FA_PLUS_RE = /\bfa-(?:num-)?5_?plus(?:_|\b)|\b5plus(?:_|\b)/i;
const ZALO_FA_NUM_RE = /\bfa-(?:num-)?([1-9]\d?)(?:_|\b)/i;
const UNREAD_LABEL_RE = /(unread|chưa đọc|未読|mark as read|đánh dấu là đã đọc|既読にする)/i;
const MUTED_LABEL_RE = /(muted|tắt thông báo|ミュート)/i;
const FAVICON_UNREAD_RE = /favicon[-_]?unread/i;
const RGB_RE = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i;
const FB_NAV_PATHS = new Set([
  '/t', '/t/',
  '/messages/t', '/messages/t/',
  '/requests/t', '/requests/t/',
  '/messages/requests/t', '/messages/requests/t/',
  '/marketplace/t', '/marketplace/t/',
  '/messages/marketplace/t', '/messages/marketplace/t/',
]);

function clamp(n) {
  if (!Number.isFinite(n)) return 0;
  const v = Math.round(n);
  if (v === -1) return -1;
  if (v <= 0) return 0;
  return Math.min(v, MAX_BADGE);
}

function parseCompactInt(text) {
  if (typeof text !== 'string') return 0;
  const t = text.replace(INVISIBLE_RE, '').trim().replace(/\+$/, '');
  const m = COMPACT_NUM_RE.exec(t);
  if (!m) return 0;
  const base = Number.parseFloat(m[1]);
  const unit = m[2] ? m[2].toUpperCase() : '';
  const mult = unit === 'K' ? 1000 : (unit === 'M' ? 1000000 : 1);
  return clamp(base * mult);
}

function parseTitle() {
  const clean = (document.title || '').replace(INVISIBLE_RE, '').trim();
  if (!clean) return 0;
  const m = LEADING_TITLE_RE.exec(clean) || TRAILING_TITLE_RE.exec(clean);
  return m ? clamp(Number.parseInt(m[1], 10)) : 0;
}

function parseRgb(color) {
  const m = RGB_RE.exec(color || '');
  if (!m) return null;
  const a = m[4] === undefined ? 1 : Number.parseFloat(m[4]);
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a };
}

function isMessengerBlue(rgb) {
  return Boolean(rgb && rgb.a > 0.5 && rgb.b >= 180 && rgb.b - rgb.r >= 60 && rgb.b >= rgb.g);
}

function isGrayColor(rgb) {
  if (!rgb || rgb.a < 0.1) return true;
  // Pure white (used on active/selected chat badge in Telegram) is NOT muted gray.
  if (rgb.r > 235 && rgb.g > 235 && rgb.b > 235) return false;
  return Math.abs(rgb.r - rgb.g) < 18 && Math.abs(rgb.g - rgb.b) < 18 && rgb.r < 220;
}

function detectService(host) {
  if (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'messenger.com' || host.endsWith('.messenger.com')) {
    return 'messenger';
  }
  if (host === 'zalo.me' || host.endsWith('.zalo.me')) return 'zalo';
  if (host === 'web.telegram.org' || host === 'webz.telegram.org' || host === 'webk.telegram.org') return 'telegram';
  return null;
}

// ---- Facebook Messenger

function detectMessenger() {
  // 1. Facebook top banner Messenger button (still live in DOM even when hidden by CSS).
  const banner = document.querySelector('div[role="banner"]');
  if (banner) {
    const btns = banner.querySelectorAll('[role="button"][aria-label*="Messenger" i], a[href*="/messages"][aria-label]');
    for (const btn of btns) {
      const label = btn.getAttribute('aria-label') || '';
      if (!/messenger/i.test(label)) continue;
      // Prefer explicit numeric badge span inside the Messenger banner icon.
      for (const span of btn.querySelectorAll('span')) {
        const txt = (span.textContent || '').trim();
        if (PURE_NUM_RE.test(txt)) {
          const n = clamp(Number.parseInt(txt, 10));
          if (n > 0) return n;
        }
      }
      const m = DIGITS_RE.exec(label);
      if (m) {
        const n = clamp(Number.parseInt(m[1], 10));
        if (n > 0) return n;
      }
    }
  }

  // 2. Messenger navigation rail tabs (/messages/t/, /requests/t/, /marketplace/t/).
  let railCount = 0;
  let foundRail = false;
  const navScope = document.querySelector('[role="navigation"]') || document;
  const links = navScope.querySelectorAll('a[role="link"][tabindex="0"][aria-label]');
  for (const a of links) {
    let pathname = '';
    try { pathname = new URL(a.href, location.origin).pathname; } catch { continue; }
    const isExactNav = FB_NAV_PATHS.has(pathname);
    const isPrefixNav = pathname.startsWith('/t/') || pathname.startsWith('/messages/t/')
      || pathname.startsWith('/requests/t/') || pathname.startsWith('/messages/requests/t/')
      || pathname.startsWith('/marketplace/t/') || pathname.startsWith('/messages/marketplace/t/');
    if (!isExactNav && !isPrefixNav) continue;
    const label = a.getAttribute('aria-label') || '';
    let tabNum = 0;
    for (const span of a.querySelectorAll('span')) {
      const txt = (span.textContent || '').trim();
      if (PURE_NUM_RE.test(txt)) {
        tabNum = clamp(Number.parseInt(txt, 10));
        if (tabNum > 0) break;
      }
    }
    if (tabNum === 0 && (isExactNav || UNREAD_LABEL_RE.test(label))) {
      const m = DIGITS_RE.exec(label);
      if (m) tabNum = clamp(Number.parseInt(m[1], 10));
    }
    if (isExactNav || tabNum > 0) foundRail = true;
    railCount += tabNum;
  }
  if (foundRail && railCount > 0) return clamp(railCount);

  // 3. Visible conversation rows (multi-language aria-label + unread blue dot).
  const rows = document.querySelectorAll('[data-testid="mwthreadlist-item"], [role="grid"] [role="row"]');
  let unreadRows = 0;
  for (const row of rows) {
    if (!row.querySelector('a[href*="/messages/t/"], a[href*="/t/"]')) continue;
    const rowLabel = row.getAttribute('aria-label') || '';
    if (MUTED_LABEL_RE.test(rowLabel)) continue;
    if (row.querySelector('[aria-label*="Muted" i], [aria-label*="Tắt thông báo" i], [aria-label*="ミュート"]')) continue;

    let isUnread = UNREAD_LABEL_RE.test(rowLabel);
    if (!isUnread) {
      for (const el of row.querySelectorAll('[aria-label]')) {
        if (UNREAD_LABEL_RE.test(el.getAttribute('aria-label') || '')) {
          isUnread = true;
          break;
        }
      }
    }
    if (!isUnread && row.querySelector('[data-testid="mwthreadlist-item-unread"], .is6700om, .lrazzd5p, .o48pnaf2')) {
      isUnread = true;
    }
    if (!isUnread) {
      // Language-independent fallback: small solid blue unread dot inside the row.
      const dots = row.querySelectorAll('span, div');
      for (const d of dots) {
        if (d.childElementCount > 0 || (d.textContent && d.textContent.trim())) continue;
        const rect = d.getBoundingClientRect();
        if (rect.width < 6 || rect.width > 16 || Math.abs(rect.width - rect.height) > 2) continue;
        const cs = getComputedStyle(d);
        if (isMessengerBlue(parseRgb(cs.backgroundColor))) {
          isUnread = true;
          break;
        }
      }
    }
    if (isUnread) unreadRows += 1;
  }
  if (unreadRows > 0) return clamp(unreadRows);

  return parseTitle();
}

// ---- Zalo Web

function parseZaloBadgeEl(el) {
  if (!el) return 0;
  const txt = (el.textContent || '').replace(INVISIBLE_RE, '').trim();
  if (PURE_NUM_RE.test(txt)) return clamp(Number.parseInt(txt, 10));

  const nodes = [el, ...el.querySelectorAll('.z-noti-badge__content, i, span')];
  for (const node of nodes) {
    const cls = typeof node.className === 'string' ? node.className : '';
    if (!cls) continue;
    if (ZALO_FA_PLUS_RE.test(cls)) return 6; // "5+" marker; caller refines from list if available
    const m = ZALO_FA_NUM_RE.exec(cls);
    if (m) return clamp(Number.parseInt(m[1], 10));
  }
  return 0;
}

function detectZalo() {
  // 1. Primary: Zalo left blue bar Message tab unread badge.
  const msgTab = document.querySelector(
    '[data-translate-title="STR_TAB_MESSAGE"], [data-id="div_Main_TabMsg"]',
  );
  if (msgTab) {
    const badgeEl = msgTab.querySelector(
      '[class*="leftbar-unread-badge"], .z-noti-badge, [class*="noti-badge"], .tab-red-dot',
    );
    if (badgeEl) {
      const n = parseZaloBadgeEl(badgeEl);
      if (n >= 6) {
        // Refine "5+" by summing visible unmuted conversations when available.
        let sum = 0;
        const convs = document.querySelectorAll('.conv-action__unread-v2 > div:not([class*="--noti-disable"])');
        for (const item of convs) sum += parseZaloBadgeEl(item);
        return clamp(Math.max(5, sum || n));
      }
      if (n > 0) return n;
      const rect = badgeEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return -1;
    }
  }

  // 2. Fallback: visible unmuted conversation badges.
  let convSum = 0;
  const convs = document.querySelectorAll(
    '.conv-action__unread-v2 > div:not([class*="--noti-disable"]), [class*="conv-unread"]:not([class*="disable"])',
  );
  for (const item of convs) convSum += parseZaloBadgeEl(item);
  if (convSum > 0) return clamp(convSum);

  return parseTitle();
}

// ---- Telegram Web A / K

function detectTelegram() {
  // 1. Exact global unread counter when mounted (Telegram Web A UnreadCounter.tsx).
  const globalCounter = document.querySelector('.unread-count.active');
  if (globalCounter) {
    const n = parseCompactInt(globalCounter.textContent || '');
    if (n > 0) return n;
  }

  // 2. "All Chats" folder tab badge when folders are enabled (first tab in TabList).
  const firstTab = document.querySelector('.TabList .Tab:first-child');
  if (firstTab) {
    const badge = firstTab.querySelector('.Tab__badge--active, .badge, .Tab_inner > span');
    if (badge && badge.childElementCount === 0) {
      const n = parseCompactInt(badge.textContent || '');
      if (n > 0) {
        const bg = parseRgb(getComputedStyle(badge).backgroundColor);
        if (badge.classList.contains('Tab__badge--active') || !isGrayColor(bg)) return n;
      }
    }
  }

  // 3. Visible Telegram Web A chat list (.chat-list .ListItem .subtitle), compatible with
  // Vite production CSS module hashed class names (see Ajaxy/telegram-tt Chat.tsx / ChatBadge.tsx).
  let total = 0;
  const rowsA = document.querySelectorAll('.chat-list .ListItem .subtitle');
  for (const sub of rowsA) {
    const row = sub.closest('.ListItem');
    if (row && (row.classList.contains('muted') || row.querySelector('.icon-muted'))) continue;
    // Skip .last-message (first element) and inspect sibling ChatBadge container(s).
    for (let el = sub.firstElementChild; el; el = el.nextElementSibling) {
      if (el.classList.contains('last-message')) continue;
      // Find numeric counter inside badge (ignores pin/reaction/mention icons).
      const candidates = el.querySelectorAll('span, div');
      const targets = candidates.length > 0 ? candidates : [el];
      let badgeNum = 0;
      let badgeNode = null;
      for (const node of targets) {
        if (node.querySelector('i.icon')) continue;
        const n = parseCompactInt(node.textContent || '');
        if (n > 0) {
          badgeNum = n;
          badgeNode = node;
          break;
        }
      }
      if (badgeNum > 0 && badgeNode) {
        // Walk up to the styled badge pill to check muted (gray) vs active color.
        let pill = badgeNode;
        let muted = false;
        for (let hop = 0; hop < 4 && pill && pill !== sub; hop += 1) {
          const bg = parseRgb(getComputedStyle(pill).backgroundColor);
          if (bg && bg.a > 0.1) {
            muted = isGrayColor(bg);
            break;
          }
          pill = pill.parentElement;
        }
        if (!muted) {
          total += badgeNum;
          break;
        }
      }
    }
  }
  if (total > 0) return clamp(total);

  // 4. Telegram Web K fallback (/k/).
  let webKTotal = 0;
  for (const row of document.querySelectorAll('.rp:not(.is-muted) .dialog-subtitle-badge')) {
    webKTotal += parseCompactInt(row.textContent || '');
  }
  if (webKTotal > 0) return clamp(webKTotal);

  // 5. Title fallback.
  const fromTitle = parseTitle();
  if (fromTitle > 0) return fromTitle;

  // 6. Telegram Web A unread favicon fallback (catches unread chats scrolled off-screen).
  const icon = document.querySelector('link[rel*="icon"]');
  if (icon && FAVICON_UNREAD_RE.test(icon.getAttribute('href') || '')) return -1;

  return 0;
}

function readUnread(service) {
  try {
    if (service === 'messenger') return detectMessenger();
    if (service === 'zalo') return detectZalo();
    if (service === 'telegram') return detectTelegram();
  } catch {
    return parseTitle();
  }
  return 0;
}

// ---- Lifecycle (top frame only, HTTPS chat origins only)

if (window === window.top && location.protocol === 'https:') {
  const service = detectService(location.hostname.toLowerCase());
  if (service) {
    let lastSent = null;
    let timer = null;

    const scan = () => {
      timer = null;
      const next = clamp(readUnread(service));
      if (next !== lastSent) {
        lastSent = next;
        ipcRenderer.send('chat:unread', next);
      }
    };

    const schedule = () => {
      if (timer) return;
      timer = setTimeout(scan, DEBOUNCE_MS);
    };

    const start = () => {
      scan();
      if (document.body) {
        const observer = new MutationObserver(schedule);
        observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'class'] });
      }
      if (document.head) {
        const headObserver = new MutationObserver(schedule);
        headObserver.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href'] });
      }
      setInterval(scan, POLL_MS);
    };

    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  }
}
