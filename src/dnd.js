'use strict';

// Do Not Disturb: pause Facebook's notifications, by hand or on a weekly
// focus schedule. While paused, the app's permission check reports
// notifications as not allowed, so the page cannot show them. Unread counts
// keep updating.
//
// Precedence: a manual pause always applies. During a scheduled focus period,
// "Resume" turns notifications back on until that period ends.

const { focusEnd } = require('./focus');
const { tr } = require('./ui/i18n');

const HOUR = 60 * 60 * 1000;

function nextMorning(now = new Date(), hour = 8) {
  const t = new Date(now);
  t.setHours(hour, 0, 0, 0);
  if (t <= now) t.setDate(t.getDate() + 1);
  return t.getTime();
}

function fmt(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

class Dnd {
  constructor({ settings, onChange, now = () => Date.now() }) {
    this.settings = settings;
    this.onChange = onChange;
    this.now = now;
    this.timer = null;
    this.last = this.isPaused();
    this.arm();
    // Schedules start and end on minute boundaries; re-evaluate regularly.
    this.ticker = setInterval(() => this.tick(), 20 * 1000);
    if (this.ticker.unref) this.ticker.unref();
  }

  manualPaused() {
    const until = this.settings.get('dndUntil');
    return until === -1 || until > this.now();
  }

  // End of the current scheduled focus period, or null.
  focusUntil() {
    if (!this.settings.get('focusEnabled')) return null;
    return focusEnd(this.settings.get('focusRules'), new Date(this.now()));
  }

  focusPaused() {
    const end = this.focusUntil();
    return end !== null && this.settings.get('focusOverrideUntil') < end;
  }

  isPaused() {
    return this.manualPaused() || this.focusPaused();
  }

  pause(until) {
    this.settings.set('dndUntil', until);
    this.arm();
    this.changed(true);
  }

  pauseFor(ms) { this.pause(this.now() + ms); }
  pauseUntilMorning() { this.pause(nextMorning(new Date(this.now()))); }
  pauseIndefinitely() { this.pause(-1); }

  resume() {
    this.settings.set('dndUntil', 0);
    const end = this.focusUntil();
    if (end !== null) this.settings.set('focusOverrideUntil', end);
    this.arm();
    this.changed(true);
  }

  tick() { this.changed(false); }

  changed(force) {
    const now = this.isPaused();
    if (force || now !== this.last) {
      this.last = now;
      this.onChange();
    }
  }

  // Fire onChange when a timed manual pause ends.
  arm() {
    clearTimeout(this.timer);
    const until = this.settings.get('dndUntil');
    if (until > this.now()) {
      // setTimeout cannot exceed ~24.8 days; re-arm in steps.
      const delay = Math.min(until - this.now() + 500, 2 ** 31 - 1);
      this.timer = setTimeout(() => { this.arm(); this.changed(false); }, delay);
      if (this.timer.unref) this.timer.unref();
    }
  }

  label(lang) {
    const until = this.settings.get('dndUntil');
    if (lang) {
      if (until === -1) return tr(lang, 'dndPausedUntilResumed');
      if (until > this.now()) return tr(lang, 'dndPausedUntil', { time: fmt(until) });
      if (this.focusPaused()) return tr(lang, 'dndFocusUntil', { time: fmt(this.focusUntil()) });
      return null;
    }
    if (until === -1) return 'Notifications paused';
    if (until > this.now()) return `Notifications paused until ${fmt(until)}`;
    if (this.focusPaused()) return `Focus time until ${fmt(this.focusUntil())}`;
    return null;
  }
}

module.exports = { Dnd, nextMorning, HOUR };
