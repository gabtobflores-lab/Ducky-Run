/* ============================================================
   util.js — math helpers, world geometry, persistent progress
   ============================================================ */
window.DR = window.DR || {};
(function (DR) {
  'use strict';

  /* ---------- world constants ---------- */
  DR.W = 960;
  DR.H = 540;
  DR.LANES = 3;
  DR.LANE_Y = [252, 356, 460];     // baseline (feet) y for each path
  DR.PLAYER_X = 232;               // player's fixed screen x
  DR.GRAVITY = 2050;
  DR.JUMP_V = -690;
  DR.JUMP_MIN = 600;               // floor for a tapped (short) jump

  DR.laneY = function (l) { return DR.LANE_Y[l | 0]; };
  // Subtle depth: upper (further) paths render slightly smaller.
  DR.laneScale = function (l) { return 0.88 + l * 0.06; };

  var U = DR.util = {};

  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.rand = function (a, b) { return a + Math.random() * (b - a); };
  U.randi = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  U.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  U.chance = function (p) { return Math.random() < p; };
  U.sign = function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); };

  U.approach = function (cur, target, delta) {
    if (cur < target) return Math.min(cur + delta, target);
    if (cur > target) return Math.max(cur - delta, target);
    return target;
  };

  U.easeOutCubic = function (t) { return 1 - Math.pow(1 - t, 3); };
  U.easeInCubic = function (t) { return t * t * t; };
  U.easeInOutQuad = function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  U.easeOutBack = function (t) { var c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  U.easeOutElastic = function (t) {
    var c4 = (2 * Math.PI) / 3;
    return t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  };

  /** Axis-aligned box overlap. Boxes are {x,y,w,h} with y growing downward. */
  U.overlap = function (a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  };

  U.fmt = function (n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); };

  /* Deterministic hash noise — used for parallax scenery so the backdrop
     is stable while scrolling instead of flickering every frame. */
  U.hash = function (n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  U.rgba = function (hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };

  U.shade = function (hex, amt) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    var r = U.clamp(((n >> 16) & 255) + amt, 0, 255) | 0;
    var g = U.clamp(((n >> 8) & 255) + amt, 0, 255) | 0;
    var b = U.clamp((n & 255) + amt, 0, 255) | 0;
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  /** Rounded rectangle path (older Safari lacks ctx.roundRect). */
  U.roundRect = function (ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  U.star = function (ctx, x, y, r1, r2, points, rot) {
    ctx.beginPath();
    for (var i = 0; i < points * 2; i++) {
      var r = i % 2 ? r2 : r1;
      var a = (i / (points * 2)) * Math.PI * 2 + (rot || 0);
      var px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  /* ============================================================
     Persistent progress
     ============================================================ */
  var KEY = 'duckyrun.save.v1';
  var DEFAULTS = {
    unlockedLevels: 1,
    totalHats: 0,
    totalEggs: 0,
    bossesBeaten: 0,
    runs: 0,
    ducks: ['classic'],
    duck: 'classic',
    best: {},          // levelId -> best score
    endlessDist: 0,
    endlessScore: 0,
    muted: false
  };

  function safeParse(raw) {
    try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
  }

  DR.progress = (function () {
    var data;
    try { data = safeParse(localStorage.getItem(KEY)); }
    catch (e) { data = {}; }             // private mode / disabled storage
    var p = {};
    for (var k in DEFAULTS) p[k] = (k in data) ? data[k] : (Array.isArray(DEFAULTS[k]) ? DEFAULTS[k].slice() : (typeof DEFAULTS[k] === 'object' ? {} : DEFAULTS[k]));
    if (!Array.isArray(p.ducks) || !p.ducks.length) p.ducks = ['classic'];
    if (typeof p.best !== 'object' || !p.best) p.best = {};
    p.unlockedLevels = U.clamp(p.unlockedLevels | 0, 1, 99);
    return p;
  })();

  DR.saveProgress = function () {
    try { localStorage.setItem(KEY, JSON.stringify(DR.progress)); } catch (e) { /* ignore */ }
  };

  DR.resetProgress = function () {
    try { localStorage.removeItem(KEY); } catch (e) { }
  };

})(window.DR);
