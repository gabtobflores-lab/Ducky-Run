const R3D = {};
(function() {
  let scene, camera, renderer, duck, lanes = [], obstacles = {};

  R3D.init = function(canvas) {
    if (!window.THREE) { console.error('THREE not loaded'); return false; }
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 1500, 2500);

    camera = new THREE.PerspectiveCamera(65, 960 / 540, 0.1, 4000);
    camera.position.set(0, 90, -150);
    
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(960, 540);
    renderer.shadowMap.enabled = true;

    // Lighting
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(500, 500, -300);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 6000),
      new THREE.MeshLambertMaterial({ color: 0x2d7a2d })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -10;
    ground.receiveShadow = true;
    scene.add(ground);

    // Lanes
    for (let i = 0; i < 3; i++) {
      const path = new THREE.Mesh(
        new THREE.PlaneGeometry(65, 6000),
        new THREE.MeshLambertMaterial({ color: 0x8b6f47 })
      );
      path.rotation.x = -Math.PI / 2;
      path.position.set((i - 1) * 90, 0, 0);
      path.receiveShadow = true;
      lanes.push(path);
      scene.add(path);
    }

    // Duck
    duck = makeDuck();
    duck.position.set(0, 30, 0);
    scene.add(duck);
    
    return true;
  };

  function makeDuck() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(22, 16, 16),
      new THREE.MeshPhongMaterial({ color: 0xffd700 })
    );
    body.scale.set(1.3, 1.1, 1);
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(14, 12, 12),
      new THREE.MeshPhongMaterial({ color: 0xffd700 })
    );
    head.position.set(0, 15, -20);
    head.castShadow = true;
    group.add(head);

    const beak = new THREE.Mesh(
      new THREE.ConeGeometry(6, 12, 8),
      new THREE.MeshPhongMaterial({ color: 0xff8c00 })
    );
    beak.rotation.z = Math.PI / 2;
    beak.position.set(0, 12, -28);
    group.add(beak);

    return group;
  }

  R3D.render = function(g) {
    if (!scene || !renderer || !camera) return;

    const targetX = (g.player.lane - 1) * 90;
    duck.position.x += (targetX - duck.position.x) * 0.15;
    duck.position.y = 30 + Math.max(0, g.player.py * 0.05);
    duck.position.z = g.camX * -0.4;

    camera.position.x += (duck.position.x - camera.position.x) * 0.12;
    camera.position.z += (duck.position.z - 160 - camera.position.z) * 0.12;
    camera.lookAt(duck.position.x, 50, duck.position.z + 120);

    lanes.forEach(lane => {
      lane.position.z = ((g.camX * -0.4) % 6000) - 3000;
    });

    renderer.render(scene, camera);
  };
})();
