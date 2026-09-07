/* ============================================================
   game.js — state machine, simulation and world rendering
   ============================================================ */
(function (DR) {
  'use strict';
  var U = DR.util, E = DR.ENT, Art = DR.art, FX = DR.fx;
  var W = DR.W, H = DR.H;

  var G = DR.game = {};
  var canvas, ctx, dpr = 1;
  var canvas3d = null, r3dReady = false;
  var mode = 'boot';            // boot | intro | menu | play | dead | over | complete
  var g = null;                 // active run state
  var lastTs = 0, acc = 0, tGlobal = 0;
  var paused = false;
  var flashDamage = 0, vignette = 0;
  var levelBanner = 0;
  var pendingLevel = 1;

  var PLAYER_W = 38, PLAYER_H = 50;
  var METERS = 22;              // world px per metre

  /* ============================================================
     Setup
     ============================================================ */
  G.init = function (cv) {
    canvas = cv;
    ctx = canvas.getContext('2d', { alpha: false });
    canvas3d = document.getElementById('canvas3d');
    resize();
    window.addEventListener('resize', resize);
    DR.ui.init();
    DR.ui.setProgressDuck();
    mode = 'intro';
    DR.intro.reset();
    requestAnimationFrame(frame);
  };

  function resize() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(rect.width * dpr));
    var h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }

  /* ============================================================
     Run state
     ============================================================ */
  function makePlayer() {
    var d = DR.duckById(DR.progress.duck);
    return {
      duck: d,
      lane: 1, laneV: 1,
      py: 0, vy: 0, grounded: true, jumps: 0, cutJump: false,
      run: 0, dashT: 0, dashCd: 0, invuln: 0, blink: 0,
      shield: false, shieldRegen: d.id === 'knight' ? 14 : 0,
      hoverT: 0, hoverCd: 0,
      dying: false, dieT: 0, squash: 1, tilt: 0,
      combo: 0, comboT: 0
    };
  }

  function newRun(levelId, keepStats) {
    var lvl = levelId === 0 ? DR.makeEndless() : DR.levelById(levelId);
    var p = makePlayer();
    g = {
      level: lvl,
      endless: !!lvl.endless,
      zone: 0, zoneStartX: 0, zonesSinceBoss: 0, bossCount: 0,
      noHitDist: 0, flawless: 0, dodges: 0,
      camX: 0, startX: 0,
      speed: lvl.speed0, baseSpeed: lvl.speed0,
      dist: 0, score: 0, hats: 0, eggs: 0, kills: 0,
      lives: 3, maxLives: 3,
      entities: [], timers: [], boss: null,
      shake: 0, hitstop: 0, slow: 0,
      phase: 'run', phaseT: 0,
      powers: { shield: { t: 0, max: 1 }, magnet: { t: 0, max: 8 }, boost: { t: 0, max: 5 } },
      player: p,
      attract: false,
      bossBonus: 0,
      time: 0
    };
    if (p.duck.id === 'classic') { p.shield = true; g.powers.shield.t = 1; }
    if (p.duck.id === 'mama') { g.powers.magnet.t = 1e9; g.powers.magnet.max = 1e9; }
    DR.spawner.reset(g);
    G.state = g;
    return g;
  }

  /* ============================================================
     Public control
     ============================================================ */
  G.startLevel = function (id) {
    DR.audio.unlock();
    pendingLevel = id;
    DR.ui.fade(true);
    setTimeout(function () {
      newRun(id);
      canvas3d.hidden = false;
      canvas.hidden = true;
      if (R3D && R3D.init) {
        r3dReady = R3D.init(canvas3d);
      }
      DR.ui.hideAll();
      DR.ui.setHudVisible(true);
      DR.ui.buildLives(g.maxLives);
      DR.ui.refreshLives(g.lives);
      DR.ui.setProgressDuck();
      DR.ui.setBoss(null);
      FX.clear(); FX.clearPops();
      levelBanner = 2.4;
      flashDamage = 0; vignette = 0;
      mode = 'play';
      paused = false;
      DR.input.clearAll();
      DR.audio.music(g.level.music);
      DR.ui.fade(false);
    }, 300);
  };

  G.startEndless = function () { G.startLevel(0); };

  G.restart = function () { G.startLevel(pendingLevel); };

  G.nextLevel = function () {
    var next = Math.min(pendingLevel + 1, DR.LEVELS.length);
    G.startLevel(next);
  };

  G.quitToMenu = function () {
    DR.ui.fade(true);
    setTimeout(function () {
      canvas3d.hidden = true;
      canvas.hidden = false;
      r3dReady = false;
      startAttract();
      DR.ui.setHudVisible(false);
      DR.ui.setBoss(null);
      DR.ui.show('menu');
      DR.audio.music('menu');
      DR.ui.fade(false);
    }, 300);
  };

  G.autoPause = function () {
    if (mode === 'play' && !paused && g && !g.player.dying) G.togglePause();
  };

  G.togglePause = function () {
    if (mode !== 'play' || !g || g.player.dying) return;
    paused = !paused;
    if (paused) {
      DR.audio.duck(true);
      DR.ui.showPause({ score: g.score, dist: g.dist, lives: g.lives });
    } else {
      DR.audio.duck(false);
      DR.ui.hideAll();
      DR.input.clearAll();
    }
  };

  function startAttract() {
    newRun(1);
    g.attract = true;
    g.speed = 300;
    mode = 'menu';
    FX.clear(); FX.clearPops();
  }
  G.startAttract = startAttract;

  /* ============================================================
     Main loop
     ============================================================ */
  function frame(ts) {
    requestAnimationFrame(frame);
    if (!lastTs) lastTs = ts;
    var dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > 0.1) dt = 0.1;            // tab-switch guard
    tGlobal += dt;

    if (mode === 'intro') {
      DR.intro.update(dt);
      renderIntro();
      if (DR.intro.done()) {
        startAttract();
        DR.ui.show('menu');
        DR.ui.setHudVisible(false);
        DR.audio.music('menu');
      }
      DR.input.endFrame();
      return;
    }

    if (mode === 'menu') {
      updateAttract(dt);
      render();
      DR.input.endFrame();
      return;
    }

    // play / dead / over / complete all keep rendering the world
    if (!paused) {
      var step = dt;
      if (g && g.hitstop > 0) {
        g.hitstop -= dt;
        step = dt * 0.08;
      }
      if (g && g.slow > 0) {
        g.slow -= dt;
        step *= 0.45;
      }
      update(step, dt);
    }
    render();
    DR.input.endFrame();
  }

  /* ============================================================
     Global input hooks
     ============================================================ */
  DR.onInput = function (a) {
    DR.audio.unlock();
    if (mode === 'intro') { if (a !== 'mute') DR.intro.skip(); return; }
    if (a === 'mute') {
      var m = DR.audio.toggleMute();
      DR.ui.toast(m ? 'AUDIO OFF' : 'AUDIO ON', '#8fd3ff');
      return;
    }
    if (mode === 'menu') {
      if (a === 'confirm' || a === 'jump') {
        var s = DR.ui.current();
        if (s === 'menu') DR.ui.show('levels');
      }
      if (a === 'pause' && DR.ui.current() !== 'menu') DR.ui.show('menu');
      return;
    }
    if (mode === 'play') {
      if (a === 'pause') G.togglePause();
      if (a === 'restart' && paused) G.restart();
      return;
    }
    if (mode === 'over' || mode === 'complete') {
      if (a === 'confirm' || a === 'jump') {
        if (mode === 'over') G.restart();
        else if (pendingLevel < DR.LEVELS.length) G.nextLevel();
      }
      if (a === 'restart') G.restart();
      if (a === 'pause') G.quitToMenu();
    }
  };

  /* ============================================================
     Attract mode (menu backdrop)
     ============================================================ */
  var attractT = 0;
  function updateAttract(dt) {
    attractT += dt;
    g.time += dt;
    var dx = g.speed * dt;
    g.camX += dx;
    var p = g.player;
    p.run += dt * (g.speed / 210);

    // idle duck hops now and then, and drifts between lanes
    if (p.grounded && Math.random() < dt * 0.6) { p.vy = 620; p.grounded = false; }
    if (Math.random() < dt * 0.35) p.lane = U.clamp(p.lane + (Math.random() < .5 ? -1 : 1), 0, 2);
    p.laneV = U.approach(p.laneV, p.lane, dt * 5);
    p.vy -= DR.GRAVITY * dt;
    p.py += p.vy * dt;
    if (p.py <= 0) { p.py = 0; p.vy = 0; p.grounded = true; }

    // decorative hats
    if (Math.random() < dt * 2.2) {
      g.entities.push(E.make('pickup', 'hat', U.randi(0, 2), g.camX + W + 60, { yOff: U.rand(10, 90) }));
    }
    for (var i = g.entities.length - 1; i >= 0; i--) {
      var e = g.entities[i];
      E.update(e, dt, g);
      if (e.gone) g.entities.splice(i, 1);
    }
    FX.update(dt);
    FX.scroll(dx);
    FX.updatePops(dt, dx);
    if (p.grounded && Math.random() < dt * 12) {
      FX.dust(DR.PLAYER_X - 12, DR.laneY(Math.round(p.laneV)) + 2, -1, 'rgba(255,255,255,.35)');
    }
  }

  /* ============================================================
     Simulation
     ============================================================ */
  function update(dt, rawDt) {
    if (!g) return;
    g.time += dt;
    var p = g.player;
    var lvl = g.level;

    if (g.shake > 0) g.shake = Math.max(0, g.shake - rawDt * 42);
    if (flashDamage > 0) flashDamage = Math.max(0, flashDamage - rawDt * 3.2);
    if (vignette > 0) vignette = Math.max(0, vignette - rawDt * 1.6);
    if (levelBanner > 0) levelBanner -= rawDt;

    DR.bossSys.runTimers(g, dt);

    /* ---------- speed ---------- */
    var prog, target;
    if (g.endless) {
      prog = U.clamp((g.camX - g.zoneStartX) / lvl.len, 0, 1);
      target = U.lerp(lvl.speed0, lvl.speedMax, U.clamp(g.dist / 2400, 0, 1)) * p.duck.speedMul;
    } else {
      prog = U.clamp((g.camX - g.startX) / lvl.len, 0, 1);
      target = U.lerp(lvl.speed0, lvl.speedMax, prog) * p.duck.speedMul;
    }
    if (g.phase !== 'run') target = Math.min(target, 340);
    if (g.powers.boost.t > 0) target *= 1.34;
    if (p.dashT > 0) target *= 1.16;
    g.speed = U.approach(g.speed, target, (g.speed < target ? 190 : 620) * dt);

    var dx = g.speed * dt;
    g.camX += dx;
    // Distance only counts ground covered on the track, not the boss arena.
    if (g.phase === 'run') g.dist += dx / METERS;

    /* ---------- player ---------- */
    if (!p.dying) {
      updatePlayer(p, dt);
    } else {
      p.dieT += dt;
      p.vy -= DR.GRAVITY * 0.6 * dt;
      p.py += p.vy * dt;
      p.tilt += dt * 4;
      if (p.dieT > 1.5 && mode === 'play') finishDeath();
    }

    /* ---------- powers ---------- */
    ['magnet', 'boost'].forEach(function (k) {
      if (g.powers[k].t > 0) {
        g.powers[k].t -= dt;
        if (g.powers[k].t <= 0) {
          g.powers[k].t = 0;
          if (k === 'boost') DR.ui.toast('TURBO OVER', '#8fd3ff');
        }
      }
    });
    if (p.duck.id === 'knight' && !p.shield) {
      p.shieldRegen -= dt;
      if (p.shieldRegen <= 0) {
        p.shield = true; g.powers.shield.t = 1; p.shieldRegen = 14;
        DR.audio.play('power');
        FX.ring(DR.PLAYER_X, playerY(p) - 26, '#7ed957', 20, .5);
        DR.ui.toast('AEGIS SHELL', '#7ed957');
      }
    }
    g.powers.shield.t = p.shield ? 1 : 0;

    /* ---------- combo timer ---------- */
    if (p.comboT > 0) {
      p.comboT -= dt;
      if (p.comboT <= 0) p.combo = 0;
    }

    /* ---------- world ---------- */
    if (g.phase === 'run') {
      DR.spawner.update(g);
      if (g.endless) {
        if (g.camX - g.zoneStartX >= lvl.len) {
          g.zonesSinceBoss++;
          if (g.zonesSinceBoss >= 2) { g.zonesSinceBoss = 0; enterBoss(); }
          else nextZone();
        }
      } else if (g.camX - g.startX >= lvl.len) enterBoss();

      /* flawless streak — rewards clean running, resets on any hit */
      g.noHitDist += (dx / METERS);
      if (g.noHitDist >= 300) {
        g.noHitDist -= 300;
        g.flawless++;
        var fb = 400 * g.flawless;
        g.score += fb;
        DR.audio.play('unlock');
        FX.pop(DR.PLAYER_X + 40, playerY(p) - 96, 'FLAWLESS +' + U.fmt(fb), '#41d6c3', 24, true);
        DR.ui.toast('FLAWLESS ×' + g.flawless, '#41d6c3');
      }
    }

    for (var i = g.entities.length - 1; i >= 0; i--) {
      var e = g.entities[i];
      E.update(e, dt, g);
      if (e.gone || e.dead) { g.entities.splice(i, 1); continue; }
      if (!p.dying) {
        collide(e, i);
        if (!e.scored && (e.type === 'obstacle' || e.type === 'enemy') &&
            DR.PLAYER_X + (e.x - g.camX) < DR.PLAYER_X - 24) {
          e.scored = true;
          nearMiss(e);
        }
      }
    }

    /* ---------- boss ---------- */
    if (g.boss) {
      DR.bossSys.update(g.boss, g, dt);
      DR.ui.setBoss(g.boss);
      if (!p.dying) collideBoss();
      if (g.boss.done && g.phase !== 'won') {
        if (g.endless) endlessBossDown(); else winLevel();
      }
    }

    FX.update(dt);
    FX.scroll(dx);
    FX.updatePops(dt, dx);

    /* ---------- hud ---------- */
    DR.ui.setHud({
      score: Math.floor(g.score + g.dist * 2),
      dist: g.dist,
      hats: g.hats, eggs: g.eggs,
      progress: g.phase === 'run' ? prog : 1
    });
    DR.ui.setPowers(g.powers);
    var ab = p.duck.ability;
    DR.ui.setAbility(p.duck,
      ab.type === 'active' ? p.hoverCd <= 0 : true,
      ab.type === 'active' ? U.clamp(p.hoverCd / ab.cd, 0, 1) : 0);
  }

  function playerY(p) { return laneYf(p.laneV) - p.py; }
  function laneYf(l) {
    var i = U.clamp(Math.floor(l), 0, 2), f = U.clamp(l - i, 0, 1);
    var a = DR.LANE_Y[i], b = DR.LANE_Y[Math.min(i + 1, 2)];
    return U.lerp(a, b, f);
  }

  function updatePlayer(p, dt) {
    var d = p.duck;
    var IN = DR.input;

    /* lane switching */
    if (IN.hit('up') && p.lane > 0) switchLane(p, -1);
    else if (IN.hit('down') && p.lane < 2) switchLane(p, 1);
    p.laneV = U.approach(p.laneV, p.lane, dt * 13);

    /* jumping */
    var maxJumps = d.id === 'rubber' ? 2 : 1;
    if (IN.buffered('jump', 140)) {
      if (p.grounded) {
        p.vy = DR.JUMP_V * -1;
        p.grounded = false; p.jumps = 1; p.cutJump = false;
        DR.audio.play('jump');
        FX.burst(DR.PLAYER_X, laneYf(p.laneV), 8, { color: 'rgba(255,255,255,.6)', shape: 'smoke', spMax: 130, g: 90, sizeMax: 7, lifeMax: .4 });
      } else if (p.jumps < maxJumps) {
        p.vy = DR.JUMP_V * -0.88;
        p.jumps++; p.cutJump = false;
        DR.audio.play('doubleJump');
        FX.ring(DR.PLAYER_X, playerY(p) - 20, '#ffd2d6', 14, .34);
        FX.feathers(DR.PLAYER_X, playerY(p) - 20, 5, ['#ffd2d6', '#fff']);
      }
    }
    // Variable jump height, but with a floor so a quick tap still clears
    // anything tagged 'jump'. Holding buys the extra reach for hat arcs.
    if (!IN.held('jump') && p.vy > DR.JUMP_MIN && !p.cutJump) { p.vy = DR.JUMP_MIN; p.cutJump = true; }

    /* dash */
    if (p.dashCd > 0) p.dashCd -= dt;
    var dashDur = d.id === 'ninja' ? 0.55 : 0.36;
    var dashCool = d.id === 'ninja' ? 0.52 : 0.85;
    if (IN.buffered('dash', 140) && p.dashCd <= 0 && p.dashT <= 0) {
      p.dashT = dashDur; p.dashCd = dashCool + dashDur;
      DR.audio.play('dash');
      FX.ring(DR.PLAYER_X, playerY(p) - 24, d.id === 'ninja' ? '#ff5f6d' : '#ffd447', 16, .3);
      g.shake = Math.max(g.shake, 5);
    }
    if (p.dashT > 0) {
      p.dashT -= dt;
      if (Math.random() < .55) {
        FX.spawn({
          x: DR.PLAYER_X - U.rand(0, 40), y: playerY(p) - U.rand(6, 44),
          vx: -U.rand(180, 420), vy: U.rand(-30, 30), g: 0, drag: 1.6,
          life: U.rand(.16, .34), size: U.rand(2, 5), grow: 6,
          color: d.id === 'ninja' ? 'rgba(255,95,110,.55)' : 'rgba(255,212,71,.5)', shape: 'spark', add: true
        });
      }
    }

    /* ability */
    var ab = d.ability;
    if (ab.type === 'active') {
      if (p.hoverCd > 0) p.hoverCd -= dt;
      if (DR.input.hit('ability') && p.hoverCd <= 0 && p.hoverT <= 0) {
        p.hoverT = ab.dur; p.hoverCd = ab.cd;
        if (p.py < 6) p.vy = 460;
        DR.audio.play('power');
        DR.ui.toast('HOVER!', '#8fd3ff');
      }
      if (p.hoverT > 0) {
        p.hoverT -= dt;
        p.vy = U.approach(p.vy, 40, 900 * dt);
        p.py = Math.max(p.py, 92);
        if (Math.random() < .7) {
          FX.spawn({
            x: DR.PLAYER_X + U.rand(-14, 14), y: playerY(p) + U.rand(-4, 10),
            vx: U.rand(-40, 40), vy: U.rand(60, 190), g: 0, drag: 1.4,
            life: .3, size: U.rand(2, 4), color: 'rgba(190,235,255,.7)', shape: 'dot'
          });
        }
      }
    }

    /* physics */
    p.vy -= DR.GRAVITY * dt;
    p.py += p.vy * dt;
    if (p.py <= 0) {
      if (!p.grounded) {
        DR.audio.play('land');
        FX.burst(DR.PLAYER_X, laneYf(p.laneV), 7, { color: 'rgba(255,255,255,.45)', shape: 'smoke', spMax: 140, g: 60, sizeMax: 8, lifeMax: .34 });
        p.squash = 0.72;
      }
      p.py = 0; p.vy = 0; p.grounded = true; p.jumps = 0; p.hoverT = 0;
    } else p.grounded = false;

    p.squash = U.approach(p.squash, 1, dt * 3.2);

    /* run cycle + footfalls */
    if (p.grounded) {
      var prev = p.run;
      p.run += dt * (g.speed / 190);
      if (Math.floor(prev * 2) !== Math.floor(p.run * 2)) {
        DR.audio.play('step');
        FX.dust(DR.PLAYER_X - 14, laneYf(p.laneV) + 2, -1, 'rgba(255,255,255,.4)');
      }
    }

    /* i-frames */
    if (p.invuln > 0) { p.invuln -= dt; p.blink += dt; }
    p.tilt = U.lerp(p.tilt, p.grounded ? 0 : U.clamp(-p.vy / 2600, -0.22, 0.26), dt * 8);
  }

  function switchLane(p, dir) {
    p.lastLane = p.lane;
    p.laneSwitchAt = g.time;
    p.lane = U.clamp(p.lane + dir, 0, 2);
    DR.audio.play('lane');
    FX.burst(DR.PLAYER_X - 6, playerY(p) - 22, 9, {
      color: ['#fff', U.rgba(p.duck.look.body, .9)], shape: 'spark', add: true,
      dir: dir > 0 ? 1.57 : -1.57, spread: .7, spMax: 250, g: 0, drag: 2.2, lifeMax: .34, sizeMax: 4
    });
  }

  function playerBox(p) {
    return {
      x: DR.PLAYER_X - PLAYER_W / 2,
      y: laneYf(p.laneV) - p.py - PLAYER_H,
      w: PLAYER_W, h: PLAYER_H
    };
  }
  /* Collision uses the destination lane so switching feels instant. */
  function playerHitBox(p) {
    return {
      x: DR.PLAYER_X - PLAYER_W / 2,
      y: DR.laneY(p.lane) - p.py - PLAYER_H,
      w: PLAYER_W, h: PLAYER_H
    };
  }

  /* ============================================================
     Collisions
     ============================================================ */
  function collide(e, idx) {
    var p = g.player;
    var pb = playerHitBox(p);

    /* ---------- pickups (magnet can pull them across lanes) ---------- */
    if (e.type === 'pickup') {
      var magnet = g.powers.magnet.t > 0;
      if (magnet && !e.grabbed) {
        var ex = DR.PLAYER_X + (e.x - g.camX);
        var ey = DR.laneY(e.lane) - (e.yOff || 0) - e.h / 2;
        var tx = DR.PLAYER_X, ty = playerY(p) - 26;
        var dd = Math.hypot(ex - tx, ey - ty);
        if (dd < 210) {
          e.x += (tx - ex) * 0.16;
          e.yOff += ((DR.laneY(e.lane) - ty) - e.yOff - e.h / 2) * 0.16;
          if (e.lane !== p.lane && dd < 140) e.lane = p.lane;
        }
      }
      if (e.lane !== p.lane) return;
      if (U.overlap(pb, E.box(e, g.camX))) { pickup(e); e.gone = true; }
      return;
    }

    if (e.lane !== p.lane) return;
    var eb = E.box(e, g.camX);

    /* ---------- enemies ---------- */
    if (e.type === 'enemy') {
      var def = e.def;
      // A stomp probe under the duck's feet: landing on a foe should feel
      // generous rather than frame-perfect.
      if (def.stompKill && p.vy < 0 && p.py > 6) {
        var probe = { x: DR.PLAYER_X - 17, y: DR.laneY(p.lane) - p.py - 12, w: 34, h: 38 };
        if (U.overlap(probe, eb)) { killEnemy(e, 'stomp'); return; }
      }
      if (!U.overlap(pb, eb)) return;
      if (p.dashT > 0 && def.dashKill) { killEnemy(e, 'dash'); return; }
      if (g.powers.boost.t > 0) { killEnemy(e, 'boost'); return; }
      if (p.dashT > 0 && !def.dashKill) {
        // armoured: the dash clangs off and knocks it back, giving the
        // player a beat to switch lanes instead of an instant punish
        e.x += 190; e.flash = 1; e.vx = 130; e.staggerT = 0.6;
        DR.audio.play('deny');
        FX.impact(DR.PLAYER_X + 26, playerY(p) - 24, '#b8c6d6');
        FX.pop(DR.PLAYER_X + 40, playerY(p) - 72, 'TOO TOUGH!', '#b8c6d6', 16, true);
        return;
      }
      damage(e);
      return;
    }

    if (!U.overlap(pb, eb)) return;

    /* ---------- obstacles ---------- */
    if (e.type === 'obstacle') {
      if (e.kind === 'bounce') {
        if (p.vy <= 40) {
          p.vy = 1080 * (p.duck.id === 'rubber' ? 1.12 : 1);
          p.grounded = false; p.jumps = 0; p.cutJump = false;
          e.squash = 1;
          DR.audio.play('jump');
          FX.ring(DR.PLAYER_X, DR.laneY(e.lane) - 14, '#ffd447', 16, .36);
          FX.pop(DR.PLAYER_X, DR.laneY(e.lane) - 60, 'BOING!', '#ffd447', 18);
        }
        return;
      }
      if (!E.hostile(e)) return;
      if (p.dashT > 0 && p.duck.id === 'ninja') {
        FX.impact(DR.PLAYER_X + 14, playerY(p) - 24, '#ff5f6d');
        return;                       // phantom dash goes straight through
      }
      damage(e);
      return;
    }

    /* ---------- hostile projectiles ---------- */
    if (e.type === 'proj') {
      if (p.dashT > 0 && p.duck.id === 'ninja') {
        e.gone = true; FX.impact(DR.PLAYER_X, playerY(p) - 24, '#ff5f6d'); return;
      }
      e.gone = true;
      damage(e);
    }
  }

  function collideBoss() {
    var b = g.boss, p = g.player;
    if (!b || b.mode !== 'charge') return;
    if (b.lane !== p.lane) return;
    var bb = DR.bossSys.box(b);
    var pb = playerHitBox(p);
    if (!U.overlap(pb, bb)) return;
    if (p.dashT > 0 || g.powers.boost.t > 0) {
      var dmg = p.duck.id === 'knight' ? 2 : 1;
      if (DR.bossSys.hit(b, g, dmg)) {
        DR.ui.bossHitFlash();
        FX.pop(DR.PLAYER_X + 60, playerY(p) - 90, dmg > 1 ? 'CRITICAL!' : 'HIT!', '#ffd447', 24, true);
        p.vy = Math.max(p.vy, 260);
      }
      return;
    }
    damage(b);
  }

  /* ============================================================
     Feedback events
     ============================================================ */
  function pickup(e) {
    var p = g.player;
    var sx = DR.PLAYER_X, sy = playerY(p) - 30;
    switch (e.kind) {
      case 'hat': {
        p.combo++; p.comboT = 2.4;
        g.hats++;
        var mult = 1 + Math.floor(Math.min(p.combo, 20) / 5) * 0.5;
        var val = Math.round(10 * mult);
        g.score += val;
        DR.audio.play('hat', Math.min(p.combo - 1, 9));
        FX.collect(DR.PLAYER_X + (e.x - g.camX), DR.laneY(e.lane) - e.yOff - e.h / 2, '#ffd447');
        if (p.combo % 5 === 0 && p.combo <= 20) {
          FX.pop(sx + 46, sy - 34, mult.toFixed(1) + '× COMBO', '#ffae2b', 24, true);
          FX.ring(sx, sy, '#ffae2b', 22, .42);
        }
        break;
      }
      case 'egg': {
        var eggVal = p.duck.id === 'mama' ? 100 : 50;
        g.eggs++; g.score += eggVal;
        DR.audio.play('egg');
        FX.collect(DR.PLAYER_X + (e.x - g.camX), DR.laneY(e.lane) - e.yOff - e.h / 2, '#41d6c3');
        FX.feathers(DR.PLAYER_X, sy, 6, ['#fff6dd', '#ffe1ef', '#41d6c3']);
        FX.pop(sx + 30, sy - 20, '+' + eggVal, '#41d6c3', 22, true);
        break;
      }
      case 'shield':
        p.shield = true;
        DR.audio.play('power'); DR.ui.toast('FEATHER SHIELD', '#41d6c3');
        FX.ring(sx, sy, '#41d6c3', 22, .5);
        break;
      case 'magnet':
        if (p.duck.id !== 'mama') g.powers.magnet.t = g.powers.magnet.max = 8;
        DR.audio.play('power'); DR.ui.toast('BREAD MAGNET', '#ff6b7a');
        FX.ring(sx, sy, '#ff6b7a', 22, .5);
        break;
      case 'boost':
        g.powers.boost.t = g.powers.boost.max = 5;
        DR.audio.play('power'); DR.ui.toast('TURBO QUACK!', '#ffd447');
        FX.ring(sx, sy, '#ffd447', 26, .55);
        g.shake = Math.max(g.shake, 8);
        break;
      case 'life':
        if (g.lives < 5) {
          g.lives++;
          if (g.lives > g.maxLives) { g.maxLives = g.lives; DR.ui.buildLives(g.maxLives); }
          DR.ui.refreshLives(g.lives);
        } else g.score += 500;
        DR.audio.play('unlock'); DR.ui.toast('EXTRA DUCKLING!', '#ffd447');
        FX.ring(sx, sy, '#ffd447', 26, .6);
        break;
    }
  }

  function killEnemy(e, how) {
    var p = g.player;
    e.dead = true; e.gone = true;
    g.kills++;
    var pts = (e.def.score || 100) * (how === 'stomp' ? 1.5 : 1);
    g.score += Math.round(pts);
    var sx = DR.PLAYER_X + (e.x - g.camX), sy = DR.laneY(e.lane) - (e.yOff || 0) - e.h / 2;
    DR.audio.play(how === 'stomp' ? 'stomp' : 'kill');
    FX.impact(sx, sy, '#fff');
    FX.feathers(sx, sy, 9, ['#fff6dd', '#ffd447', '#ffae2b']);
    FX.pop(sx, sy - 26, '+' + Math.round(pts), '#fff', 20);
    g.shake = Math.max(g.shake, how === 'stomp' ? 9 : 6);
    g.hitstop = Math.max(g.hitstop, 0.055);
    if (how === 'stomp') { p.vy = 620; p.grounded = false; p.jumps = 1; p.cutJump = false; }
  }

  function damage(src) {
    var p = g.player;
    if (p.invuln > 0 || p.dying) return;
    g.lastHitBy = src ? (src.kind === 'proj' ? 'proj:' + src.art : src.kind || src.id || '?') : '?';
    if (g.powers.boost.t > 0) return;   // turbo makes you invincible

    if (p.shield) {
      p.shield = false;
      p.invuln = 1.1;
      if (p.duck.id === 'knight') p.shieldRegen = 14;
      DR.audio.play('shieldBreak');
      FX.ring(DR.PLAYER_X, playerY(p) - 26, '#41d6c3', 24, .5);
      FX.burst(DR.PLAYER_X, playerY(p) - 26, 22, { color: ['#41d6c3', '#fff'], shape: 'shard', add: true, spMax: 340, lifeMax: .7 });
      FX.pop(DR.PLAYER_X, playerY(p) - 76, 'SHIELD!', '#41d6c3', 22, true);
      g.shake = Math.max(g.shake, 10);
      g.hitstop = Math.max(g.hitstop, .07);
      return;
    }

    g.lives--;
    p.combo = 0; p.comboT = 0;
    g.noHitDist = 0; g.flawless = 0;
    p.invuln = p.duck.id === 'classic' ? 2.6 : 1.8;
    p.blink = 0;
    flashDamage = 1; vignette = 1;
    g.shake = Math.max(g.shake, 20);
    g.hitstop = Math.max(g.hitstop, .13);
    g.slow = .5;
    g.speed *= 0.6;
    DR.audio.play('hurt');
    FX.feathers(DR.PLAYER_X, playerY(p) - 26, 16, [p.duck.look.body, '#fff', '#ffae2b']);
    FX.burst(DR.PLAYER_X, playerY(p) - 26, 16, { color: ['#ff5f6d', '#fff'], shape: 'spark', add: true, spMax: 420 });
    FX.pop(DR.PLAYER_X, playerY(p) - 80, 'OUCH!', '#ff5f6d', 26, true);
    DR.ui.refreshLives(g.lives);

    if (g.lives <= 0) {
      p.dying = true; p.dieT = 0; p.vy = 760; p.grounded = false;
      DR.audio.stopMusic();
      DR.audio.play('lose');
      g.shake = Math.max(g.shake, 26);
    }
  }

  function finishDeath() {
    mode = 'over';
    var total = Math.floor(g.score + g.dist * 2);
    DR.progress.runs++;
    DR.progress.totalHats += g.hats;
    DR.progress.totalEggs += g.eggs;
    var newBest = false;
    if (g.endless) {
      if (g.dist > DR.progress.endlessDist) { DR.progress.endlessDist = Math.floor(g.dist); newBest = true; }
      if (total > DR.progress.endlessScore) { DR.progress.endlessScore = total; newBest = true; }
    }
    DR.saveProgress();
    var unlocked = DR.checkDuckUnlocks();
    DR.ui.setHudVisible(false);
    DR.ui.setBoss(null);
    DR.ui.showGameOver({
      dist: g.dist, hats: g.hats, eggs: g.eggs, kills: g.kills, dodges: g.dodges,
      score: total, endless: g.endless, newBest: newBest,
      bestDist: DR.progress.endlessDist, zone: g.zone + 1
    });
    if (unlocked.length) {
      setTimeout(function () {
        DR.audio.play('unlock');
        DR.ui.toast('NEW DUCK: ' + unlocked[0].name, '#ffd447');
      }, 700);
    }
  }

  /* ============================================================
     Boss flow
     ============================================================ */
  /* Rewards for beating a hazard by a hair — the reason to take risks. */
  function nearMiss(e) {
    var p = g.player;
    if (e.type === 'obstacle' && (e.kind === 'bounce' || !E.hostile(e))) return;
    var sy = playerY(p) - 70;
    if (e.lane === p.lane && p.py > 24) {
      g.dodges++;
      g.score += 30;
      FX.pop(DR.PLAYER_X - 30, sy, 'AIR DODGE +30', '#8fd3ff', 17, true);
    } else if (e.lane === p.lastLane && (g.time - (p.laneSwitchAt || -9)) < 0.5) {
      g.dodges++;
      g.score += 60;
      FX.pop(DR.PLAYER_X - 30, sy, 'CLOSE CALL +60', '#ffae2b', 18, true);
      FX.burst(DR.PLAYER_X - 20, sy + 40, 6, { color: ['#ffae2b', '#fff'], shape: 'spark', add: true, spMax: 200, lifeMax: .3 });
    }
  }

  /* ---------- endless zones ---------- */
  function nextZone() {
    g.zone++;
    var prevTheme = g.level.theme;
    DR.endlessZone(g.level, g.zone);
    g.zoneStartX = g.camX;
    DR.spawner.reset(g);
    levelBanner = 2.0;
    g.shake = Math.max(g.shake, 8);
    DR.audio.play('menuBig');
    DR.ui.toast('ZONE ' + (g.zone + 1) + '\n' + g.level.zoneName, '#ffd447');
    for (var i = 0; i < 26; i++) {
      FX.spawn({
        x: U.rand(0, W), y: U.rand(80, 420), vx: U.rand(-90, 90), vy: U.rand(-200, -40),
        g: 300, drag: 1.2, life: U.rand(.6, 1.2), size: U.rand(2, 6),
        color: U.pick(['#ffd447', '#fff6dd', '#41d6c3']), shape: 'star', add: true
      });
    }
    if (g.level.theme !== prevTheme) DR.audio.music(g.level.music);
  }

  function endlessBossDown() {
    g.phase = 'run';
    g.boss = null;
    g.bossCount++;
    DR.progress.bossesBeaten++;
    DR.saveProgress();
    DR.checkDuckUnlocks().forEach(function (d) {
      DR.ui.toast('NEW DUCK: ' + d.name, '#ffd447');
    });
    DR.ui.setBoss(null);
    var bonus = 2000 * g.bossCount;
    g.score += bonus;
    if (g.lives < 5) {
      g.lives++;
      if (g.lives > g.maxLives) { g.maxLives = g.lives; DR.ui.buildLives(g.maxLives); }
      DR.ui.refreshLives(g.lives);
    }
    DR.audio.play('win');
    FX.pop(W / 2, 240, 'BOSS DOWN +' + U.fmt(bonus), '#ffd447', 30, true);
    DR.ui.toast('BOSS DOWN!\n+1 LIFE', '#ffd447');
    nextZone();
    DR.audio.music(g.level.music);
  }

  function enterBoss() {
    g.phase = 'bossintro';
    g.phaseT = 0;
    var bossId = g.endless
      ? DR.ENDLESS_BOSSES[g.bossCount % DR.ENDLESS_BOSSES.length]
      : g.level.boss;
    var hpMul = g.endless ? 1 + Math.floor(g.bossCount / DR.ENDLESS_BOSSES.length) * 0.5 : 1;
    DR.audio.music('boss');
    DR.ui.toast('BOSS INCOMING!', '#ff5f6d');
    // clear any hazard still ahead so the arena starts clean
    for (var i = g.entities.length - 1; i >= 0; i--) {
      var e = g.entities[i];
      if ((e.type === 'obstacle' || e.type === 'enemy') && e.x > g.camX + 200) g.entities.splice(i, 1);
    }
    g.timers.push({
      t: 1.1, fn: function () {
        g.boss = DR.bossSys.create(bossId, hpMul);
        g.phase = 'boss';
        DR.ui.setBoss(g.boss);
        g.shake = Math.max(g.shake, 14);
      }
    });
  }

  function winLevel() {
    g.phase = 'won';
    var p = g.player;
    mode = 'complete';
    DR.audio.stopMusic();
    DR.audio.play('win');
    g.shake = Math.max(g.shake, 12);
    for (var i = 0; i < 40; i++) {
      FX.spawn({
        x: U.rand(0, W), y: U.rand(60, 300), vx: U.rand(-140, 140), vy: U.rand(-260, -60),
        g: 380, drag: 1.1, life: U.rand(.9, 1.8), size: U.rand(3, 7),
        color: U.pick(['#ffd447', '#fff6dd', '#41d6c3', '#ff9ec4']), shape: 'star', add: true, spin: U.rand(-8, 8)
      });
    }

    var eggVal = p.duck.id === 'mama' ? 100 : 50;
    var bossBonus = 1000 * g.level.id;
    var lifeBonus = g.lives * 250;
    var perfect = g.lives === g.maxLives;
    var perfectBonus = perfect ? 1500 * g.level.id : 0;
    var total = Math.floor(g.score + g.dist * 2 + bossBonus + lifeBonus + perfectBonus);
    var par = 3800 + g.level.id * 2400;
    var rank = total >= par * 1.7 ? 'S' : total >= par * 1.3 ? 'A' : total >= par ? 'B' : 'C';

    DR.progress.runs++;
    DR.progress.totalHats += g.hats;
    DR.progress.totalEggs += g.eggs;
    DR.progress.bossesBeaten++;
    var newBest = false;
    if (!DR.progress.best[g.level.id] || total > DR.progress.best[g.level.id]) {
      DR.progress.best[g.level.id] = total;
      newBest = true;
    }
    var wasLocked = DR.progress.unlockedLevels;
    if (g.level.id >= DR.progress.unlockedLevels && g.level.id < DR.LEVELS.length) {
      DR.progress.unlockedLevels = g.level.id + 1;
    }
    DR.saveProgress();

    var unlocks = [];
    if (DR.progress.unlockedLevels > wasLocked) {
      unlocks.push('LEVEL ' + DR.progress.unlockedLevels + ': ' + DR.levelById(DR.progress.unlockedLevels).name);
    }
    DR.checkDuckUnlocks().forEach(function (d) {
      unlocks.push('NEW DUCK: ' + d.name + ' — ' + d.ability.name);
    });

    var isFinal = g.level.id >= DR.LEVELS.length;
    setTimeout(function () {
      DR.ui.setHudVisible(false);
      DR.ui.setBoss(null);
      DR.ui.showComplete({
        dist: g.dist, hats: g.hats, eggs: g.eggs, kills: g.kills, dodges: g.dodges,
        eggScore: g.eggs * eggVal, bossBonus: bossBonus, lifeBonus: lifeBonus,
        perfect: perfect, perfectBonus: perfectBonus, rank: rank,
        lives: g.lives, score: total, newBest: newBest
      }, unlocks, isFinal);
      if (unlocks.length) DR.audio.play('unlock');
    }, 1500);
  }

  /* ============================================================
     Rendering
     ============================================================ */
  function renderIntro() {
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    DR.intro.draw(ctx);
  }

  function render() {
    if (!g) return;
    if (r3dReady && R3D && R3D.render) {
      R3D.render(g);
      return;
    }
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    var t = g.time;

    ctx.save();
    if (g.shake > 0.2) {
      ctx.translate(U.rand(-g.shake, g.shake) * .6, U.rand(-g.shake, g.shake) * .6);
    }

    DR.drawSky(ctx, g.level);
    DR.drawParallax(ctx, g.level, g.camX, t);
    DR.drawPaths(ctx, g.level, g.camX, t);

    /* entities + player, sorted back path → front path */
    var p = g.player;
    var pLane = Math.round(p.laneV);
    for (var lane = 0; lane < 3; lane++) {
      for (var i = 0; i < g.entities.length; i++) {
        var e = g.entities[i];
        if (e.lane === lane && e.type !== 'pickup') E.draw(ctx, e, g.camX, t);
      }
      for (var j = 0; j < g.entities.length; j++) {
        var e2 = g.entities[j];
        if (e2.lane === lane && e2.type === 'pickup') E.draw(ctx, e2, g.camX, t);
      }
      if (g.boss && g.boss.mode === 'charge' && g.boss.lane === lane) DR.bossSys.draw(ctx, g.boss, g, t);
      if (g.boss && lane === 0 && g.boss.mode !== 'charge') DR.bossSys.draw(ctx, g.boss, g, t);
      if (pLane === lane) drawPlayer(ctx, p, t);
    }

    FX.draw(ctx);
    FX.drawPops(ctx);

    DR.drawForeground(ctx, g.level, g.camX, t);

    if (g.powers.boost.t > 0 || p.dashT > 0) drawSpeedLines(ctx, t);

    ctx.restore();

    /* screen effects */
    if (vignette > 0) {
      ctx.save();
      var vg = ctx.createRadialGradient(W / 2, H / 2, H * .28, W / 2, H / 2, H * .78);
      vg.addColorStop(0, 'rgba(255,0,40,0)');
      vg.addColorStop(1, 'rgba(255,0,40,' + (0.5 * vignette) + ')');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (flashDamage > 0) {
      ctx.save();
      ctx.globalAlpha = flashDamage * .38;
      ctx.fillStyle = '#ff4d6d'; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    if (g.boss) DR.bossSys.drawBanner(ctx, g.boss, t);
    if (levelBanner > 0 && mode === 'play') drawLevelBanner(ctx);
    if (g.phase === 'won') drawWinBanner(ctx);
    if (mode === 'menu') drawAttractVeil(ctx);
    if (paused) {
      ctx.save();
      ctx.fillStyle = 'rgba(4,10,18,.35)'; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  function drawPlayer(ctx, p, t) {
    var x = DR.PLAYER_X, y = playerY(p);
    var s = DR.laneScale(p.laneV) * 0.94;
    var invulnBlink = p.invuln > 0 && Math.floor(p.blink * 14) % 2 === 0;

    Art.shadow(ctx, x, laneYf(p.laneV) + 3, 20 * s * (1 - U.clamp(p.py / 260, 0, .55)), .26 * (1 - U.clamp(p.py / 300, 0, .6)));

    // turbo aura
    if (g.powers.boost.t > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var ag = ctx.createRadialGradient(x, y - 30, 6, x, y - 30, 70);
      ag.addColorStop(0, 'rgba(255,212,71,.5)'); ag.addColorStop(1, 'rgba(255,212,71,0)');
      ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(x, y - 30, 70, 0, 6.2832); ctx.fill();
      ctx.restore();
    }

    ctx.save();
    if (invulnBlink) ctx.globalAlpha = 0.38;
    Art.duck(ctx, p.duck.look, x, y, s, {
      run: p.run, air: !p.grounded, time: t, tilt: p.tilt,
      squash: p.squash, dead: p.dying,
      flap: p.hoverT > 0 ? Math.sin(t * 30) * .9 : (!p.grounded ? -0.35 + Math.sin(t * 16) * .25 : undefined)
    });
    ctx.restore();

    // feather shield bubble
    if (p.shield) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = .55 + Math.sin(t * 5) * .12;
      ctx.strokeStyle = '#41d6c3'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x + 2, y - 28, 29, 35, 0, 0, 6.2832); ctx.stroke();
      ctx.globalAlpha = .13; ctx.fillStyle = '#41d6c3'; ctx.fill();
      ctx.restore();
    }
    // dash streak
    if (p.dashT > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = U.clamp(p.dashT * 2.4, 0, .7);
      ctx.fillStyle = p.duck.id === 'ninja' ? '#ff5f6d' : '#ffd447';
      for (var k = 1; k <= 3; k++) {
        ctx.globalAlpha = .16 / k;
        Art.duck(ctx, p.duck.look, x - k * 26, y, s, { run: p.run, air: !p.grounded, time: t, tilt: p.tilt, alpha: .5 });
      }
      ctx.restore();
    }
  }

  function drawSpeedLines(ctx, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 16; i++) {
      var y = (U.hash(i * 3.7) * H);
      var x = (W + 200) - ((t * 1900 + U.hash(i) * 1400) % (W + 400));
      ctx.globalAlpha = .1 + U.hash(i + 5) * .12;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x, y, 90 + U.hash(i + 9) * 120, 2);
    }
    ctx.restore();
  }

  function drawLevelBanner(ctx) {
    var k = U.clamp(1 - levelBanner / 2.4, 0, 1);
    var a = k < .12 ? k / .12 : (k > .8 ? 1 - (k - .8) / .2 : 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    var yy = 132 - (1 - U.easeOutCubic(U.clamp(k / .2, 0, 1))) * 30;
    ctx.font = '800 16px "Trebuchet MS",Verdana,sans-serif';
    ctx.fillStyle = '#ffd447';
    ctx.fillText('LEVEL ' + g.level.id, W / 2, yy - 34);
    ctx.font = '900 44px "Trebuchet MS",Verdana,sans-serif';
    ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(6,16,28,.75)';
    ctx.strokeText(g.level.name, W / 2, yy);
    ctx.fillStyle = '#fff';
    ctx.fillText(g.level.name, W / 2, yy);
    ctx.font = '700 17px "Trebuchet MS",Verdana,sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.fillText(g.level.sub, W / 2, yy + 28);
    ctx.restore();
  }

  function drawWinBanner(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    var pulse = 1 + Math.sin(g.time * 6) * .03;
    ctx.translate(W / 2, 190);
    ctx.scale(pulse, pulse);
    ctx.font = '900 54px "Trebuchet MS",Verdana,sans-serif';
    ctx.lineWidth = 9; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(6,16,28,.8)';
    ctx.strokeText('BOSS DOWN!', 0, 0);
    ctx.fillStyle = '#ffd447';
    ctx.fillText('BOSS DOWN!', 0, 0);
    ctx.restore();
  }

  function drawAttractVeil(ctx) {
    ctx.save();
    var vg = ctx.createLinearGradient(0, 0, 0, H);
    vg.addColorStop(0, 'rgba(4,12,22,.6)');
    vg.addColorStop(.5, 'rgba(4,12,22,.34)');
    vg.addColorStop(1, 'rgba(4,12,22,.66)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

})(window.DR);
