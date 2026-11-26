'use strict';

// Service-scoped route policy for the wrapper. Kept free of Electron imports
// so it can be unit-tested independently for Messenger, Zalo and Telegram.
//   allowed  -> stay in the app
//   feed     -> bounce back to the service's home URL
//   external -> open in the system browser, then bounce back

const { SERVICES, getService } = require('./services');

const HOME_URL = SERVICES.messenger.homeUrl;

function hasPrefix(pathname, prefix) {
  // Facebook mixes "/login/..." and legacy "/login.php" style endpoints.
  return pathname === prefix || pathname === `${prefix}.php` || pathname.startsWith(`${prefix}/`);
}

function matchesDomain(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function homeUrlFor(serviceId) {
  return getService(serviceId).homeUrl;
}

function classify(rawUrl, serviceId = 'messenger') {
  let url;
  try { url = new URL(rawUrl); } catch { return 'external'; }
  // about:blank is the only non-https page allowed (popups start there before
  // navigating). data:/blob:/file: could render arbitrary content in an app
  // window with no address bar, so they are never allowed.
  if (rawUrl === 'about:blank') return 'allowed';
  const svc = getService(serviceId);
  if (url.protocol !== 'https:' || !svc.hosts.has(url.hostname)) return 'external';
  if (svc.fullAllowHosts.has(url.hostname)) return 'allowed';

  const p = url.pathname.replace(/\/+$/, '') || '/';
  if (svc.allowedPrefixes.some((pre) => hasPrefix(p, pre))) return 'allowed';
  if (svc.feedPaths.has(p) || svc.feedPrefixes.some((pre) => hasPrefix(p, pre))) return 'feed';
  return 'external';
}

// True for a dedicated call popup page (currently Facebook Messenger calls).
function isCallUrl(rawUrl, serviceId = 'messenger') {
  const svc = getService(serviceId);
  if (svc.callPrefixes.length === 0) return false;
  let url;
  try { url = new URL(rawUrl); } catch { return false; }
  if (url.protocol !== 'https:' || !svc.hosts.has(url.hostname)) return false;
  const p = url.pathname.replace(/\/+$/, '') || '/';
  return svc.callPrefixes.some((pre) => hasPrefix(p, pre));
}

// True for https origins operated by the given service. Used to gate
// permissions, popup openers and server redirects so no third-party site
// can ever inherit privileges or render inside an app window.
function isServiceUrl(rawUrl, serviceId = 'messenger') {
  let url;
  try { url = new URL(rawUrl); } catch { return false; }
  if (url.protocol !== 'https:') return false;
  const svc = getService(serviceId);
  return svc.originDomains.some((d) => matchesDomain(url.hostname, d));
}

// Backward-compatible helper for Facebook/Messenger origin checks.
function isFacebookUrl(rawUrl) {
  return isServiceUrl(rawUrl, 'messenger');
}

// Files sent in chats live on service attachment CDNs (e.g. fbsbx.com for
// Facebook, zdn.vn / zadn.vn for Zalo) or blob: URLs scoped to the service.
// They are downloaded in-app and never rendered in an app window.
function downloadTarget(rawUrl, serviceId = 'messenger') {
  if (typeof rawUrl !== 'string') return null;
  if (rawUrl.startsWith('blob:')) return isServiceUrl(rawUrl.slice(5), serviceId) ? rawUrl : null;
  let url;
  try { url = new URL(rawUrl); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  const svc = getService(serviceId);
  if (svc.downloadDomains.some((d) => matchesDomain(url.hostname, d))) return url.href;
  // Facebook link shim: l.facebook.com/l.php?u=<target>
  if (svc.linkShimHosts.has(url.hostname) && url.pathname === '/l.php') {
    const inner = url.searchParams.get('u');
    if (inner && inner !== rawUrl) return downloadTarget(inner, serviceId);
  }
  return null;
}

module.exports = {
  classify,
  isServiceUrl,
  isFacebookUrl,
  isCallUrl,
  downloadTarget,
  homeUrlFor,
  HOME_URL,
};
