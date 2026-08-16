/* Scene setup, render loop, and app wiring. */
(function () {
  'use strict';

  const viewport = document.getElementById('viewport');

  /* ---------------- renderer ---------------- */
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,                 // allows the transparent-background snapshot mode
    preserveDrawingBuffer: true, // reliable toDataURL snapshots
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  viewport.appendChild(renderer.domElement);

  /* ---------------- scene ---------------- */
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
  camera.position.set(2.3, 1.7, 2.6);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.92;
  controls.minDistance = 0.8;
  controls.maxDistance = 12;
  controls.autoRotateSpeed = 2.2;
  controls.update();

  // Lights
  const hemi = new THREE.HemisphereLight(0xdfeaf5, 0x8a8f7a, 0.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3e0, 1.35);
  sun.position.set(3.5, 6, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  // Frustum covers the full ±3 m body-slide range plus body height.
  sun.shadow.camera.left = -7; sun.shadow.camera.right = 7;
  sun.shadow.camera.top = 7; sun.shadow.camera.bottom = -7;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 20;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.35);
  fill.position.set(-3, 2.5, -2.5);
  scene.add(fill);
  // cool rim light from behind for silhouette separation
  const rim = new THREE.DirectionalLight(0xbcd4ff, 0.5);
  rim.position.set(-1.5, 3.2, -3.5);
  scene.add(rim);

  // Ground: parade-square look — concrete disc with painted lines
  const ground = new THREE.Group();
  {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#8f9296';
    ctx.fillRect(0, 0, 512, 512);
    // speckle
    for (let i = 0; i < 2600; i++) {
      const g = 120 + Math.floor(Math.random() * 50);
      ctx.fillStyle = 'rgba(' + g + ',' + g + ',' + (g + 4) + ',0.35)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    // painted grid lines
    ctx.strokeStyle = 'rgba(245,245,240,0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      const p = i * 128;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(512, p); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    tex.encoding = THREE.sRGBEncoding;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(7, 48), mat);
    disc.rotation.x = -Math.PI / 2;
    disc.receiveShadow = true;
    ground.add(disc);
  }
  scene.add(ground);

  // soft contact-shadow blob that follows the soldier
  let contactBlob;
  {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,0.42)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(cv);
    contactBlob = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 32),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    contactBlob.rotation.x = -Math.PI / 2;
    contactBlob.position.y = 0.004;
    ground.add(contactBlob);
  }

  /* ---------------- soldier ---------------- */
  const soldier = new window.Soldier();
  scene.add(soldier.root);

  /* ---------------- living motion ---------------- */
  const life = new window.SoldierMotion.LifeLayer(soldier);
  const gait = new window.SoldierMotion.GaitDriver(soldier);
  life.gaitActive = () => gait.active;

  /* ---------------- background modes ---------------- */
  const BG = {
    sky: 0xa7c4dc,
    studio: 0x1c1e24,
    white: 0xffffff,
    green: 0x00b140,
  };
  let backgroundMode = 'sky';
  function setBackground(mode) {
    backgroundMode = mode;
    if (mode === 'transparent') {
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
      setGround(false);
    } else if (mode === 'green' || mode === 'white') {
      scene.background = new THREE.Color(BG[mode]);
      setGround(false);
    } else {
      scene.background = new THREE.Color(BG[mode]);
      setGround(true);
    }
    scene.fog = mode === 'sky' ? new THREE.Fog(BG.sky, 14, 30) : null;
  }
  function setGround(visible) {
    ground.visible = visible;
    if (app.groundCheckbox) app.groundCheckbox.checked = visible;
  }

  /* ---------------- animation & capture ---------------- */
  const tweener = new window.SoldierAnim.PoseTweener(soldier);
  const timeline = new window.SoldierAnim.Timeline(soldier);

  function renderFrame() {
    renderer.render(scene, camera);
  }
  const capture = new window.SoldierCapture.Capture(renderer, renderFrame);

  /* ---------------- app object & UI ---------------- */
  const app = {
    scene, camera, renderer, controls,
    soldier, tweener, timeline, capture, life, gait,
    setBackground, setGround,
    get backgroundMode() { return backgroundMode; },
  };
  window.app = app;
  window.SoldierUI.build(app);
  setBackground('sky');

  /* ---------------- resize ---------------- */
  function onResize() {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
  }
  window.addEventListener('resize', onResize);
  onResize();

  // A hidden tab suspends rendering, so a running recording would fill with
  // frozen frames — stop and save it instead.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && capture.recording) capture.stopRecording();
  });

  /* ---------------- render loop ---------------- */
  const clock = new THREE.Clock();
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.1);
    tweener.update(dt);
    timeline.update(dt);
    gait.update(dt);
    life.update(dt);
    contactBlob.position.x = soldier.root.position.x;
    contactBlob.position.z = soldier.root.position.z;
    controls.update();
    renderFrame();
  }
  loop();
})();
