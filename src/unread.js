'use strict';

// Pure, pre-compiled helpers for extracting unread counts from chat web titles
// and favicons. Kept Electron-free so unit tests can exercise all formats directly.

// Invisible bidi/control characters (e.g. LRM/RLM inserted by Facebook in localized titles).
// eslint-disable-next-line no-control-regex
const INVISIBLE_RE = /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
// Leading "(3) Messenger", "(20+) Facebook", "(99+) Zalo", "（3）メッセンジャー", "[4] Zalo", "• (2) Telegram".
const LEADING_UNREAD_RE = /^[•●*\s]*[([（]\s*(\d+)\s*\+?\s*[)\]）]/;
// Trailing "Zalo (3)", "Messenger (12+)".
const TRAILING_UNREAD_RE = /[([（]\s*(\d+)\s*\+?\s*[)\]）]\s*$/;
// Unread favicon indicator used by Telegram Web A ("favicon-unread.svg").
const FAVICON_UNREAD_RE = /favicon[-_]?unread/i;

const MAX_BADGE = 999;

function clampBadge(n) {
  if (!Number.isInteger(n)) return 0;
  if (n === -1) return -1;
  if (n <= 0) return 0;
  return Math.min(n, MAX_BADGE);
}

function parseTitleUnread(title) {
  if (typeof title !== 'string' || !title) return 0;
  const clean = title.replace(INVISIBLE_RE, '').trim();
  if (!clean) return 0;
  const m = LEADING_UNREAD_RE.exec(clean) || TRAILING_UNREAD_RE.exec(clean);
  if (!m) return 0;
  return clampBadge(Number.parseInt(m[1], 10));
}

function hasUnreadFavicon(favicons) {
  if (!Array.isArray(favicons)) return false;
  return favicons.some((url) => typeof url === 'string' && FAVICON_UNREAD_RE.test(url));
}

function combineUnread({ dom = 0, title = 0, favicon = false } = {}) {
  if (dom > 0) return clampBadge(dom);
  if (title > 0) return clampBadge(title);
  if (dom === -1 || favicon) return -1;
  return 0;
}

module.exports = {
  MAX_BADGE,
  clampBadge,
  parseTitleUnread,
  hasUnreadFavicon,
  combineUnread,
};
