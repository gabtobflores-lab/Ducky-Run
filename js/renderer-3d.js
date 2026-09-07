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
  var duck, duckParts, ground, laneStrips = [], sun, hemi;
  var pool = {}, live = [];
  var bossMesh = null, bossKey = '';
  var ready = false, theme = null;
  var camShake = 0;

  /* ---------- helpers ---------- */
  function C(hex) { return new THREE.Color(hex || '#ffffff'); }

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
  function buildDuck(look) {
    look = look || {};
    var bodyCol = look.body || '#ffd447';
    var beakCol = look.beak || '#ff8c1a';
    var g = new THREE.Group();
    var p = {};

    p.body = sphere(21, bodyCol, { rough: 0.6 });
    p.body.scale.set(1.05, 0.95, 1.35);
    p.body.position.y = 24;
    g.add(p.body);

    p.tail = cone(11, 18, bodyCol, { rough: 0.6 });
    p.tail.rotation.x = -Math.PI / 2.3;
    p.tail.position.set(0, 30, -26);
    g.add(p.tail);

    p.neck = cyl(7.5, 9, 20, bodyCol, { rough: 0.6 });
    p.neck.position.set(0, 42, 9);
    g.add(p.neck);

    p.head = sphere(13, bodyCol, { rough: 0.55 });
    p.head.position.set(0, 55, 13);
    g.add(p.head);

    p.beak = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 14), mat(beakCol, { rough: 0.5 }));
    p.beak.position.set(0, 53, 25);
    p.beak.castShadow = true;
    g.add(p.beak);

    var eyeGeo = new THREE.SphereGeometry(2.4, 8, 8);
    var eyeMat = mat('#12202c', { rough: 0.3 });
    p.eyeL = new THREE.Mesh(eyeGeo, eyeMat); p.eyeL.position.set(-6, 58, 21); g.add(p.eyeL);
    p.eyeR = new THREE.Mesh(eyeGeo, eyeMat); p.eyeR.position.set(6, 58, 21); g.add(p.eyeR);

    p.wingL = box(4, 15, 22, bodyCol, { rough: 0.65 });
    p.wingL.position.set(-20, 27, -2); g.add(p.wingL);
    p.wingR = box(4, 15, 22, bodyCol, { rough: 0.65 });
    p.wingR.position.set(20, 27, -2); g.add(p.wingR);

    p.legL = cyl(2.6, 2.6, 14, beakCol, { rough: 0.6 }, 8);
    p.legL.position.set(-7, 8, 0); g.add(p.legL);
    p.legR = cyl(2.6, 2.6, 14, beakCol, { rough: 0.6 }, 8);
    p.legR.position.set(7, 8, 0); g.add(p.legR);

    p.footL = box(8, 2.5, 13, beakCol, { rough: 0.6 });
    p.footL.position.set(-7, 1.5, 3); g.add(p.footL);
    p.footR = box(8, 2.5, 13, beakCol, { rough: 0.6 });
    p.footR.position.set(7, 1.5, 3); g.add(p.footR);

    p.aura = new THREE.Mesh(
      new THREE.SphereGeometry(40, 16, 12),
      new THREE.MeshBasicMaterial({ color: C('#41d6c3'), transparent: true, opacity: 0.3,
        side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    p.aura.position.y = 30; p.aura.visible = false;
    g.add(p.aura);

    duckParts = p;
    return g;
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

    sun = new THREE.DirectionalLight(0xffffff, 1.15);
    sun.position.set(-320, 620, -260);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 100;
    sun.shadow.camera.far = 1800;
    sun.shadow.camera.left = -420;
    sun.shadow.camera.right = 420;
    sun.shadow.camera.top = 420;
    sun.shadow.camera.bottom = -420;
    scene.add(sun);
    scene.add(sun.target);

    hemi = new THREE.HemisphereLight(0xffffff, 0x556677, 0.75);
    scene.add(hemi);

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
    scene.fog = new THREE.Fog(C(skyMid), FAR * 0.45, FAR);
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
    sun.intensity = 0.5 + bright * 0.8;
    hemi.intensity = 0.42 + bright * 0.5;
    hemi.color = C(skyTop);
    hemi.groundColor = C(th.deep || '#2f7a3a');
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

    /* --- scroll the path texture --- */
    var scroll = -(g.camX % GROUND_LEN) / 128;
    laneStrips.forEach(function (s) {
      if (s.material.map) s.material.map.offset.y = scroll;
    });

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
    var camTY = 128 + duck.position.y * 0.45;
    camera.position.x += (camTX - camera.position.x) * Math.min(1, dt * 6);
    camera.position.y += (camTY - camera.position.y) * Math.min(1, dt * 5);
    camera.position.z = -250;
    if (camShake > 0.2) {
      camera.position.x += (Math.random() - 0.5) * camShake * 1.6;
      camera.position.y += (Math.random() - 0.5) * camShake * 1.6;
    }
    camera.lookAt(duck.position.x * 0.75, 46 + duck.position.y * 0.4, 340);

    sun.position.set(duck.position.x - 320, 620, -260);
    sun.target.position.set(duck.position.x, 0, 260);
    sun.target.updateMatrixWorld();

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
