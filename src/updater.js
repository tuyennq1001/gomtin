'use strict';

// Production-only update checker & SHA-256 verified downloader for GomTin.
// Completely disabled in Development builds (isDev === true) so Dev never
// phones home or overwrites local builds.
//
// In Production, requests go strictly to github.com / api.github.com for
// tuyennq1001/gomtin releases with zero cookies (credentials: 'omit',
// useSessionCookies: false).

const { app, net } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const selfUpdate = require('./self-update');

const REPO = 'tuyennq1001/gomtin';
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASES_URL = `https://github.com/${REPO}/releases/`;
const DOWNLOAD_BASE = `https://github.com/${REPO}/releases/download/`;
const DOWNLOAD_HOSTS = new Set([
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
]);
const MAX_REDIRECTS = 5;
const DAY = 24 * 60 * 60 * 1000;
const INITIAL_CHECK_DELAY_MS = 10 * 1000;

function parseVersion(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v || '').trim());
  return m ? m.slice(1).map(Number) : null;
}

function isNewer(candidate, current) {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

function parseRelease(json) {
  if (!json || typeof json !== 'object') return null;
  const { tag_name: tag, html_url: url } = json;
  if (typeof tag !== 'string' || !parseVersion(tag)) return null;
  if (typeof url !== 'string' || !url.startsWith(RELEASES_URL)) return null;
  return { version: tag.replace(/^v/, ''), url };
}

function releaseFileUrl(version, name) {
  if (!parseVersion(version) || !/^[A-Za-z0-9._-]+$/.test(name)) throw new Error('Invalid release file');
  return `${DOWNLOAD_BASE}v${version}/${name}`;
}

function parseSums(text) {
  const sums = {};
  for (const line of String(text).split('\n')) {
    const m = /^([0-9a-f]{64})\s+\*?(\S+)$/.exec(line.trim());
    if (m) sums[m[2]] = m[1];
  }
  return sums;
}

function allowedDownloadUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { return false; }
  return url.protocol === 'https:' && DOWNLOAD_HOSTS.has(url.hostname);
}

function getReleaseFile(url, version = '1.0.0') {
  return new Promise((resolve, reject) => {
    if (!allowedDownloadUrl(url)) { reject(new Error('Download left GitHub')); return; }
    const req = net.request({ url, redirect: 'manual', useSessionCookies: false, cache: 'no-store' });
    req.setHeader('User-Agent', `GomTin/${version}`);
    let hops = 0;
    req.on('redirect', (_status, _method, next) => {
      hops += 1;
      if (hops > MAX_REDIRECTS || !allowedDownloadUrl(next)) {
        req.abort();
        reject(new Error('Download left GitHub'));
        return;
      }
      req.followRedirect();
    });
    req.on('response', (res) => {
      if (res.statusCode !== 200) {
        res.on('data', () => {});
        reject(new Error(`GitHub returned HTTP ${res.statusCode}`));
        return;
      }
      resolve(res);
    });
    req.on('error', reject);
    req.end();
  });
}

async function readText(res) {
  const chunks = [];
  for await (const chunk of res) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function downloadReleaseFile(version, name, dest, onProgress = () => {}, appVersion = '1.0.0') {
  const sums = parseSums(await readText(await getReleaseFile(releaseFileUrl(version, 'SHA256SUMS.txt'), appVersion)));
  const expected = sums[name];
  if (!expected) throw new Error(`Checksum missing for ${name}`);

  const res = await getReleaseFile(releaseFileUrl(version, name), appVersion);
  const total = Number(res.headers['content-length']) || 0;
  const hash = crypto.createHash('sha256');
  const out = fs.createWriteStream(dest, { mode: 0o600 });
  let received = 0;

  try {
    await new Promise((resolve, reject) => {
      out.on('error', reject);
      res.on('error', reject);
      res.on('data', (chunk) => {
        hash.update(chunk);
        received += chunk.length;
        if (total > 0) onProgress(Math.min(1, received / total));
        if (!out.write(chunk)) {
          res.pause();
          out.once('drain', () => res.resume());
        }
      });
      res.on('end', () => out.end(resolve));
    });
    const actual = hash.digest('hex');
    if (actual !== expected) throw new Error('Checksum mismatch');
  } catch (err) {
    try { out.destroy(); } catch { /* ignore */ }
    try { fs.rmSync(dest, { force: true }); } catch { /* ignore */ }
    throw err;
  }
}

class Updater {
  /**
   * @param {object} opts { settings, isDev, currentVersion, onChange(), onQuitForUpdate() }
   */
  constructor({ settings, isDev, currentVersion, onChange = () => {}, onQuitForUpdate = () => {} }) {
    this.settings = settings;
    this.isDev = Boolean(isDev);
    this.currentVersion = currentVersion || (app && typeof app.getVersion === 'function' ? app.getVersion() : '1.0.0');
    this.onChange = onChange;
    this.onQuitForUpdate = onQuitForUpdate;

    this.status = this.isDev ? 'disabled-dev' : 'idle';
    this.available = null; // { version, url }
    this.prepared = null;  // result of selfUpdate.prepare()
    this.progress = 0;
    this.error = '';
    this.busy = false;
    this.timer = null;
    this.interval = null;
  }

  installTarget() {
    if (this.isDev) return { kind: 'manual', reason: 'dev-build' };
    return selfUpdate.installInfo({ isPackaged: Boolean(app && app.isPackaged) });
  }

  getState() {
    const info = this.installTarget();
    return {
      disabledDev: this.isDev,
      enabled: !this.isDev && Boolean(this.settings.get('autoCheckUpdates')),
      currentVersion: this.currentVersion,
      status: this.isDev ? 'disabled-dev' : this.status,
      availableVersion: this.available ? this.available.version : null,
      releaseUrl: this.available ? this.available.url : RELEASES_URL,
      progress: this.progress,
      error: this.error,
      lastChecked: this.settings.get('lastUpdateCheck'),
      canSelfUpdate: !this.isDev && info.kind !== 'manual' && info.kind !== 'brew',
    };
  }

  emit() {
    this.onChange(this.getState());
  }

  start() {
    if (this.isDev) return;
    this.stop();
    if (!this.settings.get('autoCheckUpdates')) return;

    const elapsed = Date.now() - this.settings.get('lastUpdateCheck');
    const delay = elapsed >= DAY ? INITIAL_CHECK_DELAY_MS : Math.max(INITIAL_CHECK_DELAY_MS, DAY - elapsed);
    this.timer = setTimeout(() => {
      this.check({ silent: true }).catch(() => {});
      this.interval = setInterval(() => {
        if (this.settings.get('autoCheckUpdates')) this.check({ silent: true }).catch(() => {});
      }, DAY);
      if (this.interval.unref) this.interval.unref();
    }, delay);
    if (this.timer.unref) this.timer.unref();
  }

  stop() {
    clearTimeout(this.timer);
    clearInterval(this.interval);
    this.timer = null;
    this.interval = null;
  }

  setEnabled(on) {
    if (this.isDev) return { ok: false, reason: 'dev' };
    this.settings.set('autoCheckUpdates', Boolean(on));
    if (on) this.start(); else this.stop();
    this.emit();
    return { ok: true };
  }

  cleanupPrepared() {
    if (this.prepared && this.prepared.dir) {
      try { fs.rmSync(this.prepared.dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    this.prepared = null;
  }

  async check({ silent = false } = {}) {
    if (this.isDev) return { ok: false, reason: 'dev' };
    if (this.busy) return { ok: true, state: this.getState() };
    if (this.status === 'ready' && this.prepared) return { ok: true, state: this.getState() };

    this.busy = true;
    this.error = '';
    this.status = 'checking';
    this.emit();

    try {
      const res = await net.fetch(API_URL, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `GomTin/${this.currentVersion}`,
        },
        credentials: 'omit',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
      this.settings.set('lastUpdateCheck', Date.now());
      const release = parseRelease(await res.json());
      if (!release) throw new Error('Invalid release metadata');

      if (!isNewer(release.version, this.currentVersion)) {
        this.available = null;
        this.status = 'up-to-date';
        this.busy = false;
        this.emit();
        return { ok: true, state: this.getState() };
      }

      this.available = release;
      const info = this.installTarget();
      if (info.kind === 'manual' || info.kind === 'brew') {
        this.status = 'available-manual';
        this.busy = false;
        this.emit();
        return { ok: true, state: this.getState() };
      }

      // Download & verify SHA-256 + codesign silently in the background.
      this.status = 'downloading';
      this.progress = 0;
      this.emit();

      const dir = selfUpdate.workDir(info);
      const assetName = info.asset(release.version);
      const dest = path.join(dir, assetName);
      try {
        let lastPct = -1;
        await downloadReleaseFile(release.version, assetName, dest, (frac) => {
          const pct = Math.round(frac * 100);
          if (pct !== lastPct) {
            lastPct = pct;
            this.progress = pct;
            this.emit();
          }
        }, this.currentVersion);
        this.cleanupPrepared();
        this.prepared = selfUpdate.prepare(info, dest, dir);
        this.progress = 100;
        this.status = 'ready';
      } catch (err) {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
        throw err;
      }

      this.busy = false;
      this.emit();
      return { ok: true, state: this.getState() };
    } catch (err) {
      this.busy = false;
      if (silent) {
        this.status = this.available ? 'available-manual' : 'idle';
        this.error = '';
      } else {
        this.status = 'error';
        this.error = err && err.message ? err.message : 'Update check failed';
      }
      this.emit();
      return { ok: false, error: this.error };
    }
  }

  installNow() {
    if (this.isDev || !this.prepared) return { ok: false };
    const prepared = this.prepared;
    this.prepared = null;
    selfUpdate.apply(prepared, { relaunch: true, relaunchApp: (opts) => app.relaunch(opts) });
    this.onQuitForUpdate();
    return { ok: true };
  }
}

module.exports = {
  Updater,
  REPO,
  API_URL,
  RELEASES_URL,
  DOWNLOAD_BASE,
  DOWNLOAD_HOSTS,
  parseVersion,
  isNewer,
  parseRelease,
  releaseFileUrl,
  parseSums,
  allowedDownloadUrl,
  downloadReleaseFile,
};
