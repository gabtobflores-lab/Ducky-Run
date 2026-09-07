/* ============================================================
   input.js — keyboard, touch and on-screen buttons.
   Exposes edge-triggered "pressed" actions plus held state.
   ============================================================ */
(function (DR) {
  'use strict';

  var IN = DR.input = {};
  var held = {};          // action -> bool
  var pressed = {};       // action -> bool (consumed each frame)
  var buffer = {};        // action -> timestamp, for a small input buffer

  var MAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    Space: 'jump', ArrowRight: 'jump', KeyK: 'jump',
    KeyJ: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash', KeyX: 'dash',
    KeyE: 'ability', KeyL: 'ability',
    KeyP: 'pause', Escape: 'pause',
    KeyM: 'mute',
    Enter: 'confirm', NumpadEnter: 'confirm',
    KeyR: 'restart'
  };

  IN.touchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  function down(a) {
    if (!held[a]) pressed[a] = true;
    held[a] = true;
    buffer[a] = performance.now();
    if (DR.onInput) DR.onInput(a);
  }
  function up(a) { held[a] = false; }

  IN.press = down;   // let UI/touch synthesise actions

  window.addEventListener('keydown', function (e) {
    var a = MAP[e.code];
    if (!a) return;
    if (a === 'jump' || a === 'up' || a === 'down' || a === 'pause') e.preventDefault();
    if (e.repeat) return;
    down(a);
  }, { passive: false });

  window.addEventListener('keyup', function (e) {
    var a = MAP[e.code];
    if (a) up(a);
  });

  window.addEventListener('blur', function () { held = {}; });

  /* ---------- touch: swipe + tap ---------- */
  var tsx = 0, tsy = 0, tst = 0, moved = false;
  function onStart(e) {
    var t = e.changedTouches[0];
    tsx = t.clientX; tsy = t.clientY; tst = performance.now(); moved = false;
  }
  function onMove(e) {
    if (moved) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - tsx, dy = t.clientY - tsy;
    if (Math.abs(dy) > 34 && Math.abs(dy) > Math.abs(dx)) {
      moved = true; down(dy < 0 ? 'up' : 'down'); setTimeout(function () { up(dy < 0 ? 'up' : 'down'); }, 40);
    } else if (dx > 52 && Math.abs(dx) > Math.abs(dy)) {
      moved = true; down('dash'); setTimeout(function () { up('dash'); }, 40);
    }
  }
  function onEnd(e) {
    if (!moved && performance.now() - tst < 260) {
      down('jump');
      setTimeout(function () { up('jump'); }, 110);
    }
    moved = false;
  }

  IN.attachTouch = function (el) {
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
  };

  IN.attachButtons = function (root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-act]'), function (b) {
      var a = b.getAttribute('data-act');
      var start = function (e) { e.preventDefault(); down(a); };
      var stop = function (e) { e.preventDefault(); up(a); };
      b.addEventListener('touchstart', start, { passive: false });
      b.addEventListener('touchend', stop, { passive: false });
      b.addEventListener('touchcancel', stop, { passive: false });
      b.addEventListener('mousedown', start);
      b.addEventListener('mouseup', stop);
      b.addEventListener('mouseleave', stop);
    });
  };

  /* ---------- query API ---------- */
  IN.held = function (a) { return !!held[a]; };
  IN.hit = function (a) { var v = !!pressed[a]; pressed[a] = false; return v; };
  /** Buffered press: true if the action fired within `ms` and consumes it. */
  IN.buffered = function (a, ms) {
    var t = buffer[a];
    if (t !== undefined && performance.now() - t <= (ms || 130)) { buffer[a] = undefined; pressed[a] = false; return true; }
    return false;
  };
  IN.clear = function () { pressed = {}; buffer = {}; };
  IN.clearAll = function () { pressed = {}; buffer = {}; held = {}; };
  IN.endFrame = function () { pressed = {}; };

})(window.DR);
