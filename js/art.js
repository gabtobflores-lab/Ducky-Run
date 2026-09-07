/* ============================================================
   art.js — every sprite in the game, drawn procedurally.
   Shared duck rig is reused for the player, enemies and bosses.
   ============================================================ */
(function (DR) {
  'use strict';
  var U = DR.util;
  var Art = DR.art = {};
  var TAU = Math.PI * 2;

  var OUTLINE = '#20161f';

  function stroke(ctx, w) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.lineWidth = w || 2.2; ctx.strokeStyle = OUTLINE; ctx.stroke();
  }
  function ell(ctx, x, y, rx, ry, rot) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, TAU);
  }

  /* Offscreen buffer so sprites can be tinted/flashed as a unit. */
  var buf = document.createElement('canvas'), bctx = buf.getContext('2d');
  Art.tinted = function (ctx, cx, cy, w, h, tint, alpha, fn) {
    if (!tint || alpha <= 0.01) { ctx.save(); ctx.translate(cx, cy); fn(ctx); ctx.restore(); return; }
    w = Math.ceil(w); h = Math.ceil(h);
    if (buf.width < w) buf.width = w;
    if (buf.height < h) buf.height = h;
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, buf.width, buf.height);
    bctx.save(); bctx.translate(w / 2, h / 2); fn(bctx); bctx.restore();
    bctx.save();
    bctx.globalCompositeOperation = 'source-atop';
    bctx.globalAlpha = alpha;
    bctx.fillStyle = tint;
    bctx.fillRect(0, 0, w, h);
    bctx.restore();
    ctx.drawImage(buf, 0, 0, w, h, cx - w / 2, cy - h / 2, w, h);
  };

  /* Pre-rendered radial glows. Building a gradient per sprite per frame was
     the single most expensive thing on screen once hats started piling up. */
  var glowCache = {};
  function glowSprite(color) {
    var c = glowCache[color];
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    var g2 = c.getContext('2d');
    var grd = g2.createRadialGradient(32, 32, 1, 32, 32, 32);
    grd.addColorStop(0, color);
    grd.addColorStop(.45, U.rgba(color.indexOf('#') === 0 ? color : '#ffffff', .35));
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g2.fillStyle = grd;
    g2.fillRect(0, 0, 64, 64);
    glowCache[color] = c;
    return c;
  }
  Art.glow = function (ctx, x, y, r, color, alpha) {
    var sp = glowSprite(color);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.drawImage(sp, x - r, y - r, r * 2, r * 2);
    ctx.restore();
  };

  Art.shadow = function (ctx, x, y, w, a) {
    ctx.save();
    ctx.globalAlpha = a === undefined ? 0.3 : a;
    ctx.fillStyle = '#000';
    ell(ctx, x, y, w, w * 0.28, 0); ctx.fill();
    ctx.restore();
  };

  /* ============================================================
     DUCK RIG
     Origin = between the feet, duck faces +x. ~64px tall at s=1.
     ============================================================ */
  /**
   * @param {object} d  {body,belly,beak,accent,accessory,eye}
   * @param {object} o  {run,air,flap,tilt,squash,alpha,blink,dead,scaleX,long,fat,glow}
   */
  Art.duck = function (ctx, d, x, y, s, o) {
    o = o || {};
    var run = o.run || 0;
    var air = !!o.air;
    var sq = o.squash === undefined ? 1 : o.squash;
    var neckLen = o.long ? 22 : 0;
    var fat = o.fat || 1;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * (o.scaleX === undefined ? 1 : o.scaleX), s);
    if (o.tilt) ctx.rotate(o.tilt);
    ctx.scale(1 / Math.sqrt(sq), sq);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;

    var bodyY = -30 - (air ? 2 : Math.abs(Math.sin(run * TAU)) * 2.2);

    /* --- legs (behind the body) --- */
    ctx.save();
    ctx.strokeStyle = d.legs || '#f0932b';
    ctx.lineWidth = 4.4; ctx.lineCap = 'round';
    for (var i = 0; i < 2; i++) {
      var a = run * TAU + i * Math.PI;
      var hipX = -4 + i * 8, hipY = bodyY + 12;
      var fx, fy;
      if (air) { fx = hipX - 7 + i * 3; fy = -4 - i * 3; }
      else {
        fx = hipX + Math.cos(a) * 11;
        fy = -Math.max(0, Math.sin(a)) * 12;
      }
      var kx = (hipX + fx) / 2 + 2, ky = (hipY + fy) / 2 + 3;
      ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.quadraticCurveTo(kx, ky, fx, fy); ctx.stroke();
      // webbed foot
      ctx.save();
      ctx.fillStyle = d.legs || '#f0932b';
      ctx.beginPath();
      ctx.moveTo(fx - 4, fy); ctx.lineTo(fx + 9, fy - 1); ctx.lineTo(fx + 8, fy + 3); ctx.lineTo(fx - 4, fy + 3);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    /* --- tail --- */
    ctx.fillStyle = U.shade(d.body, -22);
    ctx.beginPath();
    ctx.moveTo(-16 * fat, bodyY - 6);
    ctx.quadraticCurveTo(-33 * fat, bodyY - 16, -30 * fat, bodyY - 1);
    ctx.quadraticCurveTo(-26 * fat, bodyY + 3, -16 * fat, bodyY + 4);
    ctx.closePath(); ctx.fill(); stroke(ctx, 2);

    /* --- body --- */
    ell(ctx, 0, bodyY, 21 * fat, 17 * fat, -0.08);
    ctx.fillStyle = d.body; ctx.fill(); stroke(ctx, 2.4);
    // belly
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, bodyY, 21 * fat, 17 * fat, -0.08, 0, TAU); ctx.clip();
    ctx.fillStyle = d.belly;
    ell(ctx, 3, bodyY + 8, 17 * fat, 10 * fat, -0.05); ctx.fill();
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff';
    ell(ctx, -4, bodyY - 9, 11, 5, -0.5); ctx.fill();
    ctx.restore();

    /* --- neck + head --- */
    var hx = 19, hy = -52 - neckLen;
    if (o.long) {
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 15; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(9, bodyY - 6); ctx.quadraticCurveTo(20, bodyY - 22, hx - 1, hy + 9); ctx.stroke();
      ctx.strokeStyle = d.neck || d.body; ctx.lineWidth = 11.5;
      ctx.beginPath(); ctx.moveTo(9, bodyY - 6); ctx.quadraticCurveTo(20, bodyY - 22, hx - 1, hy + 9); ctx.stroke();
    } else {
      ctx.fillStyle = d.body;
      ctx.beginPath();
      ctx.moveTo(6, bodyY - 8); ctx.quadraticCurveTo(10, bodyY - 20, 16, hy + 8);
      ctx.lineTo(24, hy + 8); ctx.quadraticCurveTo(22, bodyY - 16, 18, bodyY - 6);
      ctx.closePath(); ctx.fill();
    }

    // head
    ell(ctx, hx, hy, 12 * (d.headScale || 1), 11.5 * (d.headScale || 1), 0);
    ctx.fillStyle = d.head || d.body; ctx.fill(); stroke(ctx, 2.4);
    if (d.cheek) {
      ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, 12 * (d.headScale || 1), 0, TAU); ctx.clip();
      ctx.fillStyle = d.cheek; ell(ctx, hx + 6, hy + 3, 9, 7, 0); ctx.fill(); ctx.restore();
    }

    /* --- beak --- */
    ctx.fillStyle = d.beak;
    ctx.beginPath();
    ctx.moveTo(hx + 6, hy - 3);
    ctx.quadraticCurveTo(hx + 24, hy - 4, hx + 23, hy + 2);
    ctx.quadraticCurveTo(hx + 20, hy + 8, hx + 6, hy + 6);
    ctx.closePath(); ctx.fill(); stroke(ctx, 2);
    ctx.strokeStyle = U.shade(d.beak, -55); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(hx + 8, hy + 1.5); ctx.quadraticCurveTo(hx + 17, hy + 1.5, hx + 22, hy + 1); ctx.stroke();

    /* --- eye --- */
    var ex = hx + 4, ey = hy - 4;
    if (o.dead) {
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(ex - 4, ey - 4); ctx.lineTo(ex + 4, ey + 4);
      ctx.moveTo(ex + 4, ey - 4); ctx.lineTo(ex - 4, ey + 4);
      ctx.stroke();
    } else if (o.blink) {
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(ex - 4.5, ey); ctx.lineTo(ex + 4.5, ey); ctx.stroke();
    } else {
      ctx.fillStyle = '#fff'; ell(ctx, ex, ey, 5, 5.4, 0); ctx.fill(); stroke(ctx, 1.6);
      ctx.fillStyle = d.eye || '#20161f';
      ell(ctx, ex + 1.4, ey + 0.4, 2.7, 3.1, 0); ctx.fill();
      ctx.fillStyle = '#fff'; ell(ctx, ex + 2.6, ey - 1.4, 1.1, 1.1, 0); ctx.fill();
    }
    if (d.brow) {   // angry eyebrow for enemies
      ctx.strokeStyle = d.brow; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ex - 5, ey - 8); ctx.lineTo(ex + 5, ey - 4.5); ctx.stroke();
    }

    /* --- wing --- */
    var flap = o.flap === undefined ? Math.sin(run * TAU) * 0.22 : o.flap;
    ctx.save();
    ctx.translate(-2, bodyY - 1);
    ctx.rotate(flap);
    ell(ctx, 0, 2, 12.5 * fat, 8.5 * fat, 0.1);
    ctx.fillStyle = d.wing || U.shade(d.body, -14); ctx.fill(); stroke(ctx, 2);
    ctx.strokeStyle = U.shade(d.wing || d.body, -40); ctx.lineWidth = 1.3;
    for (var w = 0; w < 3; w++) {
      ctx.beginPath();
      ctx.moveTo(-8 + w * 2, 5 - w); ctx.quadraticCurveTo(0, 9 - w, 9 - w, 3 - w); ctx.stroke();
    }
    ctx.restore();

    /* --- accessory --- */
    Art.accessory(ctx, d, hx, hy, o);

    ctx.restore();
  };

  Art.accessory = function (ctx, d, hx, hy, o) {
    var k = d.accessory;
    if (!k || k === 'none') return;
    var t = o.time || 0;
    ctx.save();
    switch (k) {
      case 'propeller': {
        ctx.fillStyle = d.accent || '#4aa3ff';
        ctx.beginPath(); ctx.arc(hx - 1, hy - 8, 11.5, Math.PI * 1.04, Math.PI * 1.96); ctx.closePath(); ctx.fill(); stroke(ctx, 2);
        ctx.fillStyle = U.shade(d.accent || '#4aa3ff', -40);
        ctx.fillRect(hx - 12, hy - 9.5, 23, 3.4);
        ctx.fillStyle = '#ffd447'; ctx.fillRect(hx - 1.6, hy - 20, 3.2, 11);
        var pr = t * 15;
        ctx.save();
        ctx.translate(hx, hy - 20); ctx.rotate(pr);
        ctx.fillStyle = '#ffe58a';
        for (var b = 0; b < 2; b++) {
          ctx.save(); ctx.rotate(b * Math.PI);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(9, -4, 15, 0); ctx.quadraticCurveTo(9, 3, 0, 1); ctx.closePath();
          ctx.fill(); stroke(ctx, 1.4); ctx.restore();
        }
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, TAU); ctx.fill(); stroke(ctx, 1.2);
        ctx.restore();
        break;
      }
      case 'helmet': {
        ctx.fillStyle = d.accent || '#b8c6d6';
        ctx.beginPath(); ctx.arc(hx, hy - 2, 13, Math.PI, TAU); ctx.lineTo(hx + 13, hy + 1); ctx.lineTo(hx - 13, hy + 1); ctx.closePath();
        ctx.fill(); stroke(ctx, 2.2);
        ctx.fillStyle = U.shade(d.accent || '#b8c6d6', -50);
        ctx.fillRect(hx - 13, hy - 4, 26, 3.4);
        ctx.strokeStyle = '#c53030'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hx, hy - 15);
        ctx.quadraticCurveTo(hx - 8 + Math.sin(t * 8) * 2, hy - 24, hx - 16 + Math.sin(t * 8) * 3, hy - 16);
        ctx.stroke();
        break;
      }
      case 'headband': {
        ctx.fillStyle = d.accent || '#e0364f';
        ctx.fillRect(hx - 12, hy - 8, 25, 5.2);
        ctx.beginPath();
        ctx.moveTo(hx - 11, hy - 6);
        ctx.quadraticCurveTo(hx - 26, hy - 12 + Math.sin(t * 9) * 4, hx - 34, hy - 2 + Math.sin(t * 9 + 1) * 5);
        ctx.lineTo(hx - 33, hy + 3 + Math.sin(t * 9 + 1) * 5);
        ctx.quadraticCurveTo(hx - 24, hy - 4 + Math.sin(t * 9) * 4, hx - 11, hy - 1);
        ctx.closePath(); ctx.fill(); stroke(ctx, 1.6);
        break;
      }
      case 'bonnet': {
        ctx.fillStyle = d.accent || '#ff9ec4';
        ctx.beginPath(); ctx.arc(hx - 2, hy - 3, 14, Math.PI * 1.08, TAU * 0.99); ctx.closePath(); ctx.fill(); stroke(ctx, 2);
        ctx.fillStyle = '#fff';
        for (var f = 0; f < 5; f++) {
          ctx.beginPath();
          ctx.arc(hx - 9 + f * 4.5, hy - 14 - Math.sin(f) * 1.5, 3.1, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = '#ffd447'; ctx.beginPath(); ctx.arc(hx + 10, hy - 10, 3.2, 0, TAU); ctx.fill(); stroke(ctx, 1.4);
        break;
      }
      case 'crown': {
        ctx.fillStyle = '#ffd447';
        ctx.beginPath();
        ctx.moveTo(hx - 12, hy - 7); ctx.lineTo(hx - 12, hy - 17); ctx.lineTo(hx - 6, hy - 12);
        ctx.lineTo(hx, hy - 20); ctx.lineTo(hx + 6, hy - 12); ctx.lineTo(hx + 12, hy - 17); ctx.lineTo(hx + 12, hy - 7);
        ctx.closePath(); ctx.fill(); stroke(ctx, 2);
        ctx.fillStyle = '#ff5f6d'; ctx.beginPath(); ctx.arc(hx, hy - 10.5, 2.3, 0, TAU); ctx.fill();
        break;
      }
      case 'goggles': {
        ctx.strokeStyle = U.shade(d.accent || '#8a6a3a', -20); ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(hx - 12, hy - 6); ctx.lineTo(hx + 11, hy - 6); ctx.stroke();
        ctx.fillStyle = 'rgba(160,220,255,.85)';
        ctx.beginPath(); ctx.arc(hx + 5, hy - 6, 5.6, 0, TAU); ctx.fill(); stroke(ctx, 2);
        break;
      }
      case 'straw': {
        ctx.fillStyle = '#d9b45b';
        ctx.beginPath(); ctx.ellipse(hx - 1, hy - 8, 19, 5, 0, 0, TAU); ctx.fill(); stroke(ctx, 2);
        ctx.beginPath(); ctx.arc(hx - 1, hy - 8, 11, Math.PI, TAU); ctx.closePath(); ctx.fill(); stroke(ctx, 2);
        ctx.fillStyle = '#8d5524'; ctx.fillRect(hx - 12, hy - 11, 22, 3);
        break;
      }
      case 'cap': {
        ctx.fillStyle = d.accent || '#3ad2b5';
        ctx.beginPath(); ctx.arc(hx - 1, hy - 6, 12, Math.PI * 1.02, TAU); ctx.closePath(); ctx.fill(); stroke(ctx, 2);
        ctx.beginPath(); ctx.ellipse(hx + 12, hy - 6, 9, 3.2, 0, Math.PI * 1.1, TAU * 1.02); ctx.fill(); stroke(ctx, 1.8);
        break;
      }
    }
    ctx.restore();
  };

  /** Small head-only portrait — used for life icons and the progress marker. */
  Art.duckHead = function (ctx, d, x, y, s) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    ell(ctx, 0, 0, 12, 11.5, 0); ctx.fillStyle = d.head || d.body; ctx.fill(); stroke(ctx, 2.2);
    ctx.fillStyle = d.beak;
    ctx.beginPath();
    ctx.moveTo(6, -3); ctx.quadraticCurveTo(24, -4, 23, 2); ctx.quadraticCurveTo(20, 8, 6, 6);
    ctx.closePath(); ctx.fill(); stroke(ctx, 2);
    ctx.fillStyle = '#fff'; ell(ctx, 4, -4, 5, 5.4, 0); ctx.fill(); stroke(ctx, 1.5);
    ctx.fillStyle = d.eye || '#20161f'; ell(ctx, 5.4, -3.6, 2.7, 3.1, 0); ctx.fill();
    Art.accessory(ctx, d, 0, 0, { time: 0 });
    ctx.restore();
  };

  /* ============================================================
     COLLECTIBLES
     ============================================================ */
  Art.hat = function (ctx, x, y, s, t) {
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 3) * 3);
    ctx.scale(s * 1.24, s * 1.24);
    Art.glow(ctx, 0, 0, 24 + Math.sin(t * 6) * 2.5, '#ffd447', .5);
    var sx = Math.cos(t * 2.6);
    ctx.scale((0.55 + Math.abs(sx) * 0.45) * U.sign(sx || 1), 1);
    // cap
    ctx.fillStyle = '#ff5f6d';
    ctx.beginPath(); ctx.ellipse(0, 6, 13, 4.6, 0, 0, TAU); ctx.fill(); stroke(ctx, 2);
    ctx.fillStyle = '#52c5ff';
    ctx.beginPath(); ctx.arc(0, 6, 12, Math.PI, TAU); ctx.closePath(); ctx.fill(); stroke(ctx, 2);
    ctx.fillStyle = '#ffd447';
    ctx.beginPath(); ctx.moveTo(-12, 4); ctx.lineTo(12, 4); ctx.lineTo(11, 6.5); ctx.lineTo(-11, 6.5); ctx.closePath(); ctx.fill();
    // stalk + propeller
    ctx.fillStyle = '#ffd447'; ctx.fillRect(-1.5, -11, 3, 12);
    ctx.save();
    ctx.translate(0, -12); ctx.rotate(t * 16);
    ctx.fillStyle = '#fff6dd';
    for (var b = 0; b < 2; b++) {
      ctx.save(); ctx.rotate(b * Math.PI);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(10, -4.5, 16, 0); ctx.quadraticCurveTo(10, 3.5, 0, 1.2); ctx.closePath();
      ctx.fill(); stroke(ctx, 1.4); ctx.restore();
    }
    ctx.fillStyle = '#ff5f6d'; ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, TAU); ctx.fill(); stroke(ctx, 1.2);
    ctx.restore();
    ctx.restore();
  };

  Art.egg = function (ctx, x, y, s, t) {
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 2.4) * 4);
    ctx.rotate(Math.sin(t * 1.7) * 0.16);
    ctx.scale(s, s);
    Art.glow(ctx, 0, 0, 30, '#fff2b0', .38);
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.bezierCurveTo(11, -18, 15, -4, 15, 3);
    ctx.bezierCurveTo(15, 13, 8, 18, 0, 18);
    ctx.bezierCurveTo(-8, 18, -15, 13, -15, 3);
    ctx.bezierCurveTo(-15, -4, -11, -18, 0, -18);
    ctx.closePath();
    ctx.fillStyle = '#fff6dd'; ctx.fill(); stroke(ctx, 2.2);
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#ffe1ef'; ell(ctx, -5, -6, 12, 9, -0.4); ctx.fill();
    ctx.fillStyle = '#41d6c3'; ctx.beginPath(); ctx.arc(-5, 6, 3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffb6c9'; ctx.beginPath(); ctx.arc(6, 10, 2.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd447'; ctx.beginPath(); ctx.arc(6, -2, 2.2, 0, TAU); ctx.fill();
    ctx.globalAlpha = .7; ctx.fillStyle = '#fff'; ell(ctx, -5, -9, 5, 3, -0.5); ctx.fill();
    ctx.restore();
    ctx.restore();
  };

  Art.power = function (ctx, kind, x, y, s, t) {
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 3) * 3.5);
    ctx.scale(s, s);
    var col = kind === 'shield' ? '#41d6c3' : kind === 'magnet' ? '#ff6b7a' : kind === 'life' ? '#ffd447' : '#ffd447';
    Art.glow(ctx, 0, 0, 24, col, .42 + Math.sin(t * 7) * .12);
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = col; ctx.stroke();
    ctx.rotate(Math.sin(t * 2) * .12);
    if (kind === 'shield') {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, TAU); ctx.stroke();
      ctx.fillStyle = col; ctx.globalAlpha = .55; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
    } else if (kind === 'magnet') {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-9, 8); ctx.lineTo(-9, -1); ctx.arc(0, -1, 9, Math.PI, 0); ctx.lineTo(9, 8);
      ctx.lineTo(4, 8); ctx.lineTo(4, -1); ctx.arc(0, -1, 4, 0, Math.PI, true); ctx.lineTo(-4, 8);
      ctx.closePath(); ctx.fill(); stroke(ctx, 1.8);
      ctx.fillStyle = '#fff6dd'; ctx.fillRect(-9, 5, 5, 4); ctx.fillRect(4, 5, 5, 4);
    } else if (kind === 'life') {
      Art.duckHead(ctx, { body: '#ffd447', head: '#ffd447', beak: '#f0932b', eye: '#20161f', accessory: 'none' }, -4, 0, 0.62);
    } else {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(3, -11); ctx.lineTo(-7, 2); ctx.lineTo(-0.5, 2); ctx.lineTo(-3, 12); ctx.lineTo(8, -2); ctx.lineTo(1, -2); ctx.closePath();
      ctx.fill(); stroke(ctx, 1.8);
    }
    ctx.restore();
  };

  /* ============================================================
     OBSTACLES
     ============================================================ */
  var OB = {};

  OB.crate = function (ctx, e, t) {
    var w = 46, h = 54;
    ctx.fillStyle = '#a9713c'; U.roundRect(ctx, -w / 2, -h, w, h, 4); ctx.fill(); stroke(ctx, 2.4);
    ctx.fillStyle = '#c98d4f';
    for (var i = 0; i < 3; i++) { U.roundRect(ctx, -w / 2 + 4, -h + 5 + i * 16, w - 8, 11, 2); ctx.fill(); }
    ctx.strokeStyle = '#7a4f26'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-w / 2 + 3, -h + 3); ctx.lineTo(w / 2 - 3, -3); ctx.moveTo(w / 2 - 3, -h + 3); ctx.lineTo(-w / 2 + 3, -3); ctx.stroke();
    ctx.fillStyle = '#ffd447';
    for (var s = 0; s < 5; s++) {
      ctx.beginPath(); ctx.arc(-14 + s * 7, -h - 3 - Math.abs(Math.sin(s * 2.1)) * 3, 2.6, 0, TAU); ctx.fill();
    }
  };

  OB.decoy = function (ctx, e, t) {
    ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -66); ctx.stroke();
    ctx.fillStyle = '#5c3a1a';
    ctx.fillRect(-13, -46, 26, 5);
    ctx.save();
    ctx.translate(0, -66); ctx.rotate(Math.sin(t * 2 + e.seed) * .1);
    Art.duck(ctx, { body: '#8d5524', belly: '#a9713c', beak: '#5c3a1a', head: '#8d5524', eye: '#2b1a0d', accessory: 'none', legs: '#5c3a1a', wing: '#7a4a1e' }, 0, 0, .95, { run: 0, air: true, flap: -0.15 });
    ctx.restore();
    ctx.fillStyle = '#5c3a1a'; ell(ctx, 0, 0, 15, 5, 0); ctx.fill(); stroke(ctx, 2);
  };

  OB.toystack = function (ctx, e, t) {
    var cols = ['#ffd447', '#ff8fa8', '#8fd3ff', '#7ed957'];
    for (var i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(Math.sin(t * 2.4 + i + e.seed) * (1.4 + i), -i * 31);
      Art.duck(ctx, { body: cols[i], belly: U.shade(cols[i], 35), beak: '#f0932b', head: cols[i], eye: '#20161f', accessory: 'none', legs: '#f0932b' }, 0, 0, .68, { run: 0, air: true, flap: -0.2 });
      ctx.restore();
    }
  };

  OB.reeds = function (ctx, e, t) {
    for (var i = 0; i < 5; i++) {
      var ox = -18 + i * 9, hgt = 26 + ((i * 7 + e.seed * 13) % 12);
      var sway = Math.sin(t * 2.2 + i + e.seed) * 4;
      ctx.strokeStyle = '#3f8f4a'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ox, 0); ctx.quadraticCurveTo(ox + sway * .5, -hgt * .6, ox + sway, -hgt); ctx.stroke();
      ctx.fillStyle = '#6b4423';
      U.roundRect(ctx, ox + sway - 3, -hgt - 11, 6, 13, 3); ctx.fill(); stroke(ctx, 1.6);
    }
  };

  OB.puddle = function (ctx, e, t) {
    ctx.save();
    ctx.globalAlpha = .9;
    ctx.fillStyle = e.tint || '#2a3f6b';
    ell(ctx, 0, -4, 34, 9, 0); ctx.fill(); stroke(ctx, 2);
    ctx.globalAlpha = .55; ctx.fillStyle = '#8fd3ff';
    for (var i = 0; i < 3; i++) {
      var r = ((t * 34 + i * 22 + e.seed * 30) % 34);
      ctx.globalAlpha = .5 * (1 - r / 34);
      ctx.beginPath(); ctx.ellipse(0, -4, r, r * .26, 0, 0, TAU); ctx.lineWidth = 1.8; ctx.strokeStyle = '#bfe9ff'; ctx.stroke();
    }
    ctx.restore();
  };

  OB.brush = function (ctx, e, t) {
    ctx.fillStyle = '#c98d4f'; U.roundRect(ctx, -24, -14, 48, 14, 5); ctx.fill(); stroke(ctx, 2.2);
    ctx.strokeStyle = '#eef3f7'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    for (var i = 0; i < 9; i++) {
      var x = -20 + i * 5;
      ctx.beginPath(); ctx.moveTo(x, -14); ctx.lineTo(x + Math.sin(i + e.seed) * 1.6, -30); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.arc(-12, -34 - Math.sin(t * 3) * 2, 4, 0, TAU); ctx.fill();
  };

  OB.soap = function (ctx, e, t) {
    ctx.fillStyle = '#a5f0e6'; U.roundRect(ctx, -26, -17, 52, 17, 7); ctx.fill(); stroke(ctx, 2.2);
    ctx.fillStyle = 'rgba(255,255,255,.65)'; U.roundRect(ctx, -20, -14, 24, 5, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (var i = 0; i < 4; i++) {
      var yy = -20 - ((t * 26 + i * 17 + e.seed * 20) % 30);
      ctx.beginPath(); ctx.arc(-14 + i * 9, yy, 3.6, 0, TAU); ctx.fill();
    }
  };

  OB.barrel = function (ctx, e, t) {
    ctx.save();
    ctx.translate(0, -20);
    ctx.rotate(e.roll || 0);
    ctx.fillStyle = '#b5651d'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill(); stroke(ctx, 2.4);
    ctx.strokeStyle = '#7a4f26'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.moveTo(0, -20); ctx.lineTo(0, 20); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.beginPath(); ctx.arc(16, -6, 5, 0, TAU); ctx.fill();
  };

  OB.sprinkler = function (ctx, e, t) {
    ctx.fillStyle = '#557a8c'; U.roundRect(ctx, -9, -16, 18, 16, 4); ctx.fill(); stroke(ctx, 2);
    ctx.fillStyle = '#8fb3c4'; U.roundRect(ctx, -4, -24, 8, 10, 3); ctx.fill(); stroke(ctx, 1.8);
    if (e.active) {
      ctx.save();
      ctx.globalAlpha = .78;
      var g = ctx.createLinearGradient(0, -24, 0, -132);
      g.addColorStop(0, 'rgba(150,225,255,.95)');
      g.addColorStop(.65, 'rgba(150,225,255,.7)');
      g.addColorStop(1, 'rgba(190,240,255,.42)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-8, -24); ctx.lineTo(-17, -126); ctx.lineTo(17, -126); ctx.lineTo(8, -24); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#dff6ff';
      for (var i = 0; i < 9; i++) {
        var yy = -26 - ((t * 260 + i * 15 + e.seed * 40) % 106);
        ctx.beginPath(); ctx.arc(Math.sin(i * 2 + t * 6) * 10, yy, 2.8, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = 'rgba(220,246,255,.85)';
      for (var c2 = 0; c2 < 4; c2++) {
        ctx.beginPath();
        ctx.arc(-12 + c2 * 8, -126 + Math.sin(t * 5 + c2) * 4, 7, 0, TAU); ctx.fill();
      }
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(150,225,255,' + (0.15 + Math.sin(t * 9) * 0.1) + ')';
      ctx.beginPath(); ctx.arc(0, -26, 4, 0, TAU); ctx.fill();
    }
  };

  OB.zap = function (ctx, e, t) {
    ctx.strokeStyle = '#6d7b8c'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(-22, -122); ctx.moveTo(22, 0); ctx.lineTo(22, -122); ctx.stroke();
    ctx.fillStyle = '#ffd447';
    ctx.beginPath(); ctx.arc(-22, -124, 5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(22, -124, 5, 0, TAU); ctx.fill();
    if (e.active) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var l = 0; l < 3; l++) {
        ctx.strokeStyle = l === 0 ? '#fff' : '#8fd3ff';
        ctx.lineWidth = l === 0 ? 3.4 : 1.8;
        ctx.beginPath(); ctx.moveTo(-22, -124);
        for (var i = 1; i <= 6; i++) {
          ctx.lineTo(-22 + (44 / 6) * i, -124 + Math.sin(t * 40 + i * 3 + l) * 11);
        }
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -122);
        for (var k2 = 1; k2 <= 5; k2++) ctx.lineTo(Math.sin(t * 34 + k2 * 2 + l) * 14, -122 + k2 * 24);
        ctx.stroke();
      }
      ctx.globalAlpha = .32; ctx.fillStyle = '#8fd3ff';
      ctx.fillRect(-24, -128, 48, 128);
      ctx.restore();
    } else if (e.warn) {
      ctx.save(); ctx.globalAlpha = .25 + Math.sin(t * 22) * .2;
      ctx.fillStyle = '#ffd447'; ctx.fillRect(-24, -128, 48, 128); ctx.restore();
    }
  };

  OB.hook = function (ctx, e, t) {
    var sw = e.swing || 0;
    ctx.save();
    ctx.translate(0, -150);
    ctx.rotate(sw);
    ctx.strokeStyle = '#9aa7b4'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(0, 92); ctx.stroke();
    ctx.strokeStyle = '#cfd8e2'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 92); ctx.quadraticCurveTo(0, 112, -12, 110); ctx.quadraticCurveTo(-20, 106, -17, 97);
    ctx.stroke();
    ctx.fillStyle = '#ff5f6d'; ctx.beginPath(); ctx.arc(0, 88, 5, 0, TAU); ctx.fill(); stroke(ctx, 1.6);
    ctx.restore();
  };

  OB.net = function (ctx, e, t) {
    var top = -168, bot = -60 + Math.sin(t * 1.8 + e.seed) * 3;
    ctx.strokeStyle = 'rgba(230,240,250,.85)'; ctx.lineWidth = 2;
    for (var i = -3; i <= 3; i++) {
      ctx.beginPath(); ctx.moveTo(i * 11, top); ctx.lineTo(i * 11 + Math.sin(t + i) * 3, bot); ctx.stroke();
    }
    for (var j = 0; j < 6; j++) {
      var y = top + (bot - top) * (j / 5);
      ctx.beginPath(); ctx.moveTo(-34, y); ctx.quadraticCurveTo(0, y + 5, 34, y); ctx.stroke();
    }
    ctx.fillStyle = '#8d5524'; ctx.fillRect(-38, top - 5, 76, 6);
    ctx.fillStyle = '#e0364f';
    ctx.beginPath(); ctx.arc(0, bot + 2, 4, 0, TAU); ctx.fill();
  };

  OB.bounce = function (ctx, e, t) {
    var sq = e.squash || 0;
    ctx.save();
    ctx.translate(0, -8 + sq * 8);
    ctx.scale(1 + sq * .25, 1 - sq * .45);
    ctx.fillStyle = '#e8c07a'; U.roundRect(ctx, -28, -18, 56, 20, 8); ctx.fill(); stroke(ctx, 2.4);
    ctx.fillStyle = '#fff0cf'; U.roundRect(ctx, -23, -14, 46, 9, 5); ctx.fill();
    ctx.fillStyle = '#c99a52';
    for (var i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-17 + i * 8.5, -10, 1.8, 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = .35 + Math.sin(t * 5) * .12; ctx.strokeStyle = '#ffd447'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-8, -34); ctx.lineTo(0, -46); ctx.lineTo(8, -34); ctx.stroke();
    ctx.restore();
  };

  Art.obstacle = function (ctx, e, x, y, s, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    var fn = OB[e.kind];
    if (fn) fn(ctx, e, t);
    ctx.restore();
  };
  Art.obstacleKinds = OB;

  /* ============================================================
     ENEMIES
     ============================================================ */
  var EN = {};

  EN.goose = function (ctx, e, t) {
    Art.duck(ctx, {
      body: '#d7dbe0', belly: '#f2f4f7', head: '#2f3640', neck: '#2f3640', beak: '#f0932b',
      eye: '#fff', accessory: 'none', legs: '#e08a2b', wing: '#b9c0c8', cheek: '#fff', brow: '#111'
    }, 0, 0, 0.88, { run: e.anim, long: true, time: t, fat: 1.05 });
  };

  EN.duckling = function (ctx, e, t) {
    Art.duck(ctx, {
      body: '#4a3f5c', belly: '#6b5b80', head: '#4a3f5c', beak: '#ffa62b',
      eye: '#ff5f6d', accessory: 'none', legs: '#ffa62b', wing: '#3b3249', brow: '#1c1524'
    }, 0, 0, .58, { run: e.anim, time: t });
  };

  EN.drone = function (ctx, e, t) {
    ctx.save();
    ctx.translate(0, Math.sin(t * 4 + e.seed) * 5);
    Art.duck(ctx, {
      body: '#7b8cff', belly: '#a9b4ff', head: '#7b8cff', beak: '#ffa62b', eye: '#20161f',
      accessory: 'propeller', accent: '#3ad2b5', legs: '#ffa62b', wing: '#6675e0', brow: '#241a33'
    }, 0, 0, .72, { run: 0, air: true, flap: Math.sin(t * 22) * .7, time: t });
    ctx.restore();
  };

  EN.frog = function (ctx, e, t) {
    var sq = e.squat || 0;
    ctx.save();
    ctx.scale(1 + sq * .2, 1 - sq * .25);
    // back legs
    ctx.fillStyle = '#2f8f3f';
    ctx.beginPath(); ctx.ellipse(-14, -12, 10, 7, -0.5, 0, TAU); ctx.fill(); stroke(ctx, 2);
    ctx.beginPath(); ctx.ellipse(14, -12, 10, 7, 0.5, 0, TAU); ctx.fill(); stroke(ctx, 2);
    // body
    ell(ctx, 0, -20, 20, 16, 0); ctx.fillStyle = '#3fa74f'; ctx.fill(); stroke(ctx, 2.4);
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, -20, 20, 16, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = '#d9f2a5'; ell(ctx, 0, -10, 14, 8, 0); ctx.fill();
    ctx.fillStyle = '#2b7a38';
    ctx.beginPath(); ctx.arc(-9, -27, 3.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(7, -30, 2.8, 0, TAU); ctx.fill();
    ctx.restore();
    // eyes
    [-9, 9].forEach(function (ex) {
      ctx.fillStyle = '#3fa74f'; ctx.beginPath(); ctx.arc(ex, -35, 7.5, 0, TAU); ctx.fill(); stroke(ctx, 2.2);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, -36, 4.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#20161f'; ctx.beginPath(); ctx.arc(ex + 1, -36, 2.4, 0, TAU); ctx.fill();
    });
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -20, 11, 0.35, Math.PI - 0.35); ctx.stroke();
    ctx.restore();
  };

  EN.crab = function (ctx, e, t) {
    var wob = Math.sin(t * 8 + e.seed) * 2;
    ctx.save();
    ctx.translate(wob, 0);
    ctx.strokeStyle = '#a8232f'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    for (var i = 0; i < 3; i++) {
      var lx = -14 + i * 12;
      ctx.beginPath(); ctx.moveTo(lx, -14); ctx.lineTo(lx - 5, -2 + Math.sin(t * 10 + i) * 2); ctx.stroke();
    }
    // claws
    [[-24, -22], [24, -22]].forEach(function (p, i) {
      ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate((i ? -1 : 1) * (0.2 + Math.sin(t * 5) * .18));
      ctx.fillStyle = '#e04b3a';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-9, -10, 2, -13); ctx.quadraticCurveTo(9, -8, 3, 2); ctx.closePath();
      ctx.fill(); stroke(ctx, 2); ctx.restore();
    });
    // shell
    ell(ctx, 0, -22, 22, 15, 0); ctx.fillStyle = '#e04b3a'; ctx.fill(); stroke(ctx, 2.4);
    ctx.fillStyle = '#ff8a72'; ell(ctx, 0, -25, 16, 8, 0); ctx.fill();
    // spikes = "don't dash me"
    ctx.fillStyle = '#fff2c4';
    for (var s2 = -2; s2 <= 2; s2++) {
      ctx.beginPath(); ctx.moveTo(s2 * 8 - 4, -35); ctx.lineTo(s2 * 8, -45); ctx.lineTo(s2 * 8 + 4, -35); ctx.closePath();
      ctx.fill(); stroke(ctx, 1.6);
    }
    [-8, 8].forEach(function (ex) {
      ctx.strokeStyle = '#a8232f'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(ex, -30); ctx.lineTo(ex, -38); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, -40, 4, 0, TAU); ctx.fill(); stroke(ctx, 1.6);
      ctx.fillStyle = '#20161f'; ctx.beginPath(); ctx.arc(ex + 1, -40, 2, 0, TAU); ctx.fill();
    });
    ctx.restore();
  };

  // Enemy sprites are authored feet-at-origin; tinted() centres a 150px box,
  // so the caller passes the feet position and we offset inside.
  Art.enemyAt = function (ctx, e, x, y, s, t) {
    var fn = EN[e.kind];
    if (!fn) return;
    if (!e.flash) {
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s); fn(ctx, e, t); ctx.restore();
      return;
    }
    var W = 170, H = 170;
    Art.tinted(ctx, x, y - H / 2 + 44 * s, W, H, '#fff', e.flash, function (c) {
      c.save(); c.translate(0, H / 2 - 44 * s); c.scale(s, s); fn(c, e, t); c.restore();
    });
  };
  Art.enemyKinds = EN;

  /* ============================================================
     PROJECTILES
     ============================================================ */
  Art.projectile = function (ctx, p, x, y, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.rot || 0);
    switch (p.art) {
      case 'seed':
        ctx.fillStyle = '#6b4423'; ell(ctx, 0, 0, 8, 5, 0); ctx.fill(); stroke(ctx, 1.8);
        ctx.fillStyle = '#c99a52'; ell(ctx, -2, -1, 4, 2.4, 0); ctx.fill();
        break;
      case 'bubble':
        ctx.strokeStyle = 'rgba(200,245,255,.95)'; ctx.lineWidth = 2.4;
        ctx.fillStyle = 'rgba(140,220,255,.28)';
        ctx.beginPath(); ctx.arc(0, 0, p.r || 13, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.8)';
        ctx.beginPath(); ctx.arc(-(p.r || 13) * .35, -(p.r || 13) * .35, (p.r || 13) * .2, 0, TAU); ctx.fill();
        break;
      case 'feather':
        ctx.fillStyle = p.color || '#fff6dd';
        ctx.beginPath(); ctx.moveTo(0, -9); ctx.quadraticCurveTo(9, 0, 0, 9); ctx.quadraticCurveTo(-9, 0, 0, -9);
        ctx.fill(); stroke(ctx, 1.6);
        break;
      case 'bolt':
        Art.glow(ctx, 0, 0, 26, '#8fd3ff', .55);
        ctx.fillStyle = '#fff2a8';
        ctx.beginPath();
        ctx.moveTo(7, -20); ctx.lineTo(-10, 4); ctx.lineTo(0, 4); ctx.lineTo(-7, 22);
        ctx.lineTo(13, -3); ctx.lineTo(2, -3); ctx.closePath();
        ctx.fill(); stroke(ctx, 2);
        break;
      case 'corn':
        ctx.fillStyle = '#ffd447'; ell(ctx, 0, 0, 11, 6.5, 0); ctx.fill(); stroke(ctx, 1.8);
        ctx.fillStyle = '#e8a52b';
        for (var i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * 5, 0, 1.8, 0, TAU); ctx.fill(); }
        break;
      case 'strike': {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        var a = 0.55 + Math.random() * 0.4;
        var gr = ctx.createLinearGradient(0, -150, 0, 0);
        gr.addColorStop(0, 'rgba(160,220,255,' + (a * .5) + ')');
        gr.addColorStop(1, 'rgba(200,240,255,' + (a * .12) + ')');
        ctx.fillStyle = gr; ctx.fillRect(-22, -150, 44, 150);
        for (var b2 = 0; b2 < 3; b2++) {
          ctx.strokeStyle = b2 === 0 ? 'rgba(255,255,255,' + a + ')' : 'rgba(150,215,255,' + (a * .8) + ')';
          ctx.lineWidth = b2 === 0 ? 4 : 2;
          ctx.beginPath(); ctx.moveTo(0, -170);
          for (var k3 = 1; k3 <= 6; k3++) ctx.lineTo(Math.sin(t * 44 + k3 * 2.2 + b2) * 13, -170 + k3 * 28);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case 'ring':
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = p.color || '#ffd6a5'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.ellipse(0, 0, p.r || 20, (p.r || 20) * .55, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 0, p.r || 20, (p.r || 20) * .55, 0, 0, TAU); ctx.stroke();
        ctx.restore();
        break;
      default:
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };

  /* ============================================================
     BOSSES
     ============================================================ */
  var BOSS = {};

  BOSS.honker = function (ctx, b, t) {
    var flap = Math.sin(t * 5) * .5 - .1;
    // wings behind
    ctx.save();
    [[-1, -0.1], [1, 0.1]].forEach(function (w) {
      ctx.save(); ctx.translate(0, -20); ctx.rotate(flap * w[0] * .6 + w[1]);
      ctx.fillStyle = '#c3c9d1';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-60 * w[0], -46, -104 * w[0], -6); ctx.quadraticCurveTo(-58 * w[0], 16, 0, 12); ctx.closePath();
      ctx.fill(); stroke(ctx, 2.6); ctx.restore();
    });
    ctx.restore();
    Art.duck(ctx, {
      body: '#e6eaef', belly: '#fbfcfe', head: '#2f3640', neck: '#2f3640', beak: '#f0932b', eye: '#fff',
      accessory: 'crown', legs: '#e08a2b', wing: '#c8cfd7', cheek: '#fff', brow: '#111'
    }, 0, 0, 2.5, { run: 0, air: true, long: true, time: t, flap: flap * .4, fat: 1.12 });
  };

  BOSS.strawman = function (ctx, b, t) {
    // pole + straw skirt
    ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -60); ctx.stroke();
    ctx.strokeStyle = '#d9b45b'; ctx.lineWidth = 3;
    for (var i = -6; i <= 6; i++) {
      ctx.beginPath(); ctx.moveTo(0, -50); ctx.lineTo(i * 9, -6 + Math.sin(t * 3 + i) * 3); ctx.stroke();
    }
    ctx.save();
    ctx.translate(0, -52 + Math.sin(t * 2.2) * 5);
    Art.duck(ctx, {
      body: '#e8c07a', belly: '#f6ddab', head: '#e8c07a', beak: '#c0392b', eye: '#e0364f',
      accessory: 'straw', legs: '#8d5524', wing: '#d1a75f', brow: '#5c3a1a'
    }, 0, 0, 2.1, { run: 0, air: true, time: t, flap: Math.sin(t * 3) * .35 });
    ctx.restore();
    // stitched grin
    ctx.strokeStyle = '#5c3a1a'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(30, -140); ctx.lineTo(58, -140); ctx.stroke();
  };

  BOSS.mecha = function (ctx, b, t) {
    // jets
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var j = -1; j <= 1; j += 2) {
      var g = ctx.createLinearGradient(j * 26, 8, j * 26, 60 + Math.sin(t * 20) * 12);
      g.addColorStop(0, 'rgba(255,220,140,.9)'); g.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(j * 18, 4); ctx.lineTo(j * 34, 4); ctx.lineTo(j * 26, 62 + Math.sin(t * 20 + j) * 14); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    Art.duck(ctx, {
      body: '#ffd447', belly: '#fff0b0', head: '#ffd447', beak: '#f0932b', eye: '#ff3b57',
      accessory: 'none', legs: '#b8c6d6', wing: '#e8bf2b'
    }, 0, 0, 2.4, { run: 0, air: true, time: t, flap: -0.1 });
    // metal jaw + bolts
    ctx.save();
    ctx.fillStyle = '#b8c6d6';
    U.roundRect(ctx, 56, -122, 60, 22, 5); ctx.fill(); stroke(ctx, 2.4);
    ctx.fillStyle = '#8d9aab';
    for (var i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(66 + i * 14, -111, 3, 0, TAU); ctx.fill(); }
    // visor
    ctx.fillStyle = 'rgba(255,60,90,.85)';
    U.roundRect(ctx, 30, -152, 40, 12, 5); ctx.fill(); stroke(ctx, 2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,80,110,' + (0.4 + Math.sin(t * 8) * 0.25) + ')';
    U.roundRect(ctx, 30, -152, 40, 12, 5); ctx.fill(); ctx.restore();
    ctx.restore();
  };

  BOSS.drake = function (ctx, b, t) {
    // storm cloud shroud
    ctx.save();
    ctx.globalAlpha = .55;
    ctx.fillStyle = '#3b4a63';
    for (var i = 0; i < 7; i++) {
      var a = t * .6 + i * 0.9;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 62, -60 + Math.sin(a * 1.3) * 26, 30 + (i % 3) * 8, 0, TAU); ctx.fill();
    }
    ctx.restore();
    Art.duck(ctx, {
      body: '#5a6b8c', belly: '#8fa3c4', head: '#3f4d68', beak: '#ffd447', eye: '#8fd3ff',
      accessory: 'goggles', accent: '#8a6a3a', legs: '#ffd447', wing: '#495a78', brow: '#1b2436'
    }, 0, 0, 2.4, { run: 0, air: true, long: true, time: t, flap: Math.sin(t * 6) * .6 });
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(160,220,255,' + (0.35 + Math.sin(t * 12) * 0.25) + ')';
    ctx.lineWidth = 2.4;
    for (var l = 0; l < 3; l++) {
      ctx.beginPath();
      var sx = -70 + l * 60;
      ctx.moveTo(sx, -140);
      for (var k = 1; k <= 4; k++) ctx.lineTo(sx + Math.sin(t * 20 + k + l) * 12, -140 + k * 26);
      ctx.stroke();
    }
    ctx.restore();
  };

  BOSS.gander = function (ctx, b, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(0, -80, 10, 0, -80, 190);
    g.addColorStop(0, 'rgba(255,214,71,.45)'); g.addColorStop(1, 'rgba(255,214,71,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -80, 190, 0, TAU); ctx.fill();
    ctx.restore();
    // cape
    ctx.save();
    ctx.fillStyle = '#8e1b3a';
    ctx.beginPath();
    ctx.moveTo(-16, -140);
    ctx.quadraticCurveTo(-110 + Math.sin(t * 3) * 14, -100, -86 + Math.sin(t * 3) * 18, -4);
    ctx.quadraticCurveTo(-40, -30, -10, -20);
    ctx.closePath(); ctx.fill(); stroke(ctx, 2.6);
    ctx.restore();
    var flap = Math.sin(t * 4.4) * .5;
    ctx.save();
    [[-1, -.1], [1, .1]].forEach(function (w) {
      ctx.save(); ctx.translate(0, -30); ctx.rotate(flap * w[0] * .55 + w[1]);
      ctx.fillStyle = '#ffe58a';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-66 * w[0], -52, -118 * w[0], -4); ctx.quadraticCurveTo(-62 * w[0], 20, 0, 14); ctx.closePath();
      ctx.fill(); stroke(ctx, 2.6); ctx.restore();
    });
    ctx.restore();
    Art.duck(ctx, {
      body: '#ffd447', belly: '#fff3c4', head: '#ffd447', beak: '#e07a1b', eye: '#8e1b3a',
      accessory: 'crown', legs: '#e07a1b', wing: '#f0bd2b', brow: '#8a5a00'
    }, 0, 0, 2.7, { run: 0, air: true, long: true, time: t, flap: flap * .4, fat: 1.08 });
  };

  Art.boss = function (ctx, b, x, y, s, t) {
    var fn = BOSS[b.art];
    if (!fn) return;
    if (!b.flash) {
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s); fn(ctx, b, t); ctx.restore();
      return;
    }
    var W = 520, H = 520;
    Art.tinted(ctx, x, y - H / 2 + 90 * s, W, H, '#fff', b.flash, function (c) {
      c.save(); c.translate(0, H / 2 - 90 * s); c.scale(s, s); fn(c, b, t); c.restore();
    });
  };
  Art.bossKinds = BOSS;

})(window.DR);
