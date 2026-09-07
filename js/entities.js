/* ============================================================
   entities.js — obstacles, enemies, pickups, projectiles + spawner
   ============================================================ */
(function (DR) {
  'use strict';
  var U = DR.util, Art = DR.art;
  var E = DR.ENT = {};

  /* ------------------------------------------------------------
     Obstacle catalogue.
     hitbox is anchored bottom-centre on the lane baseline:
       left = sx - w/2, bottom = laneY - yOff, top = bottom - h
     tag drives how the player is expected to beat it.
     ------------------------------------------------------------ */
  var OBST = {
    reeds:     { w: 40, h: 38, yOff: 0, tag: 'jump' },
    puddle:    { w: 62, h: 18, yOff: 0, tag: 'jump' },
    brush:     { w: 48, h: 34, yOff: 0, tag: 'jump' },
    soap:      { w: 52, h: 22, yOff: 0, tag: 'jump' },
    crate:     { w: 44, h: 54, yOff: 0, tag: 'jump' },
    decoy:     { w: 34, h: 126, yOff: 0, tag: 'switch' },
    toystack:  { w: 38, h: 128, yOff: 0, tag: 'switch' },
    barrel:    { w: 40, h: 42, yOff: 0, tag: 'jump', vx: -175 },
    net:       { w: 62, h: 72, yOff: 58, tag: 'duck' },
    hook:      { w: 32, h: 48, yOff: 58, tag: 'duck' },
    sprinkler: { w: 30, h: 120, yOff: 0, tag: 'time', cycle: 2.2, on: 0.9 },
    zap:       { w: 46, h: 126, yOff: 0, tag: 'time', cycle: 1.9, on: 0.62, warn: 0.45 },
    bounce:    { w: 54, h: 20, yOff: 0, tag: 'good' }
  };
  E.OBST = OBST;

  /* ------------------------------------------------------------
     Enemy catalogue.
     dashKill / stompKill say how the player is meant to remove it.
     ------------------------------------------------------------ */
  var ENEMY = {
    goose:    { w: 44, h: 66, yOff: 0, vx: -55, hp: 1, dashKill: true, stompKill: true, score: 120, scale: 1 },
    duckling: { w: 26, h: 38, yOff: 0, vx: -135, hp: 1, dashKill: true, stompKill: true, score: 80, scale: 1 },
    frog:     { w: 40, h: 46, yOff: 0, vx: -30, hp: 1, dashKill: true, stompKill: true, score: 140, scale: 1 },
    drone:    { w: 36, h: 44, yOff: 40, vx: -70, hp: 1, dashKill: true, stompKill: true, score: 160, scale: 1 },
    crab:     { w: 46, h: 46, yOff: 0, vx: -95, hp: 1, dashKill: false, stompKill: true, score: 200, scale: 1 }
  };
  E.ENEMY = ENEMY;

  var PICKUP = {
    hat:    { w: 30, h: 30 },
    egg:    { w: 32, h: 38 },
    shield: { w: 34, h: 34 },
    magnet: { w: 34, h: 34 },
    boost:  { w: 34, h: 34 },
    life:   { w: 34, h: 34 }
  };
  E.PICKUP = PICKUP;

  E.make = function (type, kind, lane, x, opt) {
    var def = (type === 'obstacle' ? OBST : type === 'enemy' ? ENEMY : PICKUP)[kind] || { w: 30, h: 30, yOff: 0 };
    var e = {
      type: type, kind: kind, lane: lane, x: x,
      w: def.w, h: def.h, yOff: def.yOff || 0,
      vx: def.vx || 0, hp: def.hp || 1,
      dead: false, gone: false, seed: Math.random() * 10,
      anim: Math.random(), flash: 0, t: 0, phase: Math.random() * 6.28,
      def: def
    };
    if (opt) for (var k in opt) e[k] = opt[k];
    if (type === 'obstacle' && (kind === 'sprinkler' || kind === 'zap')) {
      e.timer = Math.random() * def.cycle;
    }
    if (type === 'enemy' && kind === 'frog') { e.hopT = U.rand(.5, 1.5); e.squat = 0; }
    if (type === 'enemy' && kind === 'drone') { e.shootT = U.rand(.7, 1.8); }
    if (type === 'obstacle' && kind === 'bounce') e.squash = 0;
    return e;
  };

  /** Non-damaging ground marker used to telegraph incoming boss attacks. */
  E.makeWarn = function (lane, x, life, color) {
    return {
      type: 'warn', kind: 'warn', lane: lane, x: x, w: 0, h: 0, yOff: 0,
      life: life || .8, max: life || .8, color: color || '#ff3b57',
      dead: false, gone: false, t: 0, seed: 0
    };
  };

  E.makeProj = function (lane, x, opt) {
    var p = {
      type: 'proj', kind: 'proj', lane: lane, x: x,
      w: opt.w || 20, h: opt.h || 20, yOff: opt.yOff || 30,
      vx: opt.vx || -300, vy: opt.vy || 0, g: opt.g || 0,
      art: opt.art || 'seed', rot: 0, spin: opt.spin || 6,
      life: opt.life || 6, dead: false, gone: false, hostile: true,
      r: opt.r, color: opt.color, seed: Math.random() * 10, t: 0,
      laneLock: opt.laneLock, grow: opt.grow || 0
    };
    return p;
  };

  /* ------------------------------------------------------------
     Per-frame behaviour
     ------------------------------------------------------------ */
  E.update = function (e, dt, g) {
    e.t += dt;
    if (e.flash > 0) e.flash = Math.max(0, e.flash - dt * 4);
    e.x += (e.vx || 0) * dt;

    if (e.type === 'obstacle') {
      switch (e.kind) {
        case 'barrel': e.roll = (e.roll || 0) + (g.speed - e.vx) * dt / 20; break;
        case 'sprinkler': {
          e.timer += dt;
          if (e.timer > e.def.cycle) e.timer -= e.def.cycle;
          e.active = e.timer < e.def.on;
          break;
        }
        case 'zap': {
          e.timer += dt;
          if (e.timer > e.def.cycle) e.timer -= e.def.cycle;
          e.active = e.timer < e.def.on;
          e.warn = !e.active && e.timer > e.def.cycle - e.def.warn;
          break;
        }
        case 'hook': {
          e.swing = Math.sin(e.t * 2.1 + e.seed) * 0.5;
          e.dx = Math.sin(e.swing) * 150;
          break;
        }
        case 'bounce': e.squash = Math.max(0, (e.squash || 0) - dt * 4); break;
      }
    } else if (e.type === 'enemy') {
      e.anim += dt * (e.kind === 'duckling' ? 3.2 : 2.1);
      if (e.staggerT > 0) {
        e.staggerT -= dt;
        if (e.staggerT <= 0) e.vx = e.def.vx || 0;
      }
      switch (e.kind) {
        case 'frog': {
          // Never hop right on top of the duck — a lane change the player
          // cannot react to is not a challenge, it's a coin flip.
          var relX = e.x - g.camX;
          if (relX > 250 || relX < -40) e.hopT -= dt;
          if (e.hopT < .32 && e.hopT > 0) e.squat = U.clamp((.32 - e.hopT) / .32, 0, 1);
          if (e.hopT <= 0) {
            var dir = e.lane === 0 ? 1 : e.lane === 2 ? -1 : (Math.random() < .5 ? -1 : 1);
            e.lane = U.clamp(e.lane + dir, 0, 2);
            e.hopT = U.rand(1.0, 1.7);
            e.squat = 0;
            e.hopFx = .34;
            DR.fx.dust(DR.PLAYER_X + e.x - g.camX, DR.laneY(e.lane), -1, 'rgba(200,240,180,.6)');
          }
          e.hopFx = Math.max(0, (e.hopFx || 0) - dt);
          break;
        }
        case 'drone': {
          e.shootT -= dt;
          var sx = DR.PLAYER_X + (e.x - g.camX);
          if (e.shootT <= 0 && sx < DR.W - 40 && sx > DR.PLAYER_X + 60) {
            e.shootT = U.rand(1.3, 2.1);
            g.entities.push(E.makeProj(e.lane, e.x - 14, { vx: -340 - g.speed * .25, art: 'seed', yOff: e.yOff - 8, w: 18, h: 18 }));
            DR.audio.play('bossShoot');
          }
          break;
        }
      }
    } else if (e.type === 'warn') {
      e.life -= dt;
      if (e.life <= 0) e.gone = true;
    } else if (e.type === 'proj') {
      e.life -= dt;
      e.vy += (e.g || 0) * dt;
      e.yOff -= e.vy * dt;
      e.rot += e.spin * dt;
      if (e.grow) e.r = (e.r || 10) + e.grow * dt;
      if (e.life <= 0) e.gone = true;
    }

    // despawn behind the player
    if (DR.PLAYER_X + (e.x - g.camX) < -260) e.gone = true;
  };

  /* Screen-space hitbox. */
  E.box = function (e, camX) {
    var sx = DR.PLAYER_X + (e.x - camX) + (e.dx || 0);
    var by = DR.laneY(e.lane) - (e.yOff || 0);
    return { x: sx - e.w / 2, y: by - e.h, w: e.w, h: e.h };
  };

  /** Is this entity currently dangerous? (timed hazards are only sometimes) */
  E.hostile = function (e) {
    if (e.dead) return false;
    if (e.type === 'obstacle') {
      if (e.kind === 'bounce') return false;
      if (e.kind === 'sprinkler' || e.kind === 'zap') return !!e.active;
      return true;
    }
    if (e.type === 'enemy') return true;
    if (e.type === 'proj') return !!e.hostile;
    return false;
  };

  /* ------------------------------------------------------------
     Drawing
     ------------------------------------------------------------ */
  E.draw = function (ctx, e, camX, t) {
    var sx = DR.PLAYER_X + (e.x - camX);
    if (sx < -220 || sx > DR.W + 260) return;
    var laneY = DR.laneY(e.lane);
    var s = DR.laneScale(e.lane);

    if (e.type === 'obstacle') {
      if (e.kind !== 'net' && e.kind !== 'hook' && e.kind !== 'puddle') Art.shadow(ctx, sx, laneY + 3, e.w * .5 * s, .22);
      Art.obstacle(ctx, e, sx, laneY, s, t);
    } else if (e.type === 'enemy') {
      var yy = laneY - (e.yOff || 0);
      if (e.kind === 'frog' && e.hopFx) yy -= Math.sin((1 - e.hopFx / .34) * Math.PI) * 26;
      Art.shadow(ctx, sx, laneY + 3, e.w * .45 * s, e.yOff ? .12 : .24);
      Art.enemyAt(ctx, e, sx, yy, s, t);
    } else if (e.type === 'pickup') {
      var py = laneY - (e.yOff || 0) - e.h / 2;
      if (e.kind === 'hat') Art.hat(ctx, sx, py, s, t + e.seed);
      else if (e.kind === 'egg') Art.egg(ctx, sx, py, s, t + e.seed);
      else Art.power(ctx, e.kind, sx, py, s, t + e.seed);
    } else if (e.type === 'proj') {
      Art.projectile(ctx, e, sx, laneY - (e.yOff || 0), t);
    } else if (e.type === 'warn') {
      var k = 1 - e.life / e.max;
      ctx.save();
      ctx.globalAlpha = .35 + Math.sin(e.t * 26) * .25;
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.ellipse(sx, laneY - 2, 34 * s, 10 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = .8;
      ctx.strokeStyle = e.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(sx, laneY - 2, 34 * s * (0.4 + k * 0.8), 10 * s * (0.4 + k * 0.8), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  };

  /* ============================================================
     SPAWNER
     Guarantees at least one clear path at every slot.
     ============================================================ */
  var SP = DR.spawner = {};
  var nextX = 0, slotCount = 0, sinceHat = 0, sincePower = 0, sinceEgg = 0, prevBlocked = [];

  SP.reset = function (g) {
    nextX = g.camX + 1100;          // breathing room at the start of a level
    slotCount = 0; sinceHat = 0; sincePower = 0; sinceEgg = 0; prevBlocked = [];
  };

  function freeLanes(blocked) {
    var out = [];
    for (var i = 0; i < 3; i++) if (blocked.indexOf(i) === -1) out.push(i);
    return out;
  }

  /* A hat run: line, arc or zigzag of propeller hats. */
  function hatRun(g, lane, x) {
    var style = Math.random();
    var n = U.randi(4, 7);
    var step = 52;
    for (var i = 0; i < n; i++) {
      var yOff = 0, ln = lane;
      if (style < .34) {                         // arc — encourages a jump
        yOff = Math.sin((i / (n - 1)) * Math.PI) * 92;
      } else if (style < .6) {                   // zig-zag across lanes
        ln = U.clamp(lane + (i < n / 2 ? 0 : 1) * (lane < 2 ? 1 : -1), 0, 2);
        yOff = 8;
      } else {
        yOff = 10;
      }
      g.entities.push(E.make('pickup', 'hat', ln, x + i * step, { yOff: yOff }));
    }
  }

  SP.update = function (g) {
    var lvl = g.level;
    var speedScale = g.speed / lvl.speed0;
    var guard = 0;
    while (g.camX + DR.W + 220 > nextX && guard++ < 12) {
      var x = nextX;
      slotCount++;

      /* ---- hazards ----
         Fairness rule: at least one lane must stay clear across this slot AND
         the previous one, so a run is always survivable on lane changes alone.
         Jumping and dashing are then a skill layer for score, not a tax. */
      var blocked = [];
      if (Math.random() < lvl.hazard) {
        var howMany = (Math.random() < lvl.doubleLane && slotCount > 3) ? 2 : 1;
        var order = [0, 1, 2].sort(function () { return Math.random() - .5; });
        var lanes = [];
        for (var c = 0; c < order.length && lanes.length < howMany; c++) {
          if (freeLanes(prevBlocked.concat(lanes, [order[c]])).length >= 1) lanes.push(order[c]);
        }
        for (var i = 0; i < lanes.length; i++) {
          var kind = U.pick(lvl.obstacles);
          if (kind === 'bounce' && Math.random() > .35) {
            kind = U.pick(lvl.obstacles.filter(function (k) { return k !== 'bounce'; }));
          }
          g.entities.push(E.make('obstacle', kind, lanes[i], x + (i ? U.rand(-40, 40) : 0)));
          if (kind !== 'bounce') blocked.push(lanes[i]);
          else {
            // reward for using it: a hat arc directly above
            for (var b = 0; b < 5; b++) {
              g.entities.push(E.make('pickup', 'hat', lanes[i], x + 30 + b * 46, { yOff: 60 + Math.sin(b / 4 * Math.PI) * 70 }));
            }
          }
        }
      }

      // lanes that stay walkable through both this slot and the last one
      var free = freeLanes(prevBlocked.concat(blocked));
      if (!free.length) free = freeLanes(blocked);
      if (!free.length) free = [1];
      prevBlocked = blocked;

      /* ---- enemies ---- */
      if (Math.random() < lvl.enemy && slotCount > 2) {
        var ek = U.pick(lvl.enemies);
        var el = U.pick(free);
        if (ek === 'duckling') {
          var count = U.randi(2, 3);
          for (var d = 0; d < count; d++) {
            g.entities.push(E.make('enemy', 'duckling', el, x + 120 + d * 62));
          }
        } else {
          g.entities.push(E.make('enemy', ek, el, x + U.rand(60, 150)));
        }
        var idx = free.indexOf(el);
        if (idx >= 0 && free.length > 1) free.splice(idx, 1);
      }

      /* ---- pickups ---- */
      sinceHat++;
      if (Math.random() < lvl.pickup || sinceHat > 2) {
        sinceHat = 0;
        hatRun(g, U.pick(free), x + U.rand(80, 160));
      }

      sinceEgg++;
      if (sinceEgg > 4 && Math.random() < .38) {
        sinceEgg = 0;
        var eggLane = U.pick(free);
        g.entities.push(E.make('pickup', 'egg', eggLane, x + U.rand(90, 200), { yOff: U.chance(.4) ? 78 : 12 }));
      }

      sincePower++;
      if (sincePower > 6 && Math.random() < .45) {
        sincePower = 0;
        var roll = Math.random();
        var pk = roll < .34 ? 'shield' : roll < .62 ? 'magnet' : roll < .92 ? 'boost' : 'life';
        if (pk === 'life' && g.lives >= 4) pk = 'shield';
        g.entities.push(E.make('pickup', pk, U.pick(free), x + U.rand(120, 220), { yOff: 26 }));
      }

      nextX += U.rand(lvl.slot[0], lvl.slot[1]) * speedScale;
    }
  };

})(window.DR);
