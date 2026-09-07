/* ============================================================
   main.js — bootstrap
   ============================================================ */
(function (DR) {
  'use strict';

  function boot() {
    var cv = document.getElementById('game');
    if (!cv || !cv.getContext) {
      document.body.innerHTML = '<p style="color:#fff;padding:2em;font-family:sans-serif">' +
        'Ducky Run needs a browser with canvas support.</p>';
      return;
    }
    try {
      DR.game.init(cv);
    } catch (err) {
      console.error('Ducky Run failed to start:', err);
      var pre = document.createElement('pre');
      pre.style.cssText = 'position:absolute;inset:0;color:#ff9;background:#101;padding:20px;font:12px monospace;z-index:99;white-space:pre-wrap';
      pre.textContent = 'Ducky Run crashed on start:\n' + (err && err.stack || err);
      document.body.appendChild(pre);
    }

    // Any first interaction unlocks WebAudio (autoplay policy).
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, function once() {
        DR.audio.unlock();
        window.removeEventListener(ev, once);
      }, { passive: true });
    });

    // Pause automatically if the player tabs away mid-run.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && DR.game.state && DR.ui.current() !== 'pause') {
        try { DR.game.autoPause && DR.game.autoPause(); } catch (e) { }
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window.DR);
