/* ============================================================
   levels.js — level table + all parallax backdrop rendering
   ============================================================ */
(function (DR) {
  'use strict';
  var U = DR.util, W = DR.W, H = DR.H, TAU = Math.PI * 2;

  /** Repeat a drawing across the screen at a parallax factor. */
  function tile(camX, factor, spacing, cb) {
    var off = camX * factor;
    var i0 = Math.floor((off - 260) / spacing);
    var i1 = Math.ceil((off + W + 260) / spacing);
    for (var i = i0; i <= i1; i++) cb(i * spacing - off, i);
  }

  /** Cached radial gradient — backdrop suns never move, so build them once. */
  function radial(ctx, key, x, y, r0, r1, c0, c1) {
    var g = gradCache[key];
    if (!g) {
      g = ctx.createRadialGradient(x, y, r0, x, y, r1);
      g.addColorStop(0, c0); g.addColorStop(1, c1);
      gradCache[key] = g;
    }
    return g;
  }

  function hills(ctx, camX, factor, baseY, amp, color, seed, spacing) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-60, H);
    var off = camX * factor;
    for (var x = -60; x <= W + 60; x += 12) {
      var u = (x + off) / spacing;
      var y = baseY - (Math.sin(u) * .6 + Math.sin(u * 1.9 + seed) * .4) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 60, H); ctx.closePath(); ctx.fill();
  }

  /* ============================================================
     THEMES
     ============================================================ */
  var THEMES = {

    pond: {
      sky: ['#7fd4ff', '#c9f0ff', '#eaf9d9'],
      path: '#b5762f', pathTop: '#e0a55c', pathEdge: '#5c3a1a', dirt: '#7a4a1e',
      deep: '#123a2e', fog: 'rgba(180,230,255,.10)', tint: '#2a3f6b',
      far: function (ctx, camX, t) {
        // sun
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = radial(ctx, 'pondSun', 752, 108, 12, 120, 'rgba(255,250,210,.95)', 'rgba(255,240,170,0)');
        ctx.beginPath(); ctx.arc(752, 108, 120, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#fffbe0'; ctx.beginPath(); ctx.arc(752, 108, 34, 0, TAU); ctx.fill();
        // clouds
        tile(camX, .04, 420, function (x, i) {
          var y = 60 + U.hash(i * 3.1) * 70;
          ctx.save(); ctx.globalAlpha = .8; ctx.fillStyle = '#ffffff';
          for (var b = 0; b < 4; b++) {
            ctx.beginPath();
            ctx.arc(x + b * 34, y - Math.sin(b * 1.4 + i) * 12, 22 + U.hash(i + b) * 12, 0, TAU); ctx.fill();
          }
          ctx.restore();
        });
        hills(ctx, camX, .10, 250, 46, '#9fd67f', 1.7, 190);
        hills(ctx, camX, .17, 268, 34, '#7cc35f', 4.3, 130);
        // distant trees
        tile(camX, .24, 96, function (x, i) {
          var s = .7 + U.hash(i * 2.7) * .5;
          ctx.fillStyle = '#4f9a44';
          ctx.beginPath(); ctx.arc(x, 262 - 22 * s, 22 * s, 0, TAU); ctx.fill();
          ctx.fillStyle = '#3b7a33'; ctx.fillRect(x - 3 * s, 262 - 22 * s, 6 * s, 26 * s);
        });
      },
      mid: function (ctx, camX, t) {
        // pond water between the paths
        ctx.fillStyle = 'rgba(60,140,190,.35)';
        ctx.fillRect(0, 288, W, 252);
        tile(camX, .5, 150, function (x, i) {
          var y = 300 + (i % 3) * 78;
          ctx.save(); ctx.globalAlpha = .5;
          ctx.fillStyle = '#3d7a33';
          ctx.beginPath(); ctx.ellipse(x, y, 34, 10, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ff9ec4';
          ctx.beginPath(); ctx.arc(x + 12, y - 5, 5, 0, TAU); ctx.fill();
          ctx.restore();
        });
      },
      fore: function (ctx, camX, t) {
        tile(camX, 1.35, 210, function (x, i) {
          ctx.save(); ctx.globalAlpha = .55; ctx.strokeStyle = '#2f6b2b'; ctx.lineWidth = 6; ctx.lineCap = 'round';
          for (var k = 0; k < 3; k++) {
            ctx.beginPath(); ctx.moveTo(x + k * 12, H + 6);
            ctx.quadraticCurveTo(x + k * 12 + 10, H - 40, x + k * 12 + Math.sin(t * 2 + k + i) * 12, H - 84);
            ctx.stroke();
          }
          ctx.restore();
        });
      }
    },

    farm: {
      sky: ['#ffd08a', '#ffe9b0', '#fff6dd'],
      path: '#6b4423', pathTop: '#f2d89b', pathEdge: '#33200c', dirt: '#43280f',
      deep: '#33190a', fog: 'rgba(255,210,140,.10)', tint: '#6b4423',
      far: function (ctx, camX, t) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = radial(ctx, 'farmSun', 200, 130, 10, 150, 'rgba(255,240,190,.9)', 'rgba(255,200,120,0)');
        ctx.beginPath(); ctx.arc(200, 130, 150, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(200, 130, 40, 0, TAU); ctx.fill();
        hills(ctx, camX, .09, 246, 40, '#e0b45f', 2.1, 210);
        // windmills
        tile(camX, .16, 640, function (x, i) {
          ctx.save(); ctx.translate(x, 250);
          ctx.fillStyle = '#b98a4a';
          ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-8, -78); ctx.lineTo(8, -78); ctx.lineTo(14, 0); ctx.closePath(); ctx.fill();
          ctx.save(); ctx.translate(0, -80); ctx.rotate(t * .7 + i);
          ctx.fillStyle = '#8d5524';
          for (var b = 0; b < 4; b++) { ctx.save(); ctx.rotate(b * Math.PI / 2); ctx.fillRect(-3, 0, 6, -46); ctx.restore(); }
          ctx.restore(); ctx.restore();
        });
        hills(ctx, camX, .2, 270, 26, '#c99a52', 5.1, 150);
        // barns
        tile(camX, .3, 520, function (x, i) {
          ctx.save(); ctx.translate(x, 272);
          ctx.fillStyle = '#a83232';
          ctx.beginPath(); ctx.moveTo(-56, 0); ctx.lineTo(-56, -46); ctx.lineTo(0, -72); ctx.lineTo(56, -46); ctx.lineTo(56, 0); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#7d2424'; ctx.fillRect(-16, -34, 32, 34);
          ctx.fillStyle = '#fff3c4'; ctx.fillRect(-6, -58, 12, 12);
          ctx.restore();
        });
      },
      mid: function (ctx, camX, t) {
        tile(camX, .55, 118, function (x) {
          ctx.fillStyle = 'rgba(109,68,35,.5)';
          ctx.fillRect(x, 292, 8, 42);
          ctx.fillRect(x - 24, 300, 56, 5);
        });
      },
      fore: function (ctx, camX, t) {
        tile(camX, 1.4, 130, function (x, i) {
          ctx.save(); ctx.globalAlpha = .6; ctx.strokeStyle = '#c99a52'; ctx.lineWidth = 4;
          for (var k = 0; k < 2; k++) {
            ctx.beginPath(); ctx.moveTo(x + k * 14, H + 4);
            ctx.quadraticCurveTo(x + k * 14 + 6, H - 30, x + k * 14 + Math.sin(t * 2.4 + i + k) * 9, H - 62);
            ctx.stroke();
          }
          ctx.restore();
        });
      }
    },

    bath: {
      sky: ['#6fd7d0', '#a8e9e4', '#ffe3ef'],
      path: '#e9f6fb', pathTop: '#ffffff', pathEdge: '#5d8496', dirt: '#a9c6d4',
      deep: '#0d4459', fog: 'rgba(255,255,255,.10)', tint: '#3d7a8f',
      far: function (ctx, camX, t) {
        // tiled wall
        ctx.save();
        tile(camX, .07, 74, function (x, i) {
          for (var r = 0; r < 4; r++) {
            ctx.fillStyle = ((i + r) % 2) ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.32)';
            ctx.fillRect(x + (r % 2 ? 18 : 0), 40 + r * 62, 68, 56);
          }
        });
        ctx.restore();
        // porthole window
        tile(camX, .13, 720, function (x) {
          ctx.save(); ctx.translate(x, 130);
          ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(0, 0, 66, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(140,220,255,.75)'; ctx.beginPath(); ctx.arc(0, 0, 54, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.moveTo(-54, 0); ctx.lineTo(54, 0); ctx.moveTo(0, -54); ctx.lineTo(0, 54); ctx.stroke();
          ctx.restore();
        });
        // giant taps
        tile(camX, .22, 430, function (x) {
          ctx.save(); ctx.translate(x, 268); ctx.fillStyle = '#cfd8e2';
          ctx.fillRect(-10, -70, 20, 70);
          ctx.beginPath(); ctx.arc(0, -70, 26, Math.PI, TAU); ctx.fill();
          ctx.fillRect(-34, -74, 68, 10);
          ctx.fillStyle = 'rgba(150,225,255,.5)'; ctx.fillRect(-6, 0, 12, 26);
          ctx.restore();
        });
      },
      mid: function (ctx, camX, t) {
        tile(camX, .45, 96, function (x, i) {
          var y = 300 + ((i * 53) % 200);
          var r = 10 + U.hash(i) * 22;
          ctx.save();
          ctx.globalAlpha = .3;
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y - (t * 22 + i * 40) % 260, r, 0, TAU); ctx.stroke();
          ctx.restore();
        });
      },
      fore: function (ctx, camX, t) {
        tile(camX, 1.2, 180, function (x, i) {
          ctx.save(); ctx.globalAlpha = .28; ctx.fillStyle = '#ffffff';
          var y = H - ((t * 60 + i * 130) % (H + 120)) + 60;
          ctx.beginPath(); ctx.arc(x, y, 22 + U.hash(i) * 20, 0, TAU); ctx.fill();
          ctx.restore();
        });
      }
    },

    storm: {
      sky: ['#12203a', '#1d3557', '#2c4a70'],
      path: '#5b7396', pathTop: '#93b0d6', pathEdge: '#141d30', dirt: '#22304a',
      deep: '#060d1a', fog: 'rgba(90,130,190,.12)', tint: '#16233a',
      far: function (ctx, camX, t) {
        // lightning wash
        var f = Math.max(0, Math.sin(t * 0.9) * Math.sin(t * 5.3));
        if (f > .82) { ctx.fillStyle = 'rgba(190,220,255,' + ((f - .82) * 2.2) + ')'; ctx.fillRect(0, 0, W, H); }
        tile(camX, .06, 300, function (x, i) {
          ctx.save(); ctx.globalAlpha = .55; ctx.fillStyle = '#1a2c4a';
          for (var b = 0; b < 5; b++) {
            ctx.beginPath(); ctx.arc(x + b * 46, 90 + U.hash(i * 2 + b) * 60, 34 + U.hash(i + b) * 22, 0, TAU); ctx.fill();
          }
          ctx.restore();
        });
        tile(camX, .14, 240, function (x, i) {
          ctx.save(); ctx.globalAlpha = .7; ctx.fillStyle = '#243a5c';
          for (var b = 0; b < 4; b++) {
            ctx.beginPath(); ctx.arc(x + b * 52, 170 + U.hash(i * 3 + b) * 46, 40 + U.hash(i + b * 2) * 20, 0, TAU); ctx.fill();
          }
          ctx.restore();
        });
        hills(ctx, camX, .2, 276, 44, '#182640', 3.3, 170);
      },
      mid: function (ctx, camX, t) {
        ctx.save();
        ctx.strokeStyle = 'rgba(170,210,255,.32)'; ctx.lineWidth = 1.6;
        for (var i = 0; i < 60; i++) {
          var x = (U.hash(i) * (W + 200) - camX * .8 - t * 520) % (W + 200);
          if (x < -100) x += W + 200;
          var y = (U.hash(i + 99) * H + t * 900) % H;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 9, y + 24); ctx.stroke();
        }
        ctx.restore();
      },
      fore: function (ctx, camX, t) {
        ctx.save();
        ctx.strokeStyle = 'rgba(190,225,255,.5)'; ctx.lineWidth = 2.6;
        for (var i = 0; i < 26; i++) {
          var x = (U.hash(i * 7) * (W + 240) - t * 1400) % (W + 240);
          if (x < -120) x += W + 240;
          var y = (U.hash(i + 31) * H + t * 1700) % H;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 14, y + 38); ctx.stroke();
        }
        ctx.restore();
      }
    },

    nest: {
      sky: ['#42256b', '#a8447a', '#ff9a5c'],
      path: '#7a4a1e', pathTop: '#ffd447', pathEdge: '#3d2410', dirt: '#4a2c12',
      deep: '#2b1030', fog: 'rgba(255,180,120,.10)', tint: '#8d5524',
      far: function (ctx, camX, t) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = radial(ctx, 'nestSun', 560, 230, 20, 220, 'rgba(255,220,150,.85)', 'rgba(255,140,80,0)');
        ctx.beginPath(); ctx.arc(560, 230, 220, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(560, 230, 76, 0, TAU); ctx.fill();
        tile(camX, .05, 340, function (x, i) {
          ctx.save(); ctx.globalAlpha = .45; ctx.fillStyle = '#ffb27a';
          for (var b = 0; b < 5; b++) {
            ctx.beginPath(); ctx.ellipse(x + b * 58, 150 + U.hash(i + b) * 80, 52, 15, 0, 0, TAU); ctx.fill();
          }
          ctx.restore();
        });
        // golden pillars
        tile(camX, .18, 380, function (x) {
          ctx.save(); ctx.globalAlpha = .55; ctx.fillStyle = '#c98d4f';
          ctx.fillRect(x - 16, 60, 32, 220);
          ctx.fillStyle = '#ffd447'; ctx.fillRect(x - 22, 54, 44, 12);
          ctx.restore();
        });
      },
      mid: function (ctx, camX, t) {
        tile(camX, .42, 260, function (x, i) {
          var y = 300 + (i % 2) * 90 + Math.sin(t * 1.4 + i) * 8;
          ctx.save(); ctx.globalAlpha = .55;
          ctx.strokeStyle = '#8d5524'; ctx.lineWidth = 4; ctx.lineCap = 'round';
          for (var k = 0; k < 6; k++) {
            ctx.beginPath(); ctx.moveTo(x - 30 + k * 12, y); ctx.quadraticCurveTo(x + Math.sin(k) * 14, y - 16, x + 30 - k * 10, y + 2); ctx.stroke();
          }
          ctx.restore();
        });
      },
      fore: function (ctx, camX, t) {
        for (var i = 0; i < 12; i++) {
          var x = (U.hash(i * 5) * (W + 200) - camX * 1.1 - t * 60) % (W + 200);
          if (x < -100) x += W + 200;
          var y = (U.hash(i + 17) * H + t * 40 + Math.sin(t + i) * 30) % H;
          ctx.save(); ctx.globalAlpha = .35; ctx.translate(x, y); ctx.rotate(Math.sin(t + i) * .6);
          ctx.fillStyle = '#ffe9a8';
          ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(9, 0, 0, 12); ctx.quadraticCurveTo(-9, 0, 0, -12); ctx.fill();
          ctx.restore();
        }
      }
    }
  };

  DR.THEMES = THEMES;

  /* ============================================================
     LEVEL TABLE
     ============================================================ */
  DR.LEVELS = [
    {
      id: 1, name: 'DUCK POND', sub: 'Where every good run begins',
      theme: 'pond', music: 'pond', boss: 'honker',
      len: 12000, speed0: 380, speedMax: 520,
      obstacles: ['reeds', 'crate', 'puddle', 'decoy', 'bounce'],
      enemies: ['goose', 'frog'],
      slot: [300, 400], hazard: .62, enemy: .3, pickup: .82, doubleLane: .1
    },
    {
      id: 2, name: 'FEATHERED FARM', sub: 'Mind the sprinklers',
      theme: 'farm', music: 'farm', boss: 'strawman',
      len: 14000, speed0: 420, speedMax: 580,
      obstacles: ['crate', 'reeds', 'barrel', 'sprinkler', 'decoy', 'toystack', 'bounce'],
      enemies: ['goose', 'frog', 'duckling'],
      slot: [280, 375], hazard: .68, enemy: .38, pickup: .8, doubleLane: .18
    },
    {
      id: 3, name: 'BUBBLE BATHHOUSE', sub: 'Slippery when soapy',
      theme: 'bath', music: 'bath', boss: 'mecha',
      len: 16000, speed0: 460, speedMax: 630,
      obstacles: ['soap', 'toystack', 'brush', 'hook', 'sprinkler', 'crate', 'bounce'],
      enemies: ['crab', 'duckling', 'drone', 'frog'],
      slot: [270, 350], hazard: .72, enemy: .44, pickup: .78, doubleLane: .24
    },
    {
      id: 4, name: 'STORMY SKIES', sub: 'Feathers up, beak down',
      theme: 'storm', music: 'storm', boss: 'drake',
      len: 18000, speed0: 500, speedMax: 690,
      obstacles: ['net', 'zap', 'crate', 'hook', 'barrel', 'brush', 'bounce'],
      enemies: ['drone', 'goose', 'duckling', 'crab'],
      slot: [260, 335], hazard: .76, enemy: .5, pickup: .76, doubleLane: .3
    },
    {
      id: 5, name: 'THE GOLDEN NEST', sub: 'Only the bravest ducks',
      theme: 'nest', music: 'nest', boss: 'gander',
      len: 21000, speed0: 540, speedMax: 760,
      obstacles: ['crate', 'zap', 'net', 'hook', 'barrel', 'toystack', 'sprinkler', 'brush', 'decoy', 'bounce'],
      enemies: ['goose', 'drone', 'duckling', 'crab', 'frog'],
      slot: [250, 320], hazard: .8, enemy: .55, pickup: .74, doubleLane: .36
    }
  ];

  /* ============================================================
     ENDLESS RUN
     One run, no finish line. Zones rotate through every theme,
     a boss shows up every second zone and the pace never stops.
     ============================================================ */
  var ZONE_LEN = 8800;          // world px per zone (~400 m)

  DR.makeEndless = function () {
    var lvl = {
      id: 0, endless: true,
      name: 'ENDLESS RUN', sub: 'How far can one duck go?',
      theme: 'pond', music: 'pond', boss: 'honker',
      len: ZONE_LEN, speed0: 380, speedMax: 900,
      obstacles: [], enemies: [], slot: [300, 400],
      hazard: .62, enemy: .3, pickup: .82, doubleLane: .1,
      zone: 0
    };
    DR.endlessZone(lvl, 0);
    return lvl;
  };

  /** Re-skin the endless level for zone `z` (0-based), escalating forever. */
  DR.endlessZone = function (lvl, z) {
    var src = DR.LEVELS[Math.min(z, DR.LEVELS.length - 1)];
    var over = Math.max(0, z - (DR.LEVELS.length - 1));   // laps past the last theme
    if (z >= DR.LEVELS.length) src = DR.LEVELS[z % DR.LEVELS.length];
    lvl.zone = z;
    lvl.theme = src.theme;
    lvl.music = src.music;
    lvl.zoneName = src.name;
    lvl.obstacles = src.obstacles.slice();
    lvl.enemies = src.enemies.slice();
    lvl.slot = [Math.max(200, src.slot[0] - over * 12), Math.max(260, src.slot[1] - over * 14)];
    lvl.hazard = Math.min(.88, src.hazard + over * .03);
    lvl.enemy = Math.min(.7, src.enemy + over * .04);
    lvl.pickup = src.pickup;
    lvl.doubleLane = Math.min(.46, src.doubleLane + over * .03);
    lvl.len = ZONE_LEN;
    return lvl;
  };

  DR.ENDLESS_BOSSES = ['honker', 'strawman', 'mecha', 'drake', 'gander'];

  DR.levelById = function (id) {
    for (var i = 0; i < DR.LEVELS.length; i++) if (DR.LEVELS[i].id === id) return DR.LEVELS[i];
    return DR.LEVELS[0];
  };

  /* ============================================================
     BACKDROP RENDERING
     ============================================================ */
  var skyCache = {}, deepCache = {}, gradCache = {};
  DR.drawSky = function (ctx, lvl) {
    var th = THEMES[lvl.theme];
    var g = skyCache[lvl.theme];
    if (!g) {
      g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, th.sky[0]); g.addColorStop(.55, th.sky[1]); g.addColorStop(1, th.sky[2]);
      skyCache[lvl.theme] = g;
    }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  };

  DR.drawParallax = function (ctx, lvl, camX, t) {
    var th = THEMES[lvl.theme];
    th.far(ctx, camX, t);
    th.mid(ctx, camX, t);
    ctx.fillStyle = th.fog;
    ctx.fillRect(0, 200, W, H - 200);
    // Darken the play field so the bright running paths read clearly against it.
    var deep = deepCache[lvl.theme];
    if (!deep) {
      deep = ctx.createLinearGradient(0, 214, 0, H);
      deep.addColorStop(0, U.rgba(th.deep, 0));
      deep.addColorStop(.22, U.rgba(th.deep, .44));
      deep.addColorStop(1, U.rgba(th.deep, .72));
      deepCache[lvl.theme] = deep;
    }
    ctx.fillStyle = deep;
    ctx.fillRect(0, 214, W, H - 214);
  };

  DR.drawForeground = function (ctx, lvl, camX, t) {
    THEMES[lvl.theme].fore(ctx, camX, t);
  };

  /** The three running paths, drawn back-to-front with a depth tint. */
  DR.drawPaths = function (ctx, lvl, camX, t) {
    var th = THEMES[lvl.theme];
    for (var i = 0; i < DR.LANES; i++) {
      var y = DR.LANE_Y[i];
      var s = DR.laneScale(i);
      var thick = 24 * s;

      ctx.save();

      // hanging supports give each path a floating-platform silhouette
      ctx.globalAlpha = .55;
      ctx.fillStyle = th.pathEdge;
      var sp = 132, off = (camX * (0.9 + i * 0.07)) % sp;
      for (var px = -off - sp; px < W + sp; px += sp) {
        ctx.fillRect(px, y + thick, 9, 20 * s);
        ctx.fillRect(px + 46, y + thick, 5, 12 * s);
      }
      ctx.globalAlpha = 1;

      // drop shadow beneath the slab
      ctx.globalAlpha = .3; ctx.fillStyle = '#000';
      U.roundRect(ctx, -40, y + thick - 3, W + 80, 14, 7); ctx.fill();
      ctx.globalAlpha = 1;

      // slab body + dark outline
      ctx.fillStyle = th.path;
      U.roundRect(ctx, -40, y, W + 80, thick, 4); ctx.fill();
      ctx.lineWidth = 2.4; ctx.strokeStyle = th.pathEdge; ctx.stroke();

      // shaded underside
      ctx.fillStyle = th.dirt; ctx.globalAlpha = .6;
      ctx.fillRect(-40, y + thick * .58, W + 80, thick * .42);
      ctx.globalAlpha = 1;

      // bright running surface
      ctx.fillStyle = th.pathTop;
      ctx.fillRect(-40, y - 4, W + 80, 7);
      ctx.fillStyle = th.pathEdge;
      ctx.fillRect(-40, y + 3, W + 80, 1.5);

      // scrolling surface markings
      ctx.globalAlpha = .32; ctx.fillStyle = th.pathEdge;
      var sp2 = 62, off2 = (camX * (0.9 + i * 0.07)) % sp2;
      for (var x = -off2 - sp2; x < W + sp2; x += sp2) ctx.fillRect(x, y + 9 * s, 26, 3);
      ctx.globalAlpha = 1;

      // atmospheric haze on the further paths
      var depth = (2 - i) * 0.13;
      if (depth > 0) {
        ctx.globalAlpha = depth;
        ctx.fillStyle = th.sky[1];
        U.roundRect(ctx, -40, y - 5, W + 80, thick + 7, 4); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  };

})(window.DR);
