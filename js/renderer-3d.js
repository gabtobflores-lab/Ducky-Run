/* ============================================================
   renderer-3d.js — WebGL world renderer (Three.js)
   Maps the existing 2D game state onto a chase-camera 3D scene.
   Game space:  x = world scroll, lane = 0..2, py = height off ground
   Scene space: X = lane offset, Y = height, Z = depth ahead of duck
   ============================================================ */
var R3D = (function () {
  'use strict';

  var LANE_W = 96;       // scene units between lane centres
  var Z_SCALE = 0.85;    // scene units per screen pixel of depth
  var FAR = 2200;        // draw distance ahead of the duck
  var GROUND_LEN = 9000;
  var PLAYER_X = 232;    // must match DR.PLAYER_X

  var scene, camera, renderer, clock;
  var duck, duckParts, ground, laneStrips = [], sun, hemi, rim;
  var pool = {}, live = [];
  var bossMesh = null, bossKey = '';
  var ready = false, theme = null, duckId = null;
  var camShake = 0;

  /* ---------- helpers ---------- */
  function C(hex) { return new THREE.Color(hex || '#ffffff'); }

  /* Light tints must stay near white: a saturated sky colour used as a light
     reads as a paint job on the models (a blue key turns a yellow duck green). */
  function tint(hex, toWhite) {
    return C(hex).lerp(new THREE.Color(1, 1, 1), toWhite);
  }

  function mat(color, opts) {
    opts = opts || {};
    return new THREE.MeshStandardMaterial({
      color: C(color),
      roughness: opts.rough == null ? 0.75 : opts.rough,
      metalness: opts.metal || 0,
      emissive: C(opts.emissive || '#000000'),
      emissiveIntensity: opts.emissiveIntensity == null ? 1 : opts.emissiveIntensity,
      transparent: !!opts.opacity,
      opacity: opts.opacity == null ? 1 : opts.opacity,
      flatShading: !!opts.flat
    });
  }

  function box(w, h, d, color, opts) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function sphere(r, color, opts) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(color, opts));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function cyl(rt, rb, h, color, opts, seg) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat(color, opts));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function cone(r, h, color, opts) {
    var m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 12), mat(color, opts));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  /* ---------- scrolling path texture ---------- */
  function pathTexture(top, edge) {
    var c = document.createElement('canvas');
    c.width = 64; c.height = 128;
    var x = c.getContext('2d');
    x.fillStyle = top; x.fillRect(0, 0, 64, 128);
    x.fillStyle = edge;
    x.globalAlpha = 0.16;
    x.fillRect(0, 0, 64, 10);
    x.globalAlpha = 0.08;
    for (var i = 0; i < 5; i++) x.fillRect((i * 13) % 64, 20 + i * 19, 9, 5);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, GROUND_LEN / 128);
    return t;
  }

  /* ---------- duck ---------- */
  /* Mascot proportions: oversized head, bold silhouette, glossy shading.
     Built to read from behind, since that is the only angle the chase cam sees. */
  function buildDuck(look) {
    look = look || {};
    var cBody = look.body || '#ffd447';
    var cHead = look.head || cBody;
    var cBelly = look.belly || '#fff3c4';
    var cBeak = look.beak || '#f0932b';
    var cWing = look.wing || cBody;
    var cLegs = look.legs || cBeak;
    var cEye = look.eye || '#20161f';

    var GLOSS = { rough: 0.34, metal: 0.04 };
    var g = new THREE.Group();
    var p = {};

    /* --- torso: teardrop, heavier at the rump --- */
    p.body = sphere(22, cBody, GLOSS);
    p.body.scale.set(1.02, 0.94, 1.28);
    p.body.position.set(0, 30, -2);
    g.add(p.body);

    var rump = sphere(15, cBody, GLOSS);
    rump.scale.set(1.0, 0.92, 0.95);
    rump.position.set(0, 31, -20);
    g.add(rump);

    var belly = sphere(16, cBelly, { rough: 0.42 });
    belly.scale.set(0.92, 0.78, 1.05);
    belly.position.set(0, 22, 8);
    g.add(belly);

    /* --- tail: fanned feathers, the clearest read from a chase cam --- */
    p.tail = new THREE.Group();
    [-1, 0, 1].forEach(function (i) {
      var f = cone(6.2 - Math.abs(i) * 1.2, 16 - Math.abs(i) * 3, cWing, GLOSS);
      f.scale.set(1, 1, 0.34);          // blade-thin, so it fans instead of cones
      f.position.set(i * 7.5, 0, 0);
      f.rotation.x = -0.62;             // leans back off the rump
      f.rotation.z = i * 0.34;
      p.tail.add(f);
    });
    p.tail.position.set(0, 37, -24);
    g.add(p.tail);

    /* --- neck + head --- */
    p.neck = cyl(9, 12, 16, cHead, GLOSS);
    p.neck.position.set(0, 50, 4);
    p.neck.rotation.x = -0.18;
    g.add(p.neck);

    p.head = sphere(16, cHead, GLOSS);
    p.head.scale.set(1.04, 1, 0.98);
    p.head.position.set(0, 64, 8);
    g.add(p.head);

    /* --- eyes: large, wrapped onto the sides so they stay visible from behind --- */
    p.eyes = [];
    [-1, 1].forEach(function (sx) {
      var white = sphere(6.4, '#ffffff', { rough: 0.18 });
      white.scale.set(0.8, 1.18, 0.78);
      white.position.set(sx * 9.8, 66.2, 15.8);
      g.add(white);

      var iris = sphere(3.4, cEye, { rough: 0.12 });
      iris.scale.set(0.9, 1.1, 0.7);
      iris.position.set(sx * 11.0, 65.8, 19.4);
      g.add(iris);

      var spark = new THREE.Mesh(
        new THREE.SphereGeometry(1.25, 8, 8),
        new THREE.MeshBasicMaterial({ color: C('#ffffff') })
      );
      spark.position.set(sx * 11.9, 67.8, 21.0);
      g.add(spark);
      p.eyes.push(white);
    });

    /* --- beak: flat upper and lower mandible --- */
    p.beakTop = box(13, 4.6, 16, cBeak, { rough: 0.38 });
    p.beakTop.position.set(0, 62.5, 22);
    g.add(p.beakTop);
    p.beakLow = box(10.5, 3, 12, cBeak, { rough: 0.42 });
    p.beakLow.position.set(0, 58.8, 20);
    g.add(p.beakLow);

    /* --- wings: paddle shapes folded back along the ribs --- */
    p.wingL = sphere(13, cWing, GLOSS);
    p.wingL.scale.set(0.27, 0.78, 1.24);
    p.wingL.position.set(-19.5, 27.5, -3);
    g.add(p.wingL);
    p.wingR = sphere(13, cWing, GLOSS);
    p.wingR.scale.set(0.27, 0.78, 1.24);
    p.wingR.position.set(19.5, 27.5, -3);
    g.add(p.wingR);

    /* --- legs + webbed feet --- */
    p.legL = cyl(3, 3.4, 15, cLegs, { rough: 0.5 }, 8);
    p.legL.position.set(-8, 11, 0); g.add(p.legL);
    p.legR = cyl(3, 3.4, 15, cLegs, { rough: 0.5 }, 8);
    p.legR.position.set(8, 11, 0); g.add(p.legR);

    p.footL = cone(9, 5, cLegs, { rough: 0.45 });
    p.footL.rotation.x = -Math.PI / 2; p.footL.scale.set(1, 1, 0.55);
    p.footL.position.set(-8, 2.5, 5); g.add(p.footL);
    p.footR = cone(9, 5, cLegs, { rough: 0.45 });
    p.footR.rotation.x = -Math.PI / 2; p.footR.scale.set(1, 1, 0.55);
    p.footR.position.set(8, 2.5, 5); g.add(p.footR);

    /* --- power aura --- */
    p.aura = new THREE.Mesh(
      new THREE.SphereGeometry(44, 16, 12),
      new THREE.MeshBasicMaterial({
        color: C('#41d6c3'), transparent: true, opacity: 0.26,
        side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    p.aura.position.set(0, 34, -2); p.aura.visible = false;
    g.add(p.aura);

    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    duckParts = p;
    return g;
  }

  function disposeTree(root) {
    root.traverse(function (o) {
      if (!o.isMesh) return;
      o.geometry.dispose();
      if (Array.isArray(o.material)) o.material.forEach(function (m) { m.dispose(); });
      else o.material.dispose();
    });
  }

  function setDuck(look, id) {
    if (!ready || duckId === id) return;
    duckId = id;
    if (duck) { scene.remove(duck); disposeTree(duck); }
    duck = buildDuck(look);
    scene.add(duck);
  }

  /* ---------- entity builders ---------- */
  var BUILD = {
    /* obstacles */
    reeds: function () {
      var g = new THREE.Group();
      for (var i = 0; i < 5; i++) {
        var s = cone(4, 30 + (i % 3) * 12, '#3f8f3a', { rough: 0.8 });
        s.position.set(-14 + i * 7, 15 + (i % 3) * 6, (i % 2) * 6 - 3);
        s.rotation.z = (i - 2) * 0.09;
        g.add(s);
      }
      return g;
    },
    puddle: function () {
      var m = cyl(30, 30, 6, '#4aa8d8', { rough: 0.15, metal: 0.35, opacity: 0.85 }, 18);
      m.position.y = 3; return m;
    },
    brush: function () {
      var g = new THREE.Group();
      [[0, 0, 0, 20], [-13, -3, 3, 14], [13, -2, -3, 15]].forEach(function (a) {
        var s = sphere(a[3], '#4f8f3f', { rough: 0.9, flat: true });
        s.scale.y = 0.7; s.position.set(a[0], 14 + a[1], a[2]); g.add(s);
      });
      return g;
    },
    soap: function () {
      var m = box(46, 20, 30, '#eaf6ff', { rough: 0.25, metal: 0.1 });
      m.position.y = 10; return m;
    },
    crate: function () {
      var g = new THREE.Group();
      var b = box(40, 40, 40, '#a4703a', { rough: 0.85 });
      b.position.y = 20; g.add(b);
      [[0, 20.5], [0, -20.5]].forEach(function (a) {
        var f = box(42, 6, 3, '#6d4520', { rough: 0.9 });
        f.position.set(0, 20, a[1]); g.add(f);
      });
      return g;
    },
    decoy: function () {
      var g = new THREE.Group();
      var post = cyl(4, 5, 78, '#6d4520', { rough: 0.9 }, 8);
      post.position.y = 39; g.add(post);
      var b = sphere(17, '#d8d2c4', { rough: 0.7 });
      b.scale.set(1, 0.85, 1.2); b.position.y = 92; g.add(b);
      var h = sphere(10, '#d8d2c4', { rough: 0.7 }); h.position.set(0, 110, 8); g.add(h);
      var bk = box(7, 4, 11, '#ff8c1a', { rough: 0.5 }); bk.position.set(0, 108, 18); g.add(bk);
      return g;
    },
    toystack: function () {
      var g = new THREE.Group();
      ['#ff6b8a', '#ffd447', '#6fd7d0'].forEach(function (c, i) {
        var s = sphere(15 - i * 2, c, { rough: 0.4 });
        s.scale.y = 0.85; s.position.y = 16 + i * 30; g.add(s);
        var bk = box(6, 3, 9, '#ff8c1a', { rough: 0.5 });
        bk.position.set(0, 18 + i * 30, 12 - i); g.add(bk);
      });
      return g;
    },
    barrel: function () {
      var m = cyl(20, 20, 40, '#8a5a28', { rough: 0.8 }, 14);
      m.rotation.z = Math.PI / 2; m.position.y = 20;
      var g = new THREE.Group(); g.add(m);
      [-13, 13].forEach(function (z) {
        var r = new THREE.Mesh(new THREE.TorusGeometry(20.5, 2, 6, 16), mat('#4a3018', { rough: 0.8 }));
        r.rotation.y = Math.PI / 2; r.position.set(z, 20, 0); g.add(r);
      });
      g.userData.roll = m;
      return g;
    },
    net: function () {
      var g = new THREE.Group();
      var n = box(56, 46, 8, '#c8b48a', { rough: 0.9, opacity: 0.82 });
      n.position.y = 92; g.add(n);
      [-26, 26].forEach(function (x) {
        var rope = cyl(1.6, 1.6, 60, '#8a7550', { rough: 0.9 }, 6);
        rope.position.set(x, 145, 0); g.add(rope);
      });
      return g;
    },
    hook: function () {
      var g = new THREE.Group();
      var chain = cyl(1.8, 1.8, 70, '#9aa6b2', { rough: 0.4, metal: 0.7 }, 6);
      chain.position.y = 140; g.add(chain);
      var h = new THREE.Mesh(new THREE.TorusGeometry(12, 3.4, 8, 14, Math.PI * 1.4), mat('#b9c4d0', { rough: 0.3, metal: 0.8 }));
      h.position.y = 95; g.add(h);
      return g;
    },
    sprinkler: function () {
      var g = new THREE.Group();
      var post = cyl(3.5, 5, 40, '#5b7080', { rough: 0.5, metal: 0.5 }, 8);
      post.position.y = 20; g.add(post);
      var head = sphere(7, '#7d95a6', { rough: 0.4, metal: 0.5 }); head.position.y = 42; g.add(head);
      var spray = cyl(26, 4, 84, '#8fd3ff', { rough: 0.1, opacity: 0.42, emissive: '#4aa8d8', emissiveIntensity: 0.5 }, 12);
      spray.position.y = 86; g.add(spray);
      g.userData.spray = spray;
      return g;
    },
    zap: function () {
      var g = new THREE.Group();
      var rod = cyl(4, 6, 62, '#5b6b80', { rough: 0.35, metal: 0.7 }, 8);
      rod.position.y = 31; g.add(rod);
      var tip = cone(7, 16, '#c9d6e6', { rough: 0.2, metal: 0.8 }); tip.position.y = 70; g.add(tip);
      var arc = cyl(9, 3, 120, '#8fd3ff', { opacity: 0.6, emissive: '#8fd3ff', emissiveIntensity: 2, rough: 0.1 }, 8);
      arc.position.y = 120; g.add(arc);
      g.userData.arc = arc;
      return g;
    },
    bounce: function () {
      var g = new THREE.Group();
      var pad = box(52, 14, 40, '#e8b464', { rough: 0.7 });
      pad.position.y = 7; g.add(pad);
      var crust = box(54, 5, 42, '#c07f34', { rough: 0.8 });
      crust.position.y = 15; g.add(crust);
      return g;
    },

    /* enemies */
    goose: function () {
      var g = new THREE.Group();
      var b = sphere(20, '#f2f4f6', { rough: 0.7 });
      b.scale.set(1, 0.95, 1.3); b.position.y = 24; g.add(b);
      var neck = cyl(6, 7, 34, '#2c3138', { rough: 0.7 }, 10);
      neck.position.set(0, 50, 6); neck.rotation.x = -0.16; g.add(neck);
      var h = sphere(11, '#2c3138', { rough: 0.7 }); h.position.set(0, 70, 10); g.add(h);
      var bk = box(8, 5, 13, '#ff8c1a', { rough: 0.5 }); bk.position.set(0, 68, 21); g.add(bk);
      return g;
    },
    duckling: function () {
      var g = new THREE.Group();
      var b = sphere(12, '#ffe066', { rough: 0.65 });
      b.scale.set(1, 0.95, 1.2); b.position.y = 13; g.add(b);
      var h = sphere(8, '#ffe066', { rough: 0.6 }); h.position.set(0, 28, 5); g.add(h);
      var bk = box(5, 3, 8, '#ff8c1a', { rough: 0.5 }); bk.position.set(0, 27, 13); g.add(bk);
      return g;
    },
    frog: function () {
      var g = new THREE.Group();
      var b = sphere(18, '#5cc24a', { rough: 0.75 });
      b.scale.set(1.15, 0.82, 1.1); b.position.y = 16; g.add(b);
      [-8, 8].forEach(function (x) {
        var e = sphere(6, '#e8f7d8', { rough: 0.5 }); e.position.set(x, 30, 4); g.add(e);
        var p = sphere(2.8, '#12202c', { rough: 0.3 }); p.position.set(x, 31, 9); g.add(p);
      });
      [-15, 15].forEach(function (x) {
        var l = box(7, 6, 18, '#4aa83c', { rough: 0.8 }); l.position.set(x, 8, -8); g.add(l);
      });
      return g;
    },
    drone: function () {
      var g = new THREE.Group();
      var b = box(30, 18, 26, '#4a5568', { rough: 0.4, metal: 0.6 });
      b.position.y = 0; g.add(b);
      var eye = sphere(6, '#ff4d6d', { rough: 0.2, emissive: '#ff4d6d', emissiveIntensity: 1.6 });
      eye.position.set(0, 0, 15); g.add(eye);
      var rotor = box(46, 2, 5, '#8b97a8', { rough: 0.3, metal: 0.7 });
      rotor.position.y = 13; g.add(rotor);
      g.userData.rotor = rotor;
      return g;
    },
    crab: function () {
      var g = new THREE.Group();
      var b = sphere(21, '#e0524d', { rough: 0.5 });
      b.scale.set(1.3, 0.75, 1); b.position.y = 18; g.add(b);
      var shell = sphere(19, '#b83a36', { rough: 0.35, metal: 0.25 });
      shell.scale.set(1.25, 0.5, 0.95); shell.position.y = 26; g.add(shell);
      [-24, 24].forEach(function (x) {
        var claw = box(15, 12, 10, '#c94540', { rough: 0.5 });
        claw.position.set(x, 16, 8); g.add(claw);
      });
      [-10, 10].forEach(function (x) {
        var e = cyl(1.8, 1.8, 12, '#e0524d', { rough: 0.6 }, 6); e.position.set(x, 38, 6); g.add(e);
        var p = sphere(3, '#12202c', { rough: 0.2 }); p.position.set(x, 44, 6); g.add(p);
      });
      return g;
    },

    /* pickups */
    hat: function () {
      var g = new THREE.Group();
      var cap = sphere(12, '#4a90d9', { rough: 0.4 });
      cap.scale.y = 0.6; cap.position.y = 12; g.add(cap);
      var brim = new THREE.Mesh(new THREE.TorusGeometry(12, 2.6, 8, 18), mat('#2f6fb0', { rough: 0.45 }));
      brim.rotation.x = Math.PI / 2; brim.position.y = 8; g.add(brim);
      var stalk = cyl(1.5, 1.5, 8, '#d8d8d8', { rough: 0.3, metal: 0.6 }, 6);
      stalk.position.y = 22; g.add(stalk);
      var prop = new THREE.Group();
      [0, Math.PI / 2].forEach(function (r) {
        var bl = box(26, 1.6, 5, '#ffd447', { rough: 0.35, emissive: '#ffd447', emissiveIntensity: 0.35 });
        bl.rotation.y = r; prop.add(bl);
      });
      prop.position.y = 27; g.add(prop);
      g.userData.spin = prop;
      return g;
    },
    egg: function () {
      var g = new THREE.Group();
      var e = sphere(14, '#fff6e0', { rough: 0.35, emissive: '#ffe9b0', emissiveIntensity: 0.35 });
      e.scale.set(0.85, 1.15, 0.85); e.position.y = 17; g.add(e);
      g.userData.spin = g;
      return g;
    },
    shield: function () { return orb('#41d6c3'); },
    magnet: function () { return orb('#ff6b8a'); },
    boost: function () { return orb('#ffd447'); },
    life: function () { return orb('#ff4d6d'); },

    /* boss projectiles / telegraphs */
    proj: function () {
      var m = sphere(11, '#ffd447', { rough: 0.2, emissive: '#ff8c1a', emissiveIntensity: 1.6 });
      m.position.y = 0; return m;
    },
    warn: function () {
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(80, 700),
        new THREE.MeshBasicMaterial({ color: C('#ff4d6d'), transparent: true, opacity: 0.3, side: THREE.DoubleSide })
      );
      m.rotation.x = -Math.PI / 2; m.position.y = 2;
      return m;
    }
  };

  function orb(color) {
    var g = new THREE.Group();
    var core = sphere(13, color, { rough: 0.25, emissive: color, emissiveIntensity: 0.9 });
    core.position.y = 20; g.add(core);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(19, 2, 8, 20), mat(color, { emissive: color, emissiveIntensity: 0.7, rough: 0.3 }));
    ring.position.y = 20; g.add(ring);
    g.userData.spin = ring;
    return g;
  }

  function buildBoss(def) {
    var col = (def && def.color) || '#ff6b8a';
    var g = new THREE.Group();
    var b = sphere(48, col, { rough: 0.55 });
    b.scale.set(1.15, 1.05, 1.2); b.position.y = 62; g.add(b);
    var belly = sphere(34, '#fff6e0', { rough: 0.7 });
    belly.scale.set(0.9, 0.85, 0.6); belly.position.set(0, 48, 30); g.add(belly);
    var neck = cyl(15, 19, 40, col, { rough: 0.55 }, 12);
    neck.position.set(0, 110, 10); g.add(neck);
    var h = sphere(30, col, { rough: 0.5 }); h.position.set(0, 142, 16); g.add(h);
    var bk = box(20, 12, 30, '#ff8c1a', { rough: 0.45 }); bk.position.set(0, 138, 44); g.add(bk);
    [-13, 13].forEach(function (x) {
      var e = sphere(6.5, '#12202c', { rough: 0.2 }); e.position.set(x, 152, 40); g.add(e);
    });
    [-52, 52].forEach(function (x) {
      var w = box(10, 34, 52, col, { rough: 0.6 }); w.position.set(x, 66, -4); g.add(w);
    });
    var crown = new THREE.Mesh(new THREE.TorusGeometry(20, 4, 8, 16), mat('#ffd447', { metal: 0.8, rough: 0.25, emissive: '#ffd447', emissiveIntensity: 0.4 }));
    crown.rotation.x = Math.PI / 2; crown.position.set(0, 170, 12); g.add(crown);
    return g;
  }

  /* ============================================================
     Zone dressing — Green Hill styling: striped grass, checkered
     dirt cliffs, loop arches, palms, hills and clouds.
     ============================================================ */
  var ZONE = {
    pond:  { grass:'#4fc24a', grassDk:'#37a035', cliff:'#c08344', cliffDk:'#8a5620',
             loop:'#e6edf5', accent:'#ffd447', hill:'#2f8f4e', palm:'#2f8f4e', trunk:'#b5762f' },
    farm:  { grass:'#8bcf52', grassDk:'#66aa38', cliff:'#c9903f', cliffDk:'#93642a',
             loop:'#f2e3bd', accent:'#ff8c1a', hill:'#79b347', palm:'#59a33c', trunk:'#8a5a28' },
    bath:  { grass:'#7ad4e6', grassDk:'#4fb2ca', cliff:'#e4eef5', cliffDk:'#a9c6d4',
             loop:'#ffffff', accent:'#6fd7d0', hill:'#8fd9e8', palm:'#5cc2b4', trunk:'#cddfe8' },
    storm: { grass:'#3f6f92', grassDk:'#2c5173', cliff:'#5f7a9c', cliffDk:'#37496a',
             loop:'#b9cbe2', accent:'#8fd3ff', hill:'#33557a', palm:'#2f5d72', trunk:'#4a5f7d' },
    nest:  { grass:'#d4aa2e', grassDk:'#a8811a', cliff:'#8a5528', cliffDk:'#5d3615',
             loop:'#ffe9a8', accent:'#ffd447', hill:'#c1912a', palm:'#b8892a', trunk:'#6d4520' }
  };
  function zoneOf(lvl) { return ZONE[lvl && lvl.theme] || ZONE.pond; }

  /* The bank must slope more gently than the camera's grazing ray over the
     plateau edge, or the plateau hides it completely. */
  var PLATEAU_W = 400, BANK_W = 200, BANK_TILT = 0.38;
  var BANK_RUN = Math.cos(BANK_TILT) * BANK_W;
  var BANK_DROP = Math.sin(BANK_TILT) * BANK_W;
  var cliffL, cliffR, lowerPlain, loops = [], props = [], hills = [], clouds = [];
  var LOOP_SPACING = 2400, PROP_SPACING = 340;

  function stripeTexture(a, b) {
    var c = document.createElement('canvas');
    c.width = 8; c.height = 64;
    var x = c.getContext('2d');
    x.fillStyle = a; x.fillRect(0, 0, 8, 64);
    x.fillStyle = b; x.fillRect(0, 0, 8, 26);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter;
    return t;
  }

  function checkerTexture(a, b) {
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var x = c.getContext('2d');
    x.fillStyle = a; x.fillRect(0, 0, 64, 64);
    x.fillStyle = b; x.fillRect(0, 0, 32, 32); x.fillRect(32, 32, 32, 32);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter;
    return t;
  }

  function buildLoop() {
    var g = new THREE.Group();
    var outer = new THREE.Mesh(new THREE.TorusGeometry(140, 15, 12, 40), mat('#e6edf5', { rough: 0.5 }));
    outer.castShadow = true;
    g.add(outer);
    var inner = new THREE.Mesh(new THREE.TorusGeometry(140, 7, 10, 40), mat('#ffd447', { rough: 0.35, metal: 0.25 }));
    inner.position.z = 13;
    g.add(inner);
    var inner2 = inner.clone(); inner2.position.z = -13; g.add(inner2);
    [-1, 1].forEach(function (sx) {
      var leg = cyl(9, 13, 60, '#e6edf5', { rough: 0.6 }, 10);
      leg.position.set(sx * 138, -128, 0);
      leg.castShadow = true;
      g.add(leg);
    });
    g.position.y = 142;
    g.userData.outer = outer;
    g.userData.rings = [inner, inner2];
    return g;
  }

  function buildPalm() {
    var g = new THREE.Group();
    var tr = cyl(5, 8, 110, '#b5762f', { rough: 0.85 }, 8);
    tr.position.y = 55; tr.castShadow = true; g.add(tr);
    var fronds = [];
    for (var i = 0; i < 6; i++) {
      var f = cone(15, 52, '#2f8f4e', { rough: 0.8 });
      f.scale.set(1, 1, 0.3);
      f.position.set(0, 112, 0);
      f.rotation.z = Math.PI / 2.4 * Math.cos(i / 6 * 6.283);
      f.rotation.x = Math.PI / 2.4 * Math.sin(i / 6 * 6.283);
      f.castShadow = true;
      g.add(f); fronds.push(f);
    }
    g.userData.trunk = tr; g.userData.fronds = fronds;
    return g;
  }

  function buildFlower() {
    var g = new THREE.Group();
    var st = cyl(1.6, 1.6, 20, '#3aa635', { rough: 0.85 }, 6);
    st.position.y = 10; g.add(st);
    var head = sphere(7, '#ffd447', { rough: 0.5 });
    head.scale.y = 0.6; head.position.y = 22; g.add(head);
    g.userData.head = head;
    return g;
  }

  function buildScenery() {
    /* grass plateau the lanes sit on */
    ground.geometry.dispose();
    ground.geometry = new THREE.PlaneGeometry(PLATEAU_W, GROUND_LEN);
    ground.position.y = 0;

    /* Checkered dirt banks falling away on both sides. They are tilted about
       world Z (hence the ZXY euler order) so their faces turn up toward the
       chase camera -- a plain vertical wall would only ever show a backface. */
    var run = BANK_RUN, drop = BANK_DROP;
    [-1, 1].forEach(function (sx) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(BANK_W, GROUND_LEN), mat('#c08344', { rough: 0.95 }));
      m.rotation.order = 'ZXY';
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = -sx * BANK_TILT;
      m.position.set(sx * (PLATEAU_W / 2 + run / 2), -drop / 2, 0);
      /* Double-sided: the bank's geometric normal points away from the track,
         and DoubleSide both stops the backface cull and flips the shading normal. */
      m.material.side = THREE.DoubleSide;
      m.receiveShadow = true;
      scene.add(m);
      if (sx < 0) cliffL = m; else cliffR = m;
    });

    /* lower plain far below, so the track reads as a raised ledge */
    lowerPlain = new THREE.Mesh(new THREE.PlaneGeometry(5200, GROUND_LEN), mat('#37a035', { rough: 1 }));
    lowerPlain.rotation.x = -Math.PI / 2;
    lowerPlain.position.y = -BANK_DROP;
    scene.add(lowerPlain);

    for (var i = 0; i < 3; i++) { var lp = buildLoop(); lp.visible = false; scene.add(lp); loops.push(lp); }
    for (var j = 0; j < 18; j++) {
      var pr = (j % 3 === 0) ? buildPalm() : buildFlower();
      pr.visible = false; scene.add(pr); props.push(pr);
    }
    for (var h = 0; h < 7; h++) {
      var hl = cone(300 + (h % 3) * 120, 220 + (h % 4) * 90, '#2f8f4e', { rough: 1, flat: true });
      hl.position.set((h - 3) * 620, -BANK_DROP + 40, 1500 + (h % 3) * 420);
      scene.add(hl); hills.push(hl);
    }
    for (var k = 0; k < 9; k++) {
      var cl = new THREE.Group();
      [[0, 0, 46], [-38, -8, 32], [40, -6, 34]].forEach(function (a) {
        var puff = new THREE.Mesh(new THREE.SphereGeometry(a[2], 10, 8),
          new THREE.MeshBasicMaterial({ color: C('#ffffff'), transparent: true, opacity: 0.92 }));
        puff.position.set(a[0], a[1], 0);
        cl.add(puff);
      });
      cl.position.set((k - 4) * 480, 430 + (k % 3) * 90, 1700 + (k % 4) * 380);
      scene.add(cl); clouds.push(cl);
    }
  }

  function dressScenery(z) {
    ground.material.map = stripeTexture(z.grass, z.grassDk);
    ground.material.map.repeat.set(1, GROUND_LEN / 150);
    ground.material.color = C('#ffffff');
    ground.material.needsUpdate = true;

    var ck = checkerTexture(z.cliff, z.cliffDk);
    ck.repeat.set(2, GROUND_LEN / 110);
    [cliffL, cliffR].forEach(function (m) {
      if (m.material.map) m.material.map.dispose();
      m.material.map = ck;
      m.material.color = C('#ffffff');
      m.material.needsUpdate = true;
    });

    lowerPlain.material.color = C(z.grassDk);
    hills.forEach(function (h) { h.material.color = C(z.hill); });
    loops.forEach(function (lp) {
      lp.userData.outer.material.color = C(z.loop);
      lp.userData.rings.forEach(function (r) { r.material.color = C(z.accent); });
    });
    props.forEach(function (pr) {
      if (pr.userData.trunk) {
        pr.userData.trunk.material.color = C(z.trunk);
        pr.userData.fronds.forEach(function (f) { f.material.color = C(z.palm); });
      } else if (pr.userData.head) {
        pr.userData.head.material.color = C(z.accent);
      }
    });
  }

  /* Scenery is placed from world distance, not from the entity list, so it
     recycles forever without the spawner knowing about it. */
  function updateScenery(camX, t) {
    var headX = camX + PLAYER_X;

    var k = Math.ceil((headX - 500 / Z_SCALE) / LOOP_SPACING);
    loops.forEach(function (lp, i) {
      var wx = (k + i) * LOOP_SPACING;
      var z = (wx - headX) * Z_SCALE;
      if (z < -520 || z > FAR) { lp.visible = false; return; }
      lp.visible = true;
      lp.position.z = z;
      lp.userData.rings.forEach(function (r, ri) { r.rotation.z = t * (ri ? -1.4 : 1.4); });
    });

    var pk = Math.ceil((headX - 400 / Z_SCALE) / PROP_SPACING);
    props.forEach(function (pr, i) {
      var idx = pk + (i >> 1);
      var side = (i % 2) ? 1 : -1;
      var wx = idx * PROP_SPACING + (side > 0 ? PROP_SPACING * 0.5 : 0);
      var z = (wx - headX) * Z_SCALE;
      if (z < -420 || z > FAR) { pr.visible = false; return; }
      pr.visible = true;
      var jitter = ((idx * 37 + i * 11) % 60);
      pr.position.set(side * (PLATEAU_W / 2 - 26 - jitter * 0.4), 0, z);
      if (pr.userData.fronds) pr.rotation.y = idx * 0.7;
    });

    clouds.forEach(function (cl, i) {
      cl.position.z -= 0;
      cl.rotation.y = 0;
      cl.position.x = ((i - 4) * 480 + (-camX * 0.02 % 4320) + 4320) % 4320 - 2160;
    });
  }

  /* ---------- pooling ---------- */
  function acquire(kind) {
    var arr = pool[kind] || (pool[kind] = []);
    for (var i = 0; i < arr.length; i++) {
      if (!arr[i].busy) { arr[i].busy = true; arr[i].obj.visible = true; return arr[i].obj; }
    }
    var builder = BUILD[kind] || BUILD.crate;
    var obj = builder();
    obj.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(obj);
    arr.push({ obj: obj, busy: true });
    return obj;
  }

  function releaseAll() {
    for (var k in pool) {
      var arr = pool[k];
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].busy) { arr[i].busy = false; arr[i].obj.visible = false; }
      }
    }
  }

  /* ============================================================
     init
     ============================================================ */
  function init(canvas) {
    if (!window.THREE) { console.warn('[R3D] THREE.js unavailable'); return false; }
    if (ready) return true;

    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    } catch (e) {
      console.warn('[R3D] WebGL unavailable:', e.message);
      return false;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(canvas.clientWidth || 960, canvas.clientHeight || 540, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(62, 16 / 9, 1, FAR + 900);
    clock = new THREE.Clock();

    sun = new THREE.DirectionalLight(0xffffff, 0.95);
    sun.position.set(-320, 620, -260);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 1.6;
    sun.shadow.camera.near = 100;
    sun.shadow.camera.far = 1800;
    sun.shadow.camera.left = -420;
    sun.shadow.camera.right = 420;
    sun.shadow.camera.top = 420;
    sun.shadow.camera.bottom = -420;
    scene.add(sun);
    scene.add(sun.target);

    hemi = new THREE.HemisphereLight(0xffffff, 0x556677, 0.34);
    scene.add(hemi);

    /* back light that grazes the silhouette toward the camera */
    rim = new THREE.DirectionalLight(0xffffff, 0.45);
    rim.position.set(140, 300, 640);
    scene.add(rim);
    scene.add(rim.target);

    ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, GROUND_LEN),
      mat('#2f7a3a', { rough: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    ground.receiveShadow = true;
    scene.add(ground);

    for (var i = 0; i < 3; i++) {
      var strip = new THREE.Mesh(new THREE.PlaneGeometry(80, GROUND_LEN), mat('#b5762f', { rough: 0.95 }));
      strip.rotation.x = -Math.PI / 2;
      strip.position.set((i - 1) * LANE_W, 0.5, 0);
      strip.receiveShadow = true;
      laneStrips.push(strip);
      scene.add(strip);
    }

    buildScenery();

    duck = buildDuck({});
    scene.add(duck);

    ready = true;
    return true;
  }

  /* ---------- per-level theming ---------- */
  function setTheme(lvl) {
    if (!ready || !lvl) return;
    theme = lvl;
    var th = (DR.THEMES && DR.THEMES[lvl.theme]) || {};
    var skyTop = (th.sky && th.sky[0]) || '#7fd4ff';
    var skyMid = (th.sky && th.sky[1]) || skyTop;
    scene.background = C(skyMid);
    scene.fog = new THREE.Fog(C(skyMid), FAR * 0.8, FAR * 1.18);
    ground.material.color = C(th.deep || '#2f7a3a');
    var tex = pathTexture(th.pathTop || '#e0a55c', th.pathEdge || '#5c3a1a');
    laneStrips.forEach(function (s) {
      if (s.material.map) s.material.map.dispose();
      s.material.map = tex;
      s.material.color = C('#ffffff');
      s.material.needsUpdate = true;
    });
    var lum = C(skyMid);
    var bright = 0.3 * lum.r + 0.6 * lum.g + 0.1 * lum.b;
    sun.intensity = 0.62 + bright * 0.38;
    sun.color = tint(skyTop, 0.82);
    rim.color = tint(skyTop, 0.6);
    rim.intensity = 0.4 + (1 - bright) * 0.2;
    hemi.intensity = 0.2 + bright * 0.18;
    hemi.color = tint(skyTop, 0.55);
    hemi.groundColor = tint(th.deep || '#2f7a3a', 0.72);
    dressScenery(zoneOf(lvl));
    bossKey = '';
  }

  /* ---------- z mapping ---------- */
  function zOf(screenX) { return (screenX - PLAYER_X) * Z_SCALE; }

  /* ============================================================
     render
     ============================================================ */
  function render(g, mode) {
    if (!ready || !g) return;
    var dt = Math.min(clock.getDelta(), 0.1);
    var t = g.time || 0;
    var p = g.player;

    if (theme !== g.level) setTheme(g.level);
    if (p.duck) setDuck(p.duck.look, p.duck.id);

    /* --- scroll the path texture --- */
    var scroll = -(g.camX % GROUND_LEN) / 128;
    laneStrips.forEach(function (s) {
      if (s.material.map) s.material.map.offset.y = scroll;
    });
    if (ground.material.map) ground.material.map.offset.y = -(g.camX % GROUND_LEN) / 150;
    var bankScroll = -(g.camX % GROUND_LEN) / 110;
    [cliffL, cliffR].forEach(function (m) {
      if (m && m.material.map) m.material.map.offset.y = bankScroll;
    });
    updateScenery(g.camX, t);

    /* --- duck --- */
    var laneF = p.laneV == null ? p.lane : p.laneV;
    duck.position.x += ((laneF - 1) * LANE_W - duck.position.x) * Math.min(1, dt * 16);
    duck.position.y = (p.py || 0) * 0.92;
    duck.position.z = 0;

    var runCycle = Math.sin(t * 17);
    if (duckParts) {
      var air = !p.grounded;
      duckParts.legL.rotation.x = air ? -0.9 : runCycle * 0.85;
      duckParts.legR.rotation.x = air ? -0.9 : -runCycle * 0.85;
      duckParts.footL.position.z = 3 + (air ? -4 : runCycle * 6);
      duckParts.footR.position.z = 3 - (air ? 4 : runCycle * 6);
      var flap = air ? Math.sin(t * 26) * 0.9 : runCycle * 0.18;
      duckParts.wingL.rotation.z = 0.25 + flap;
      duckParts.wingR.rotation.z = -0.25 - flap;
      duckParts.body.position.y = 24 + (air ? 0 : Math.abs(runCycle) * 2.2);
      duckParts.head.position.y = 55 + (air ? 0 : Math.abs(runCycle) * 1.6);
      duckParts.aura.visible = !!(p.shield || (g.powers && g.powers.boost && g.powers.boost.t > 0));
      if (duckParts.aura.visible) {
        duckParts.aura.material.color = C(p.shield ? '#41d6c3' : '#ffd447');
        duckParts.aura.scale.setScalar(1 + Math.sin(t * 6) * 0.05);
      }
      duck.visible = !(p.invuln > 0 && Math.floor(t * 16) % 2 === 0);
    }
    duck.rotation.x = (p.tilt || 0) * 0.5 + (p.dying ? 0.8 : 0);
    duck.rotation.z = (laneF - 1 - (duck.position.x / LANE_W)) * -0.35;
    duck.scale.y = p.squash == null ? 1 : p.squash;

    /* --- entities --- */
    releaseAll();
    var ents = g.entities || [];
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      var sx = e.x - (e.type === 'proj' || e.type === 'warn' ? 0 : 0) - g.camX;
      var z = zOf(sx);
      if (z < -320 || z > FAR) continue;
      var kind = BUILD[e.kind] ? e.kind : (e.type === 'proj' ? 'proj' : (e.type === 'warn' ? 'warn' : 'crate'));
      var o = acquire(kind);
      o.position.set((e.lane - 1) * LANE_W, (e.yOff || 0) * 0.92 + (e.py || 0), z);
      o.rotation.y = 0;

      var ud = o.userData;
      if (ud.spin) ud.spin.rotation.y = t * 6;
      if (ud.rotor) ud.rotor.rotation.y = t * 34;
      if (ud.roll) ud.roll.rotation.x = -g.camX * 0.05;
      if (ud.spray) ud.spray.visible = !!e.active;
      if (ud.arc) ud.arc.visible = !!e.active;
      if (e.warn && ud.arc) { ud.arc.visible = true; ud.arc.scale.set(0.25, 1, 0.25); }
      else if (ud.arc) ud.arc.scale.set(1, 1, 1);
      if (kind === 'hat' || kind === 'egg') o.position.y += Math.sin(t * 3 + e.x * 0.01) * 5;
      o.scale.setScalar((e.def && e.def.scale) || 1);
    }

    /* --- boss --- */
    var b = g.boss;
    if (b) {
      var key = b.def ? b.def.art : 'boss';
      if (bossKey !== key) {
        if (bossMesh) scene.remove(bossMesh);
        bossMesh = buildBoss(b.def);
        bossMesh.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        scene.add(bossMesh);
        bossKey = key;
      }
      bossMesh.visible = true;
      var groundY = DR.LANE_Y[b.lane == null ? 1 : b.lane];
      bossMesh.position.set(
        ((b.lane == null ? 1 : b.lane) - 1) * LANE_W,
        Math.max(0, groundY - b.y) * 0.92,
        zOf(b.x)
      );
      bossMesh.scale.setScalar((b.def && b.def.scale ? b.def.scale : 1) * 1.15);
      bossMesh.rotation.y = Math.PI + Math.sin(t * 1.6) * 0.12;
      if (b.mode === 'dying') {
        bossMesh.rotation.z = Math.sin(t * 22) * 0.4;
        bossMesh.position.x += Math.sin(t * 48) * 8;
      } else {
        bossMesh.rotation.z = 0;
      }
    } else if (bossMesh) {
      bossMesh.visible = false;
    }

    /* --- camera (chase) --- */
    if (g.shake > camShake) camShake = g.shake;
    camShake *= Math.pow(0.02, dt);
    var boosting = (g.powers && g.powers.boost && g.powers.boost.t > 0) || (p.dashT || 0) > 0;
    var targetFov = boosting ? 68 : 58;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 5);
    camera.updateProjectionMatrix();

    var camTX = duck.position.x * 0.6;
    var camTY = 150 + duck.position.y * 0.45;
    camera.position.x += (camTX - camera.position.x) * Math.min(1, dt * 6);
    camera.position.y += (camTY - camera.position.y) * Math.min(1, dt * 5);
    camera.position.z = -292;
    if (camShake > 0.2) {
      camera.position.x += (Math.random() - 0.5) * camShake * 1.6;
      camera.position.y += (Math.random() - 0.5) * camShake * 1.6;
    }
    camera.lookAt(duck.position.x * 0.75, 46 + duck.position.y * 0.4, 340);

    sun.position.set(duck.position.x - 320, 620, -260);
    sun.target.position.set(duck.position.x, 0, 260);
    sun.target.updateMatrixWorld();
    rim.position.set(duck.position.x + 140, 300, 640);
    rim.target.position.set(duck.position.x, 30, 0);
    rim.target.updateMatrixWorld();

    renderer.render(scene, camera);
  }

  function resize(w, h) {
    if (!ready) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function isReady() { return ready; }

  return { init: init, render: render, resize: resize, setTheme: setTheme, isReady: isReady };
})();
