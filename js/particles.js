/* ============================================================
   particles.js — pooled particle system + floating score popups
   ============================================================ */
(function (DR) {
  'use strict';
  var U = DR.util;

  var MAX = 460;
  var pool = [], live = [];
  for (var i = 0; i < MAX; i++) pool.push({});

  var P = DR.fx = {};

  function take() {
    if (pool.length) return pool.pop();
    // recycle the oldest particle rather than growing without bound
    return live.shift();
  }

  /**
   * shape: 'dot' | 'spark' | 'feather' | 'ring' | 'star' | 'smoke' | 'shard' | 'bubble'
   */
  P.spawn = function (o) {
    var p = take();
    p.x = o.x; p.y = o.y;
    p.vx = o.vx || 0; p.vy = o.vy || 0;
    p.g = o.g === undefined ? 900 : o.g;
    p.drag = o.drag === undefined ? 0.4 : o.drag;
    p.life = p.max = o.life || 0.6;
    p.size = o.size || 4;
    p.grow = o.grow || 0;
    p.color = o.color || '#fff';
    p.shape = o.shape || 'dot';
    p.rot = o.rot || 0;
    p.spin = o.spin || 0;
    p.alpha = o.alpha === undefined ? 1 : o.alpha;
    p.add = !!o.add;
    p.wob = o.wob || 0;
    p.t = 0;
    live.push(p);
    return p;
  };

  P.clear = function () { while (live.length) pool.push(live.pop()); };

  P.update = function (dt) {
    for (var i = live.length - 1; i >= 0; i--) {
      var p = live[i];
      p.t += dt;
      p.life -= dt;
      if (p.life <= 0) { live.splice(i, 1); pool.push(p); continue; }
      p.vy += p.g * dt;
      var d = Math.pow(1 - p.drag, dt * 60 / 60);
      p.vx *= Math.pow(1 - p.drag * dt, 1);
      p.vy *= Math.pow(1 - p.drag * dt, 1);
      p.x += p.vx * dt + (p.wob ? Math.sin(p.t * 9) * p.wob * dt * 60 : 0);
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      p.size += p.grow * dt;
    }
  };

  /** World particles scroll with the level; pass scroll = camera delta. */
  P.scroll = function (dx) {
    for (var i = 0; i < live.length; i++) live[i].x -= dx;
  };

  P.draw = function (ctx) {
    for (var i = 0; i < live.length; i++) {
      var p = live[i];
      var k = U.clamp(p.life / p.max, 0, 1);
      var a = p.alpha * (k > .75 ? 1 : k / .75);
      if (a <= 0.01 || p.size <= 0.2) continue;
      ctx.save();
      ctx.globalAlpha = a;
      if (p.add) ctx.globalCompositeOperation = 'lighter';
      ctx.translate(p.x, p.y);
      if (p.rot) ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      switch (p.shape) {
        case 'spark':
          ctx.fillRect(-p.size * 1.7, -p.size * 0.32, p.size * 3.4, p.size * 0.64);
          break;
        case 'ring':
          ctx.lineWidth = Math.max(1, p.size * 0.22);
          ctx.beginPath(); ctx.arc(0, 0, p.size, 0, 6.2832); ctx.stroke();
          break;
        case 'star':
          U.star(ctx, 0, 0, p.size, p.size * 0.44, 5, 0); ctx.fill();
          break;
        case 'shard':
          ctx.beginPath(); ctx.moveTo(0, -p.size); ctx.lineTo(p.size * .7, p.size * .6); ctx.lineTo(-p.size * .7, p.size * .5); ctx.closePath(); ctx.fill();
          break;
        case 'smoke':
          ctx.globalAlpha = a * 0.5;
          ctx.beginPath(); ctx.arc(0, 0, p.size, 0, 6.2832); ctx.fill();
          break;
        case 'bubble':
          ctx.globalAlpha = a * 0.7;
          ctx.lineWidth = Math.max(1, p.size * .16);
          ctx.beginPath(); ctx.arc(0, 0, p.size, 0, 6.2832); ctx.stroke();
          ctx.globalAlpha = a * 0.22; ctx.fill();
          break;
        case 'feather':
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.quadraticCurveTo(p.size * .85, 0, 0, p.size);
          ctx.quadraticCurveTo(-p.size * .85, 0, 0, -p.size);
          ctx.fill();
          ctx.globalAlpha = a * .55;
          ctx.lineWidth = Math.max(.7, p.size * .1);
          ctx.beginPath(); ctx.moveTo(0, -p.size); ctx.lineTo(0, p.size); ctx.stroke();
          break;
        default:
          ctx.beginPath(); ctx.arc(0, 0, p.size, 0, 6.2832); ctx.fill();
      }
      ctx.restore();
    }
  };

  /* ---------------- presets ---------------- */

  P.burst = function (x, y, n, opt) {
    opt = opt || {};
    for (var i = 0; i < n; i++) {
      var a = opt.dir === undefined ? Math.random() * 6.2832 : opt.dir + U.rand(-1, 1) * (opt.spread || 1);
      var sp = U.rand(opt.spMin || 60, opt.spMax || 320);
      P.spawn({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        g: opt.g === undefined ? 640 : opt.g, drag: opt.drag === undefined ? 1.4 : opt.drag,
        life: U.rand(opt.lifeMin || .28, opt.lifeMax || .62),
        size: U.rand(opt.sizeMin || 2, opt.sizeMax || 5),
        color: Array.isArray(opt.color) ? U.pick(opt.color) : (opt.color || '#fff'),
        shape: opt.shape || 'dot', add: opt.add, spin: U.rand(-9, 9), grow: opt.grow || 0
      });
    }
  };

  P.ring = function (x, y, color, size, life) {
    P.spawn({ x: x, y: y, vx: 0, vy: 0, g: 0, drag: 0, life: life || .38, size: size || 8, grow: (size || 8) * 5.5, color: color, shape: 'ring', add: true, alpha: .9 });
  };

  P.collect = function (x, y, color) {
    P.burst(x, y, 9, { color: [color, '#fff', '#ffe9a8'], sizeMin: 2, sizeMax: 4.2, spMax: 210, g: 240, shape: 'star', add: true, lifeMax: .5 });
    P.ring(x, y, color, 7, .3);
  };

  P.feathers = function (x, y, n, colors) {
    for (var i = 0; i < n; i++) {
      P.spawn({
        x: x + U.rand(-12, 12), y: y + U.rand(-16, 8),
        vx: U.rand(-190, 130), vy: U.rand(-260, -40),
        g: 260, drag: 1.6, life: U.rand(.7, 1.4), size: U.rand(4, 8),
        color: Array.isArray(colors) ? U.pick(colors) : colors, shape: 'feather',
        spin: U.rand(-6, 6), wob: U.rand(.4, 1.3)
      });
    }
  };

  P.dust = function (x, y, dir, color) {
    P.spawn({
      x: x + U.rand(-4, 4), y: y, vx: U.rand(-40, 20) * (dir || 1) - 60, vy: U.rand(-70, -10),
      g: 120, drag: 2.2, life: U.rand(.24, .46), size: U.rand(3, 7), grow: 9,
      color: color || 'rgba(255,255,255,.5)', shape: 'smoke'
    });
  };

  P.impact = function (x, y, color) {
    P.ring(x, y, color || '#fff', 10, .3);
    P.burst(x, y, 14, { color: [color || '#fff', '#fff'], shape: 'spark', add: true, spMax: 460, drag: 2.4, sizeMax: 6, lifeMax: .4 });
  };

  /* ---------------- floating text popups ---------------- */
  var pops = [];
  P.pop = function (x, y, text, color, size, fixed) {
    pops.push({ x: x, y: y, text: text, color: color || '#fff', size: size || 20, t: 0, life: .95, fixed: !!fixed });
    if (pops.length > 26) pops.shift();
  };
  P.updatePops = function (dt, scrollDx) {
    for (var i = pops.length - 1; i >= 0; i--) {
      var q = pops[i];
      q.t += dt;
      q.y -= 52 * dt;
      if (!q.fixed) q.x -= scrollDx || 0;
      if (q.t >= q.life) pops.splice(i, 1);
    }
  };
  P.drawPops = function (ctx) {
    for (var i = 0; i < pops.length; i++) {
      var q = pops[i], k = q.t / q.life;
      var s = k < .18 ? U.easeOutBack(k / .18) : 1;
      ctx.save();
      ctx.globalAlpha = k > .6 ? 1 - (k - .6) / .4 : 1;
      ctx.translate(q.x, q.y);
      ctx.scale(s, s);
      ctx.font = '800 ' + q.size + 'px "Trebuchet MS",Verdana,sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.65)';
      ctx.strokeText(q.text, 0, 0);
      ctx.fillStyle = q.color;
      ctx.fillText(q.text, 0, 0);
      ctx.restore();
    }
  };
  P.clearPops = function () { pops.length = 0; };
  P.count = function () { return live.length; };

})(window.DR);
