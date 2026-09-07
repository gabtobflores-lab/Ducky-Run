/* ============================================================
   boss.js — end-of-level encounters.
   Rhythm: dodge a telegraphed attack, then punish the charge
   with a dash. Every boss uses the same state machine with a
   different attack script, arena colour and silhouette.
   ============================================================ */
(function (DR) {
  'use strict';
  var U = DR.util, E = DR.ENT;

  var HOME_X = 762, HOME_Y = 232;

  var DEFS = {
    honker: {
      name: 'HONKER THE GOOSE', art: 'honker', hp: 5, scale: 1.05,
      color: '#e6eaef', taunt: 'HONK!',
      script: [
        { m: 'volley', art: 'feather', lanes: 2, n: 3, tell: .6, dur: 1.0, speed: 380 },
        { m: 'charge', tell: .85, speed: 950 },
        { m: 'ring', tell: .55, lanes: 2, dur: .9, speed: 330 },
        { m: 'charge', tell: .8, speed: 1000 },
        { m: 'volley', art: 'feather', lanes: 3, n: 2, tell: .7, dur: 1.2, speed: 400, stagger: .34 }
      ]
    },
    strawman: {
      name: 'THE STRAWMAN', art: 'strawman', hp: 6, scale: 1.0,
      color: '#e8c07a', taunt: 'SHOO!',
      script: [
        { m: 'volley', art: 'corn', lanes: 2, n: 4, tell: .55, dur: 1.1, speed: 420 },
        { m: 'summon', kind: 'duckling', n: 3, tell: .6 },
        { m: 'charge', tell: .8, speed: 1000 },
        { m: 'rain', art: 'corn', n: 5, tell: .7, dur: 1.4 },
        { m: 'charge', tell: .7, speed: 1060 }
      ]
    },
    mecha: {
      name: 'RUBBER MECHA-DUCK', art: 'mecha', hp: 7, scale: 1.0,
      color: '#ffd447', taunt: 'SQUEAK!',
      script: [
        { m: 'volley', art: 'bubble', lanes: 3, n: 2, tell: .5, dur: 1.2, speed: 340, stagger: .3 },
        { m: 'charge', tell: .72, speed: 1080 },
        { m: 'rain', art: 'bubble', n: 6, tell: .6, dur: 1.4 },
        { m: 'summon', kind: 'crab', n: 2, tell: .55 },
        { m: 'charge', tell: .66, speed: 1120 },
        { m: 'volley', art: 'bubble', lanes: 2, n: 4, tell: .5, dur: 1.1, speed: 400 }
      ]
    },
    drake: {
      name: 'THE THUNDER DRAKE', art: 'drake', hp: 8, scale: 1.0,
      color: '#8fd3ff', taunt: 'KRAKOOM!',
      script: [
        { m: 'bolt', lanes: 2, tell: .8, dur: 1.1 },
        { m: 'volley', art: 'bolt', lanes: 3, n: 2, tell: .48, dur: 1.1, speed: 520, stagger: .26 },
        { m: 'charge', tell: .64, speed: 1160 },
        { m: 'summon', kind: 'drone', n: 2, tell: .5 },
        { m: 'bolt', lanes: 2, tell: .7, dur: 1.0 },
        { m: 'charge', tell: .6, speed: 1200 }
      ]
    },
    gander: {
      name: 'THE GOLDEN GANDER', art: 'gander', hp: 10, scale: 1.05,
      color: '#ffd447', taunt: 'BOW BEFORE ME!',
      script: [
        { m: 'volley', art: 'feather', lanes: 3, n: 3, tell: .46, dur: 1.2, speed: 480, stagger: .24 },
        { m: 'charge', tell: .6, speed: 1180 },
        { m: 'ring', tell: .46, lanes: 2, dur: .9, speed: 420 },
        { m: 'rain', art: 'feather', n: 7, tell: .55, dur: 1.3 },
        { m: 'charge', tell: .55, speed: 1240 },
        { m: 'summon', kind: 'duckling', n: 4, tell: .45 },
        { m: 'bolt', lanes: 2, tell: .6, dur: 1.0 },
        { m: 'charge', tell: .52, speed: 1300 }
      ]
    }
  };

  DR.BOSSES = DEFS;

  var B = DR.bossSys = {};

  B.create = function (id, hpMul) {
    var d = DEFS[id] || DEFS.honker;
    var hp = Math.round(d.hp * (hpMul || 1));
    return {
      id: id, def: d, art: d.art, name: d.name,
      hp: hp, maxHp: hp, phase: 1,
      x: DR.W + 320, y: HOME_Y, lane: 1,
      mode: 'enter', timer: 0, moveIdx: 0, gap: .55,
      flash: 0, hittable: false, hitThisCharge: false,
      shake: 0, t: 0, dead: false, done: false,
      tellLane: -1, tellK: 0, banner: 1.9, scaleMul: d.scale,
      chargeSpeed: 900, spawnT: 0, spawnN: 0, curMove: null, deathT: 0
    };
  };

  /* Hitbox — deliberately generous so a well-timed dash always connects. */
  B.box = function (b) {
    var w = 150, h = 150;
    return { x: b.x - w / 2, y: b.y - h, w: w, h: h };
  };

  function phaseOf(b) {
    var f = b.hp / b.maxHp;
    return f > .66 ? 1 : f > .33 ? 2 : 3;
  }
  function speedMul(b) { return 1 + (b.phase - 1) * 0.18; }
  function gapMul(b) { return 1 - (b.phase - 1) * 0.2; }

  function projSpeed(mv, b, g) { return -(mv.speed || 380) * speedMul(b) - g.speed * .12; }

  function startMove(b, g) {
    var mv = b.def.script[b.moveIdx % b.def.script.length];
    b.moveIdx++;
    b.curMove = mv;
    b.spawnT = 0; b.spawnN = 0;
    b.timer = mv.tell * (b.phase === 3 ? .82 : 1);
    b.mode = 'tell';
    b.hitThisCharge = false;
    if (mv.m === 'charge') {
      b.tellLane = pickLane(g);
      b.chargeSpeed = (mv.speed || 1000) * speedMul(b);
      DR.audio.play('bossTell');
    } else {
      b.tellLane = -1;
      DR.audio.play('bossTell');
    }
  }

  function pickLane(g) {
    // Favour the lane the player is in, but not relentlessly.
    return Math.random() < .68 ? g.player.lane : U.randi(0, 2);
  }

  function laneSet(n, g) {
    var all = [0, 1, 2];
    if (n >= 3) return all;
    var out = [];
    var first = pickLane(g);
    out.push(first);
    while (out.length < n) {
      var c = U.randi(0, 2);
      if (out.indexOf(c) === -1) out.push(c);
    }
    return out;
  }

  function fireVolley(b, g, mv, idx) {
    var lanes = mv._lanes || (mv._lanes = laneSet(mv.lanes, g));
    lanes.forEach(function (ln, i) {
      var art = mv.art;
      var p = E.makeProj(ln, g.camX + (b.x - DR.PLAYER_X) - 40, {
        vx: projSpeed(mv, b, g),
        art: art,
        yOff: art === 'bolt' ? 30 : U.rand(18, 64),
        w: art === 'bubble' ? 26 : 22, h: art === 'bubble' ? 26 : 22,
        r: art === 'bubble' ? 13 : undefined,
        spin: art === 'feather' ? 5 : 2,
        color: b.def.color
      });
      if (mv.stagger) p.x += i * mv.stagger * 320;
      g.entities.push(p);
    });
    DR.audio.play('bossShoot');
  }

  function fireRing(b, g, mv) {
    var lanes = laneSet(mv.lanes, g);
    lanes.forEach(function (ln) {
      var p = E.makeProj(ln, g.camX + (b.x - DR.PLAYER_X) - 40, {
        vx: projSpeed(mv, b, g), art: 'ring', yOff: 26, w: 40, h: 46,
        r: 16, grow: 14, spin: 0, color: b.def.color
      });
      g.entities.push(p);
    });
    DR.audio.play('honk');
  }

  function fireRain(b, g, mv) {
    var ln = U.randi(0, 2);
    var x = g.camX + U.rand(120, 760);
    g.entities.push(E.makeWarn(ln, x, .62, b.def.color));
    setTimeoutSafe(g, .5, function () {
      g.entities.push(E.makeProj(ln, x + 40, {
        vx: -60, vy: -30, g: 900, art: mv.art, yOff: 380,
        w: 24, h: 24, r: 13, spin: 4, color: b.def.color
      }));
    });
  }

  function fireBolt(b, g, mv) {
    var lanes = laneSet(mv.lanes, g);
    lanes.forEach(function (ln, i) {
      var x = g.camX + U.rand(60, 620) + i * 60;
      g.entities.push(E.makeWarn(ln, x, .7, '#8fd3ff'));
      setTimeoutSafe(g, .68, function () {
        g.entities.push(E.makeProj(ln, x, {
          vx: -30, vy: 0, g: 0, art: 'strike', yOff: 0, w: 44, h: 150, life: .42, spin: 0
        }));
        DR.fx.burst(DR.PLAYER_X + (x - g.camX), DR.laneY(ln) - 20, 16,
          { color: ['#8fd3ff', '#fff'], shape: 'spark', add: true, spMax: 380, lifeMax: .4 });
        DR.fx.ring(DR.PLAYER_X + (x - g.camX), DR.laneY(ln) - 10, '#8fd3ff', 12, .34);
        DR.audio.play('bossShoot');
        g.shake = Math.max(g.shake, 5);
      });
    });
  }

  /* Small deferred-callback queue that respects pause / hitstop. */
  function setTimeoutSafe(g, delay, fn) {
    g.timers.push({ t: delay, fn: fn });
  }
  B.runTimers = function (g, dt) {
    for (var i = g.timers.length - 1; i >= 0; i--) {
      var q = g.timers[i];
      q.t -= dt;
      if (q.t <= 0) { g.timers.splice(i, 1); try { q.fn(); } catch (e) { } }
    }
  };

  function summon(b, g, mv) {
    for (var i = 0; i < mv.n; i++) {
      var ln = U.randi(0, 2);
      g.entities.push(E.make('enemy', mv.kind, ln, g.camX + DR.W - 40 + i * 90));
    }
    DR.fx.burst(b.x, b.y - 60, 18, { color: [b.def.color, '#fff'], shape: 'star', add: true, spMax: 260 });
    DR.audio.play('honk');
  }

  B.update = function (b, g, dt) {
    b.t += dt;
    if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 3.2);
    if (b.banner > 0) b.banner -= dt;
    b.phase = phaseOf(b);

    switch (b.mode) {
      case 'enter': {
        b.x = U.approach(b.x, HOME_X, 620 * dt);
        b.y = HOME_Y + Math.sin(b.t * 2) * 10;
        if (b.x <= HOME_X + 1) { b.mode = 'idle'; b.timer = .8; }
        break;
      }
      case 'idle': {
        b.x = U.approach(b.x, HOME_X, 480 * dt);
        b.y = HOME_Y + Math.sin(b.t * 2) * 10;
        b.timer -= dt;
        if (b.timer <= 0) startMove(b, g);
        break;
      }
      case 'tell': {
        b.y = HOME_Y + Math.sin(b.t * 9) * 5;
        b.timer -= dt;
        b.tellK = 1 - Math.max(0, b.timer) / Math.max(.0001, b.curMove.tell);
        if (b.timer <= 0) {
          var mv = b.curMove;
          if (mv.m === 'charge') {
            b.mode = 'charge';
            b.lane = b.tellLane;
            b.y = DR.laneY(b.lane);
            b.x = DR.W + 190;
            b.hittable = true;
            b.hitThisCharge = false;
            DR.audio.play('dash');
            g.shake = Math.max(g.shake, 6);
          } else {
            b.mode = 'act';
            b.timer = mv.dur || .8;
            mv._lanes = null;
            b.spawnT = 0; b.spawnN = 0;
            if (mv.m === 'summon') { summon(b, g, mv); b.timer = .5; }
          }
        }
        break;
      }
      case 'act': {
        b.y = HOME_Y + Math.sin(b.t * 2.4) * 12;
        var mv2 = b.curMove;
        b.timer -= dt;
        b.spawnT -= dt;
        if (b.spawnT <= 0 && mv2.m !== 'summon') {
          var n = mv2.n || 1;
          if (b.spawnN < n) {
            b.spawnN++;
            if (mv2.m === 'volley') fireVolley(b, g, mv2, b.spawnN);
            else if (mv2.m === 'ring') fireRing(b, g, mv2);
            else if (mv2.m === 'rain') fireRain(b, g, mv2);
            else if (mv2.m === 'bolt') fireBolt(b, g, mv2);
            b.spawnT = (mv2.dur || 1) / Math.max(1, n) * (mv2.m === 'rain' ? .7 : 1);
          }
        }
        if (b.timer <= 0 && b.spawnN >= (mv2.n || 1)) {
          b.mode = 'idle';
          b.timer = b.gap * gapMul(b);
          b.tellLane = -1;
        }
        break;
      }
      case 'charge': {
        b.x -= b.chargeSpeed * dt;
        b.y = DR.laneY(b.lane) + Math.sin(b.t * 20) * 3;
        if (Math.random() < .8) {
          DR.fx.spawn({
            x: b.x + U.rand(-30, 60), y: b.y - U.rand(10, 110),
            vx: U.rand(120, 340), vy: U.rand(-40, 40), g: 40, drag: 1.2,
            life: U.rand(.2, .45), size: U.rand(3, 8), grow: 12,
            color: U.rgba(b.def.color, .5), shape: 'smoke'
          });
        }
        if (b.x < -230) {
          b.mode = 'return';
          b.x = DR.W + 320; b.y = HOME_Y;
          b.hittable = false;
          b.timer = .35;
        }
        break;
      }
      case 'return': {
        b.x = U.approach(b.x, HOME_X, 900 * dt);
        b.y = U.approach(b.y, HOME_Y, 300 * dt);
        if (b.x <= HOME_X + 1) { b.mode = 'idle'; b.timer = b.gap * gapMul(b); }
        break;
      }
      case 'dying': {
        b.deathT += dt;
        b.y += 40 * dt * b.deathT;
        b.x -= 30 * dt;
        if (Math.random() < .5) {
          DR.fx.burst(b.x + U.rand(-70, 70), b.y - U.rand(20, 150), 8,
            { color: ['#fff', '#ffd447', b.def.color], shape: 'spark', add: true, spMax: 340, lifeMax: .6 });
        }
        if (b.deathT > 2.3 && !b.done) { b.done = true; }
        break;
      }
    }
  };

  /** Apply a dash hit. Returns true when the hit landed. */
  B.hit = function (b, g, dmg) {
    if (!b.hittable || b.hitThisCharge || b.mode === 'dying') return false;
    b.hitThisCharge = true;
    b.hittable = false;
    b.hp -= dmg;
    b.flash = 1;
    g.shake = Math.max(g.shake, 16);
    g.hitstop = Math.max(g.hitstop, .1);
    DR.audio.play('bossHit');
    DR.fx.impact(b.x - 40, b.y - 80, '#fff');
    DR.fx.feathers(b.x - 30, b.y - 80, 12, [b.def.color, '#fff', '#ffe9a8']);
    DR.fx.ring(b.x - 40, b.y - 80, '#ffd447', 18, .4);
    // reward hats fly toward the player
    for (var i = 0; i < 5; i++) {
      g.entities.push(E.make('pickup', 'hat', U.randi(0, 2), g.camX + U.rand(420, 700), { yOff: U.rand(20, 90) }));
    }
    if (b.hp <= 0) {
      b.hp = 0;
      b.mode = 'dying';
      b.deathT = 0;
      b.hittable = false;
      DR.audio.play('bossDie');
      g.shake = Math.max(g.shake, 26);
      g.hitstop = Math.max(g.hitstop, .32);
    }
    return true;
  };

  /* ---------- rendering ---------- */
  B.draw = function (ctx, b, g, t) {
    // lane charge telegraph
    if (b.mode === 'tell' && b.tellLane >= 0) {
      var y = DR.laneY(b.tellLane);
      ctx.save();
      ctx.globalAlpha = .18 + Math.sin(t * 26) * .14;
      ctx.fillStyle = '#ff3b57';
      ctx.fillRect(0, y - 120, DR.W, 122);
      ctx.globalAlpha = .55 + Math.sin(t * 26) * .3;
      ctx.fillStyle = '#ff3b57';
      ctx.fillRect(0, y - 4, DR.W, 5);
      ctx.restore();
      // incoming arrows
      ctx.save();
      ctx.globalAlpha = .6 + Math.sin(t * 20) * .3;
      ctx.fillStyle = '#fff';
      for (var a = 0; a < 5; a++) {
        var ax = DR.W - ((t * 460 + a * 150) % (DR.W + 160));
        ctx.beginPath();
        ctx.moveTo(ax + 26, y - 62); ctx.lineTo(ax, y - 46); ctx.lineTo(ax + 26, y - 30);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    var s = 1 * b.scaleMul;
    if (b.mode === 'dying') {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.sin(b.deathT * 6) * .25 + b.deathT * .5);
      ctx.globalAlpha = Math.max(0, 1 - b.deathT / 2.4);
      DR.art.boss(ctx, b, 0, 0, s, t);
      ctx.restore();
      return;
    }

    // charge glow
    if (b.mode === 'charge') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var gg = ctx.createRadialGradient(b.x, b.y - 70, 10, b.x, b.y - 70, 190);
      gg.addColorStop(0, U.rgba(b.def.color, .5)); gg.addColorStop(1, U.rgba(b.def.color, 0));
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(b.x, b.y - 70, 190, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (b.mode === 'tell') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = b.tellK * .5;
      var g2 = ctx.createRadialGradient(b.x, b.y - 80, 10, b.x, b.y - 80, 170);
      g2.addColorStop(0, 'rgba(255,90,110,.8)'); g2.addColorStop(1, 'rgba(255,90,110,0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(b.x, b.y - 80, 170, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    DR.art.shadow(ctx, b.x, DR.laneY(b.mode === 'charge' ? b.lane : 2) + 4, 78, .2);
    DR.art.boss(ctx, b, b.x, b.y, s, t);

    // hit window prompt
    if (b.hittable && !b.hitThisCharge && b.x > -60 && b.x < DR.W + 80) {
      ctx.save();
      ctx.globalAlpha = .75 + Math.sin(t * 18) * .25;
      ctx.font = '800 20px "Trebuchet MS",Verdana,sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.strokeText('DASH!', b.x, b.y - 190);
      ctx.fillStyle = '#ffd447';
      ctx.fillText('DASH!', b.x, b.y - 190);
      ctx.restore();
    }
  };

  B.drawBanner = function (ctx, b, t) {
    if (b.banner <= 0) return;
    var k = 1 - b.banner / 1.9;
    var slide = k < .18 ? U.easeOutBack(k / .18) : (k > .86 ? 1 - (k - .86) / .14 : 1);
    ctx.save();
    ctx.globalAlpha = U.clamp(slide, 0, 1);
    ctx.translate(DR.W / 2, 150);
    ctx.scale(U.clamp(slide, .2, 1), U.clamp(slide, .2, 1));
    ctx.fillStyle = 'rgba(8,18,30,.82)';
    U.roundRect(ctx, -260, -34, 520, 68, 12); ctx.fill();
    ctx.strokeStyle = '#ff3b57'; ctx.lineWidth = 3; ctx.stroke();
    ctx.font = '800 15px "Trebuchet MS",Verdana,sans-serif';
    ctx.textAlign = 'center'; ctx.fillStyle = '#ff8fa0';
    ctx.fillText('B O S S   B A T T L E', 0, -8);
    ctx.font = '800 26px "Trebuchet MS",Verdana,sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(b.name, 0, 20);
    ctx.restore();
  };

})(window.DR);
