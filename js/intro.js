/* ============================================================
   intro.js — original opening cinematic (canvas rendered).
   Deliberately in the spirit of 90s console idents, but every
   shape, colour and note here is our own.
   ============================================================ */
(function (DR) {
  'use strict';
  var U = DR.util, W = DR.W, H = DR.H, TAU = Math.PI * 2;

  var I = DR.intro = {};
  var t = 0, done = false, sfx = {}, sparks = [];
  var LEN = 5.6;

  I.reset = function () {
    t = 0; done = false; sfx = {}; sparks.length = 0;
    DR.fx.clear();
  };
  I.done = function () { return done; };
  I.skip = function () { done = true; };
  I.progress = function () { return U.clamp(t / LEN, 0, 1); };

  function once(key, time, fn) {
    if (!sfx[key] && t >= time) { sfx[key] = 1; fn(); }
  }

  I.update = function (dt) {
    if (done) return;
    t += dt;

    once('whoosh', 0.15, function () { DR.audio.play('logoWhoosh'); });
    once('slam1', 1.15, function () {
      DR.audio.play('logoSlam');
      for (var i = 0; i < 26; i++) {
        DR.fx.spawn({
          x: U.rand(180, 520), y: 236 + U.rand(-14, 14),
          vx: U.rand(-460, 260), vy: U.rand(-320, 90), g: 900, drag: 1.1,
          life: U.rand(.4, .9), size: U.rand(2, 6), color: U.pick(['#ffd447', '#fff6dd', '#ffae2b']),
          shape: 'spark', add: true
        });
      }
    });
    once('slam2', 1.62, function () {
      DR.audio.play('logoSlam');
      for (var i = 0; i < 26; i++) {
        DR.fx.spawn({
          x: U.rand(440, 800), y: 322 + U.rand(-12, 12),
          vx: U.rand(-240, 460), vy: U.rand(-300, 90), g: 900, drag: 1.1,
          life: U.rand(.4, .9), size: U.rand(2, 6), color: U.pick(['#8fd3ff', '#fff', '#ffd447']),
          shape: 'spark', add: true
        });
      }
    });
    once('chord', 2.0, function () {
      DR.audio.play('logoChord');
      for (var i = 0; i < 46; i++) {
        var a = U.rand(0, TAU);
        DR.fx.spawn({
          x: W / 2, y: 270, vx: Math.cos(a) * U.rand(120, 620), vy: Math.sin(a) * U.rand(90, 420),
          g: 240, drag: 1.3, life: U.rand(.6, 1.4), size: U.rand(2, 7),
          color: U.pick(['#ffd447', '#fff6dd', '#ffe58a']), shape: 'star', add: true, spin: U.rand(-8, 8)
        });
      }
      DR.fx.feathers(W / 2, 260, 16, ['#ffd447', '#fff6dd', '#8fd3ff']);
    });

    DR.fx.update(dt);
    if (t >= LEN) done = true;
  };

  function letterBlock(ctx, text, x, y, size, fill, strokeCol, spacing) {
    ctx.font = '900 ' + size + 'px "Trebuchet MS",Verdana,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (spacing) {
      var total = 0, i;
      for (i = 0; i < text.length; i++) total += ctx.measureText(text[i]).width + spacing;
      total -= spacing;
      var cx = x - total / 2;
      for (i = 0; i < text.length; i++) {
        var wch = ctx.measureText(text[i]).width;
        ctx.lineWidth = size * .16; ctx.lineJoin = 'round'; ctx.strokeStyle = strokeCol;
        ctx.strokeText(text[i], cx + wch / 2, y);
        ctx.fillStyle = fill;
        ctx.fillText(text[i], cx + wch / 2, y);
        cx += wch + spacing;
      }
    } else {
      ctx.lineWidth = size * .16; ctx.lineJoin = 'round'; ctx.strokeStyle = strokeCol;
      ctx.strokeText(text, x, y);
      ctx.fillStyle = fill;
      ctx.fillText(text, x, y);
    }
  }

  I.draw = function (ctx) {
    /* ---------- backdrop ---------- */
    var glow = U.clamp((t - 0.4) / 1.8, 0, 1);
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#04101d');
    g.addColorStop(.5, U.shade('#0a2038', Math.round(glow * 26)));
    g.addColorStop(1, U.shade('#123252', Math.round(glow * 34)));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // rising sun disc
    var sunK = U.clamp((t - 0.3) / 2.4, 0, 1);
    var sunY = 430 - U.easeOutCubic(sunK) * 190;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var sg = ctx.createRadialGradient(W / 2, sunY, 8, W / 2, sunY, 300);
    sg.addColorStop(0, 'rgba(255,214,120,' + (0.5 * sunK) + ')');
    sg.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(W / 2, sunY, 300, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,236,180,' + (0.85 * sunK) + ')';
    ctx.beginPath(); ctx.arc(W / 2, sunY, 96 * sunK, 0, TAU); ctx.fill();

    // rotating rays after the chord
    if (t > 2.0) {
      var rk = U.clamp((t - 2.0) / .7, 0, 1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = .16 * rk;
      ctx.translate(W / 2, 274);
      ctx.rotate(t * .18);
      ctx.fillStyle = '#ffd447';
      for (var r = 0; r < 12; r++) {
        ctx.save(); ctx.rotate((r / 12) * TAU);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(760, -46); ctx.lineTo(760, 46); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // water horizon
    ctx.save();
    ctx.fillStyle = 'rgba(10,40,70,.75)';
    ctx.fillRect(0, 430, W, H - 430);
    ctx.strokeStyle = 'rgba(160,220,255,.35)'; ctx.lineWidth = 2;
    for (var i = 0; i < 9; i++) {
      var yy = 442 + i * 12;
      ctx.beginPath();
      for (var x = 0; x <= W; x += 20) {
        var yv = yy + Math.sin(x * .02 + t * 2 + i) * (1.5 + i * .3);
        if (x === 0) ctx.moveTo(x, yv); else ctx.lineTo(x, yv);
      }
      ctx.stroke();
    }
    ctx.restore();

    /* ---------- flying duck silhouette ---------- */
    if (t < 1.5) {
      var fk = U.clamp(t / 1.15, 0, 1);
      var fx = -140 + U.easeInOutQuad(fk) * (W + 300);
      var fy = 300 - Math.sin(fk * Math.PI) * 130;
      ctx.save();
      ctx.globalAlpha = .9 * (1 - U.clamp((t - 1.0) / .4, 0, 1));
      // motion trail
      for (var q = 6; q >= 1; q--) {
        ctx.save();
        ctx.globalAlpha = .1 * q / 6;
        DR.art.duck(ctx, {
          body: '#0b1a2b', belly: '#0b1a2b', head: '#0b1a2b', beak: '#0b1a2b',
          eye: '#0b1a2b', legs: '#0b1a2b', wing: '#0b1a2b', accessory: 'none'
        }, fx - q * 34, fy + q * 3, 1.25, { run: 0, air: true, flap: Math.sin(t * 22 - q) * .8, tilt: -0.18 });
        ctx.restore();
      }
      DR.art.duck(ctx, {
        body: '#ffd447', belly: '#fff3c4', head: '#ffd447', beak: '#f0932b',
        eye: '#20161f', legs: '#f0932b', wing: '#f0bd2b', accessory: 'none'
      }, fx, fy, 1.3, { run: 0, air: true, flap: Math.sin(t * 22) * .8, tilt: -0.18, time: t });
      ctx.restore();
    }

    /* ---------- title ---------- */
    ctx.save();
    ctx.textBaseline = 'middle';

    // DUCKY — slams in from the left
    if (t > 0.72) {
      var k1 = U.clamp((t - 0.72) / .45, 0, 1);
      var e1 = U.easeInCubic(k1);
      var x1 = -560 + e1 * (W / 2 + 560);
      var sc1 = 1 + (1 - k1) * 0.5;
      var sh = t > 1.15 && t < 1.4 ? (1.4 - t) * 46 : 0;
      ctx.save();
      ctx.translate(x1 + U.rand(-sh, sh) * .3, 236 + U.rand(-sh, sh) * .2);
      ctx.scale(sc1, sc1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5;
      letterBlock(ctx, 'DUCKY', 0, 0, 108, 'rgba(255,190,60,.45)', 'rgba(255,190,60,0)', 6);
      ctx.restore();
      letterBlock(ctx, 'DUCKY', 0, 0, 104, '#ffd447', '#3a2400', 6);
      ctx.restore();
    }

    // RUN — slams in from the right
    if (t > 1.2) {
      var k2 = U.clamp((t - 1.2) / .42, 0, 1);
      var e2 = U.easeInCubic(k2);
      var x2 = W + 520 - e2 * (W / 2 + 520);
      var sc2 = 1 + (1 - k2) * 0.5;
      var sh2 = t > 1.62 && t < 1.86 ? (1.86 - t) * 46 : 0;
      ctx.save();
      ctx.translate(x2 + U.rand(-sh2, sh2) * .3, 322 + U.rand(-sh2, sh2) * .2);
      ctx.scale(sc2, sc2);
      letterBlock(ctx, 'RUN', 0, 0, 96, '#ffffff', '#123a55', 34);
      ctx.restore();
    }

    // shine sweep across the finished logo
    if (t > 2.05 && t < 3.3) {
      var sk = (t - 2.05) / 1.25;
      ctx.save();
      ctx.beginPath(); ctx.rect(120, 175, 720, 210); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      var lx = 60 + sk * 900;
      var lg = ctx.createLinearGradient(lx - 90, 0, lx + 90, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)');
      lg.addColorStop(.5, 'rgba(255,255,255,.55)');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = lg;
      ctx.save(); ctx.translate(lx, 280); ctx.rotate(-.25); ctx.fillRect(-140, -190, 280, 380); ctx.restore();
      ctx.restore();
    }

    // credit line
    if (t > 2.35) {
      var ck = U.clamp((t - 2.35) / .6, 0, 1);
      ctx.save();
      ctx.globalAlpha = ck * (t > 5.0 ? U.clamp((LEN - t) / .6, 0, 1) : 1);
      ctx.translate(W / 2, 404 - (1 - U.easeOutCubic(ck)) * 16);
      ctx.font = '800 24px "Trebuchet MS",Verdana,sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(4,12,22,.8)';
      ctx.strokeText('Made by Jasper and Gabriel', 0, 0);
      ctx.fillStyle = '#fff6dd';
      ctx.fillText('Made by Jasper and Gabriel', 0, 0);
      ctx.restore();
    }
    ctx.restore();

    DR.fx.draw(ctx);

    // flash on the big chord
    if (t > 2.0 && t < 2.3) {
      ctx.save();
      ctx.globalAlpha = (2.3 - t) / .3 * .55;
      ctx.fillStyle = '#fff6dd'; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // skip hint
    if (t > 1.0 && t < LEN - .5) {
      ctx.save();
      ctx.globalAlpha = .35 + Math.sin(t * 4) * .12;
      ctx.font = '700 14px "Trebuchet MS",Verdana,sans-serif';
      ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
      ctx.fillText('press any key to skip', W - 24, H - 22);
      ctx.restore();
    }
  };

})(window.DR);
