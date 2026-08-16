/* Digital Soldier — articulated figure + appearance system.
 * Exposes window.Soldier. Joint angles are set in degrees through a flat
 * pose map (e.g. {'armR.swing': 90}) so poses are easy to store and tween.
 */
(function () {
  'use strict';

  const DEG = Math.PI / 180;

  /* ------------------------------------------------------------------ *
   *  Joint registry
   *  sign: maps the human-friendly slider direction onto the raw Euler
   *  angle so that positive slider values mean forward / out / up / left.
   * ------------------------------------------------------------------ */
  const JOINT_DEFS = [
    // Body position (root)
    { key: 'root.posX',  group: 'Body position', label: 'Slide left/right', kind: 'pos', node: 'root', axis: 'x', sign: 1,  min: -3,   max: 3,  step: 0.01 },
    { key: 'root.posZ',  group: 'Body position', label: 'Slide fwd/back',   kind: 'pos', node: 'root', axis: 'z', sign: 1,  min: -3,   max: 3,  step: 0.01 },
    { key: 'root.lift',  group: 'Body position', label: 'Lift (jump)',      kind: 'pos', node: 'root', axis: 'y', sign: 1,  min: -0.6, max: 0.6, step: 0.01 },
    { key: 'root.turn',  group: 'Body position', label: 'Face direction',   node: 'root',  axis: 'y', sign: 1,  min: -180, max: 180 },

    // Torso
    { key: 'torso.bend',  group: 'Torso', label: 'Lean fwd/back', node: 'torso', axis: 'x', sign: 1, min: -30, max: 60 },
    { key: 'torso.twist', group: 'Torso', label: 'Twist',         node: 'torso', axis: 'y', sign: 1, min: -45, max: 45 },
    { key: 'torso.lean',  group: 'Torso', label: 'Tilt sideways', node: 'torso', axis: 'z', sign: 1, min: -30, max: 30 },

    // Head
    { key: 'head.nod',  group: 'Head', label: 'Nod (up +)',   node: 'head', axis: 'x', sign: -1, min: -40, max: 40 },
    { key: 'head.turn', group: 'Head', label: 'Turn (left +)', node: 'head', axis: 'y', sign: 1, min: -80, max: 80 },
    { key: 'head.tilt', group: 'Head', label: 'Tilt',          node: 'head', axis: 'z', sign: 1, min: -35, max: 35 },

    // Right arm  (character's right = -X)
    { key: 'armR.swing',  group: 'Right arm', label: 'Swing fwd (+)', node: 'shoulderR', axis: 'x', sign: -1, min: -60, max: 180 },
    { key: 'armR.raise',  group: 'Right arm', label: 'Raise out (+)', node: 'shoulderR', axis: 'z', sign: -1, min: -20, max: 180 },
    { key: 'armR.rotate', group: 'Right arm', label: 'Rotate arm',    node: 'shoulderR', axis: 'y', sign: -1, min: -90, max: 90 },
    { key: 'armR.elbow',  group: 'Right arm', label: 'Elbow bend',    node: 'elbowR',    axis: 'x', sign: -1, min: 0,   max: 150 },
    { key: 'armR.wrist',  group: 'Right arm', label: 'Wrist flex',    node: 'wristR',    axis: 'x', sign: -1, min: -80, max: 80 },
    { key: 'armR.twist',  group: 'Right arm', label: 'Wrist twist',   node: 'wristR',    axis: 'y', sign: -1, min: -90, max: 90 },

    // Left arm (character's left = +X)
    { key: 'armL.swing',  group: 'Left arm', label: 'Swing fwd (+)', node: 'shoulderL', axis: 'x', sign: -1, min: -60, max: 180 },
    { key: 'armL.raise',  group: 'Left arm', label: 'Raise out (+)', node: 'shoulderL', axis: 'z', sign: 1,  min: -20, max: 180 },
    { key: 'armL.rotate', group: 'Left arm', label: 'Rotate arm',    node: 'shoulderL', axis: 'y', sign: 1,  min: -90, max: 90 },
    { key: 'armL.elbow',  group: 'Left arm', label: 'Elbow bend',    node: 'elbowL',    axis: 'x', sign: -1, min: 0,   max: 150 },
    { key: 'armL.wrist',  group: 'Left arm', label: 'Wrist flex',    node: 'wristL',    axis: 'x', sign: -1, min: -80, max: 80 },
    { key: 'armL.twist',  group: 'Left arm', label: 'Wrist twist',   node: 'wristL',    axis: 'y', sign: 1,  min: -90, max: 90 },

    // Right leg
    { key: 'legR.swing',  group: 'Right leg', label: 'Swing fwd (+)',  node: 'hipR',   axis: 'x', sign: -1, min: -45, max: 110 },
    { key: 'legR.spread', group: 'Right leg', label: 'Spread out (+)', node: 'hipR',   axis: 'z', sign: -1, min: -15, max: 60 },
    { key: 'legR.turn',   group: 'Right leg', label: 'Toes out (+)',   node: 'hipR',   axis: 'y', sign: -1, min: -30, max: 60 },
    { key: 'legR.knee',   group: 'Right leg', label: 'Knee bend',      node: 'kneeR',  axis: 'x', sign: 1,  min: 0,   max: 150 },
    { key: 'legR.ankle',  group: 'Right leg', label: 'Point toes (+)', node: 'ankleR', axis: 'x', sign: 1,  min: -35, max: 45 },

    // Left leg
    { key: 'legL.swing',  group: 'Left leg', label: 'Swing fwd (+)',  node: 'hipL',   axis: 'x', sign: -1, min: -45, max: 110 },
    { key: 'legL.spread', group: 'Left leg', label: 'Spread out (+)', node: 'hipL',   axis: 'z', sign: 1,  min: -15, max: 60 },
    { key: 'legL.turn',   group: 'Left leg', label: 'Toes out (+)',   node: 'hipL',   axis: 'y', sign: 1,  min: -30, max: 60 },
    { key: 'legL.knee',   group: 'Left leg', label: 'Knee bend',      node: 'kneeL',  axis: 'x', sign: 1,  min: 0,   max: 150 },
    { key: 'legL.ankle',  group: 'Left leg', label: 'Point toes (+)', node: 'ankleL', axis: 'x', sign: 1,  min: -35, max: 45 },
  ];

  /* ------------------------------------------------------------------ *
   *  Skin tones & camo palettes
   * ------------------------------------------------------------------ */
  const SKIN_TONES = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21', '#ffdbac'];

  const CAMO_PALETTES = {
    woodland: { base: '#4a5d3a', blobs: ['#2f4f2f', '#6b6b47', '#3d2b1f', '#22331f'] },
    desert:   { base: '#c2b280', blobs: ['#a89a6b', '#8b7d5a', '#d6c9a3', '#b5a478'] },
    digital:  { base: '#7d8471', blobs: ['#5a6351', '#9aa08c', '#3f4639', '#6b7261'] },
    jungle:   { base: '#3f5a36', blobs: ['#2a3d24', '#5d7a4a', '#1f2d1b', '#77885a'] },
  };

  const UNIFORM_PRESETS = {
    'Olive drab':      { pattern: 'solid', jacket: '#55613f', trousers: '#4d5939', hat: '#3c4a2e', boots: '#241f1a', belt: '#2e2a24', gloves: 'skin',  headgear: 'beret' },
    'Woodland camo':   { pattern: 'woodland', jacket: '#ffffff', trousers: '#ffffff', hat: '#4a5d3a', boots: '#241f1a', belt: '#3d3a30', gloves: 'skin',  headgear: 'helmet', hatCamo: true },
    'Desert camo':     { pattern: 'desert', jacket: '#ffffff', trousers: '#ffffff', hat: '#c2b280', boots: '#8b7355', belt: '#a89a6b', gloves: 'skin',  headgear: 'helmet', hatCamo: true },
    'Digital camo':    { pattern: 'digital', jacket: '#ffffff', trousers: '#ffffff', hat: '#7d8471', boots: '#241f1a', belt: '#4a4f43', gloves: 'skin',  headgear: 'patrol', hatCamo: true },
    'Jungle camo':     { pattern: 'jungle', jacket: '#ffffff', trousers: '#ffffff', hat: '#3f5a36', boots: '#241f1a', belt: '#2a3d24', gloves: 'skin',  headgear: 'patrol', hatCamo: true },
    'Ceremonial white':{ pattern: 'solid', jacket: '#f4f2ec', trousers: '#1a1c22', hat: '#f4f2ec', boots: '#0d0d0f', belt: '#dcd8cf', gloves: 'white', headgear: 'peaked' },
    'Ceremonial red':  { pattern: 'solid', jacket: '#8e1b1b', trousers: '#1a1c22', hat: '#101216', boots: '#0d0d0f', belt: '#f0ead8', gloves: 'white', headgear: 'peaked' },
    'Navy blues':      { pattern: 'solid', jacket: '#22304a', trousers: '#1b2538', hat: '#f4f2ec', boots: '#0d0d0f', belt: '#101216', gloves: 'white', headgear: 'peaked' },
  };

  const HEADGEAR_TYPES = ['none', 'beret', 'peaked', 'helmet', 'patrol'];

  const DEFAULT_APPEARANCE = {
    pattern: 'solid',          // solid | woodland | desert | digital | jungle
    jacket: '#55613f',
    trousers: '#4d5939',
    hat: '#3c4a2e',
    hatCamo: false,
    boots: '#241f1a',
    belt: '#2e2a24',
    gloves: 'skin',            // skin | white | black
    skin: '#c68642',
    hair: '#2b2118',
    headgear: 'beret',
    height: 1.0,               // 0.9 .. 1.1  (root scale)
    build: 1.0,                // 0.85 .. 1.15 (limb girth)
  };

  /* ------------------------------------------------------------------ *
   *  Camo texture generation (procedural, offscreen canvas)
   * ------------------------------------------------------------------ */
  const camoCache = {};
  function makeCamoTexture(name) {
    if (camoCache[name]) return camoCache[name];
    const p = CAMO_PALETTES[name];
    if (!p) return null;
    const size = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = p.base;
    ctx.fillRect(0, 0, size, size);
    // Seeded PRNG so the pattern is stable between page loads.
    let seed = 1234567;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const digital = name === 'digital';
    const blobCount = digital ? 500 : 90;
    for (let i = 0; i < blobCount; i++) {
      const color = p.blobs[Math.floor(rnd() * p.blobs.length)];
      ctx.fillStyle = color;
      const x = rnd() * size, y = rnd() * size;
      if (digital) {
        const s = 4 + rnd() * 14;
        ctx.fillRect(x, y, s, s * (0.5 + rnd()));
      } else {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rnd() * Math.PI);
        ctx.beginPath();
        ctx.ellipse(0, 0, 8 + rnd() * 26, 5 + rnd() * 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.encoding = THREE.sRGBEncoding;
    camoCache[name] = tex;
    return tex;
  }

  /* ------------------------------------------------------------------ *
   *  Soldier class
   * ------------------------------------------------------------------ */
  class Soldier {
    constructor() {
      this.root = new THREE.Group();
      this.root.name = 'soldier';
      this.nodes = {};          // pivot groups by name
      this.pose = {};           // current pose, degrees / meters
      this.appearance = Object.assign({}, DEFAULT_APPEARANCE);
      this.bulkMeshes = [];     // meshes whose x/z scale follows "build"
      this.onPoseApplied = null;

      this._makeMaterials();
      this._build();
      this.resetPose();
      this.setAppearance(this.appearance);
    }

    _makeMaterials() {
      const std = (color, rough, metal) =>
        new THREE.MeshStandardMaterial({ color, roughness: rough != null ? rough : 0.85, metalness: metal || 0 });
      this.mats = {
        jacket:   std('#55613f'),
        trousers: std('#4d5939'),
        skin:     std('#c68642', 0.6),
        hands:    std('#c68642', 0.6),
        hair:     std('#2b2118', 0.9),
        hat:      std('#3c4a2e'),
        boots:    std('#241f1a', 0.45),
        belt:     std('#2e2a24', 0.5),
        metal:    std('#b8a44a', 0.35, 0.7),
        dark:     std('#1a1a1a', 0.6),
      };
    }

    /* ---- geometry helpers ---- */
    _capsule(r, pivotLen, mat, bulky) {
      // Capsule spanning from ~r/2 above the pivot to ~r/2 past the child
      // pivot so joints stay filled when bent.
      const geo = new THREE.CapsuleGeometry(r, Math.max(0.01, pivotLen - r * 0.6), 6, 14);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = -pivotLen / 2;
      mesh.castShadow = true;
      if (bulky !== false) this.bulkMeshes.push(mesh);
      return mesh;
    }
    _box(w, h, d, mat, bulky) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.castShadow = true;
      if (bulky) this.bulkMeshes.push(mesh);
      return mesh;
    }
    _pivot(name, parent, x, y, z) {
      const g = new THREE.Group();
      g.name = name;
      g.position.set(x, y, z);
      parent.add(g);
      this.nodes[name] = g;
      return g;
    }

    _build() {
      const N = this.nodes;
      N.root = this.root;

      // -- proportions (metres) --
      const HIP_Y = 0.93, HIP_X = 0.105;
      const THIGH = 0.44, SHIN = 0.40, ANKLE_H = 0.09;
      const WAIST_Y = 1.06;
      const TORSO_H = 0.50;
      const SHOULDER_Y = WAIST_Y + 0.43, SHOULDER_X = 0.235;
      const NECK_Y = WAIST_Y + 0.50;
      const UPPER_ARM = 0.30, FOREARM = 0.27;

      const pelvis = this._pivot('pelvis', this.root, 0, HIP_Y, 0);

      // Pelvis block (trousers)
      const pelvisMesh = this._box(0.325, 0.20, 0.225, this.mats.trousers, true);
      pelvisMesh.position.y = 0.075;
      pelvis.add(pelvisMesh);

      // ---- Torso ----
      const torso = this._pivot('torso', pelvis, 0, WAIST_Y - HIP_Y, 0);
      const jacket = this._box(0.36, TORSO_H, 0.24, this.mats.jacket, true);
      jacket.position.y = TORSO_H / 2 - 0.03;
      torso.add(jacket);
      // slight shoulder taper block on top
      const yoke = this._box(0.40, 0.09, 0.235, this.mats.jacket, true);
      yoke.position.y = TORSO_H - 0.055;
      torso.add(yoke);
      // belt + buckle
      const belt = this._box(0.375, 0.055, 0.255, this.mats.belt);
      belt.position.y = -0.005;
      torso.add(belt);
      const buckle = this._box(0.06, 0.04, 0.012, this.mats.metal);
      buckle.position.set(0, -0.005, 0.13);
      torso.add(buckle);
      // chest pockets + buttons
      for (const sx of [-1, 1]) {
        const pocket = this._box(0.085, 0.095, 0.015, this.mats.jacket);
        pocket.position.set(sx * 0.093, 0.27, 0.124);
        torso.add(pocket);
      }
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.01, 10), this.mats.metal);
        b.rotation.x = Math.PI / 2;
        b.position.set(0, 0.075 + i * 0.095, 0.125);
        torso.add(b);
      }

      // ---- Neck & head ----
      const neckPivot = this._pivot('neck', torso, 0, NECK_Y - WAIST_Y, 0);
      const neck = this._box(0.09, 0.09, 0.09, this.mats.skin);
      neck.position.y = 0.02;
      neckPivot.add(neck);

      const head = this._pivot('head', neckPivot, 0, 0.055, 0);
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 24, 18), this.mats.skin);
      skull.scale.set(0.92, 1.12, 0.98);
      skull.position.y = 0.115;
      skull.castShadow = true;
      head.add(skull);
      // ears
      for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), this.mats.skin);
        ear.scale.set(0.5, 1, 0.8);
        ear.position.set(sx * 0.105, 0.11, -0.005);
        head.add(ear);
      }
      // eyes
      for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0135, 10, 8), this.mats.dark);
        eye.position.set(sx * 0.042, 0.135, 0.098);
        head.add(eye);
      }
      // nose
      const nose = this._box(0.028, 0.04, 0.028, this.mats.skin);
      nose.position.set(0, 0.1, 0.108);
      head.add(nose);
      // simple mouth line
      const mouth = this._box(0.05, 0.008, 0.01, this.mats.dark);
      mouth.position.set(0, 0.055, 0.1);
      head.add(mouth);
      // hair cap (visible when no headgear) — stays above the brow line
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.118, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.38), this.mats.hair);
      hair.scale.set(0.94, 1.0, 1.0);
      hair.position.set(0, 0.135, -0.012);
      hair.name = 'hair';
      head.add(hair);
      this.hairMesh = hair;

      this._buildHeadgear(head);

      // ---- Arms ----
      for (const side of ['R', 'L']) {
        const sx = side === 'R' ? -1 : 1;
        const shoulder = this._pivot('shoulder' + side, torso, sx * SHOULDER_X, SHOULDER_Y - WAIST_Y, 0);
        // epaulette / shoulder cap
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), this.mats.jacket);
        cap.scale.set(1, 0.8, 1);
        cap.castShadow = true;
        this.bulkMeshes.push(cap);
        shoulder.add(cap);

        shoulder.add(this._capsule(0.058, UPPER_ARM, this.mats.jacket));
        const elbow = this._pivot('elbow' + side, shoulder, 0, -UPPER_ARM, 0);
        elbow.add(this._capsule(0.05, FOREARM, this.mats.jacket));
        const wrist = this._pivot('wrist' + side, elbow, 0, -FOREARM, 0);
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), this.mats.hands);
        hand.scale.set(0.8, 1.25, 0.62);
        hand.position.y = -0.055;
        hand.castShadow = true;
        wrist.add(hand);
      }

      // ---- Legs ----
      for (const side of ['R', 'L']) {
        const sx = side === 'R' ? -1 : 1;
        const hip = this._pivot('hip' + side, pelvis, sx * HIP_X, 0, 0);
        hip.add(this._capsule(0.082, THIGH, this.mats.trousers));
        const knee = this._pivot('knee' + side, hip, 0, -THIGH, 0);
        knee.add(this._capsule(0.065, SHIN, this.mats.trousers));
        const ankle = this._pivot('ankle' + side, knee, 0, -SHIN, 0);
        // boot: shaft + foot + sole
        const shaft = this._box(0.105, 0.1, 0.12, this.mats.boots);
        shaft.position.set(0, -0.03, 0);
        ankle.add(shaft);
        const foot = this._box(0.1, 0.062, 0.24, this.mats.boots);
        foot.position.set(0, -ANKLE_H + 0.031 + 0.012, 0.05);
        ankle.add(foot);
        const sole = this._box(0.108, 0.024, 0.25, this.mats.dark);
        sole.position.set(0, -ANKLE_H + 0.012, 0.05);
        ankle.add(sole);
      }
    }

    _buildHeadgear(head) {
      this.headgearGroups = {};

      // Beret — flattened sphere pulled to the character's right, with band
      const beret = new THREE.Group();
      const beretTop = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 12), this.mats.hat);
      beretTop.scale.set(1, 0.42, 1.05);
      beretTop.position.set(-0.018, 0.21, -0.01);
      beretTop.rotation.z = -0.16;
      beretTop.castShadow = true;
      beret.add(beretTop);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.117, 0.121, 0.045, 20, 1, true), this.mats.dark);
      band.position.y = 0.175;
      beret.add(band);
      const flash = this._box(0.035, 0.035, 0.012, this.mats.metal);
      flash.position.set(0.045, 0.2, 0.098);
      beret.add(flash);
      this.headgearGroups.beret = beret;

      // Peaked cap
      const peaked = new THREE.Group();
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.112, 0.075, 20), this.mats.hat);
      crown.position.y = 0.215;
      crown.castShadow = true;
      peaked.add(crown);
      const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.128, 0.02, 20), this.mats.hat);
      capTop.position.y = 0.26;
      peaked.add(capTop);
      const capBand = new THREE.Mesh(new THREE.CylinderGeometry(0.114, 0.116, 0.03, 20), this.mats.dark);
      capBand.position.y = 0.185;
      peaked.add(capBand);
      const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.012, 20, 1, false, -Math.PI * 0.32, Math.PI * 0.64), this.mats.dark);
      visor.position.set(0, 0.175, 0.02);
      visor.rotation.x = 0.14;
      peaked.add(visor);
      const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 12), this.mats.metal);
      badge.rotation.x = Math.PI / 2;
      badge.position.set(0, 0.225, 0.122);
      peaked.add(badge);
      this.headgearGroups.peaked = peaked;

      // Helmet
      const helmet = new THREE.Group();
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.135, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), this.mats.hat);
      dome.scale.set(1, 0.95, 1.08);
      dome.position.y = 0.125;
      dome.castShadow = true;
      helmet.add(dome);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.012, 8, 24), this.mats.hat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.132;
      rim.scale.set(1, 1.08, 1);
      helmet.add(rim);
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 6, 20, Math.PI), this.mats.dark);
      strap.rotation.set(0, Math.PI / 2, Math.PI);
      strap.position.y = 0.1;
      helmet.add(strap);
      this.headgearGroups.helmet = helmet;

      // Patrol cap (flat-top field cap)
      const patrol = new THREE.Group();
      const pcrown = new THREE.Mesh(new THREE.CylinderGeometry(0.121, 0.114, 0.08, 20), this.mats.hat);
      pcrown.position.y = 0.205;
      pcrown.castShadow = true;
      patrol.add(pcrown);
      const pvisor = new THREE.Mesh(new THREE.CylinderGeometry(0.113, 0.113, 0.012, 20, 1, false, -Math.PI * 0.3, Math.PI * 0.6), this.mats.hat);
      pvisor.position.set(0, 0.17, 0.025);
      pvisor.rotation.x = 0.12;
      patrol.add(pvisor);
      this.headgearGroups.patrol = patrol;

      for (const key of Object.keys(this.headgearGroups)) {
        const g = this.headgearGroups[key];
        g.visible = false;
        g.name = 'headgear-' + key;
        head.add(g);
      }
    }

    /* ---------------- pose API ---------------- */
    resetPose() {
      const pose = {};
      for (const d of JOINT_DEFS) pose[d.key] = 0;
      this.applyPose(pose);
    }

    setJoint(key, value) {
      const def = JOINT_DEFS.find((d) => d.key === key);
      if (!def) return;
      this.pose[key] = value;
      this._applyJoint(def, value);
    }

    _applyJoint(def, value) {
      const node = this.nodes[def.node];
      if (!node) return;
      if (def.kind === 'pos') {
        node.position[def.axis] = value * def.sign;
      } else {
        node.rotation[def.axis] = value * def.sign * DEG;
      }
    }

    applyPose(pose, partial) {
      if (!partial) {
        for (const d of JOINT_DEFS) {
          const v = pose[d.key] != null ? pose[d.key] : 0;
          this.pose[d.key] = v;
          this._applyJoint(d, v);
        }
      } else {
        for (const key of Object.keys(pose)) this.setJoint(key, pose[key]);
      }
      if (this.onPoseApplied) this.onPoseApplied();
    }

    getPose() {
      return Object.assign({}, this.pose);
    }

    /* Mirror helpers: copy one side onto the other / swap */
    mirrorPose(mode) {
      const p = this.getPose();
      const pairs = [];
      for (const d of JOINT_DEFS) {
        if (d.key.includes('R.')) {
          const lKey = d.key.replace('R.', 'L.');
          if (p[lKey] !== undefined) pairs.push([d.key, lKey]);
        }
      }
      for (const [rKey, lKey] of pairs) {
        if (mode === 'R2L') p[lKey] = p[rKey];
        else if (mode === 'L2R') p[rKey] = p[lKey];
        else { const t = p[rKey]; p[rKey] = p[lKey]; p[lKey] = t; }
      }
      // Mirrored asymmetric torso/head axes flip sign on swap
      if (mode === 'swap') {
        for (const key of ['torso.twist', 'torso.lean', 'head.turn', 'head.tilt', 'root.turn', 'root.posX']) {
          p[key] = -p[key];
        }
      }
      this.applyPose(p);
    }

    /* ---------------- appearance API ---------------- */
    setAppearance(patch) {
      const a = Object.assign(this.appearance, patch);

      const applyPattern = (mat, solidColor) => {
        if (a.pattern !== 'solid' && CAMO_PALETTES[a.pattern]) {
          mat.map = makeCamoTexture(a.pattern);
          mat.color.set('#ffffff');
        } else {
          mat.map = null;
          mat.color.set(solidColor);
        }
        mat.needsUpdate = true;
      };
      applyPattern(this.mats.jacket, a.jacket);
      applyPattern(this.mats.trousers, a.trousers);

      if (a.hatCamo && a.pattern !== 'solid' && CAMO_PALETTES[a.pattern]) {
        this.mats.hat.map = makeCamoTexture(a.pattern);
        this.mats.hat.color.set('#ffffff');
      } else {
        this.mats.hat.map = null;
        this.mats.hat.color.set(a.hat);
      }
      this.mats.hat.needsUpdate = true;

      this.mats.boots.color.set(a.boots);
      this.mats.belt.color.set(a.belt);
      this.mats.skin.color.set(a.skin);
      this.mats.hair.color.set(a.hair);

      if (a.gloves === 'white') this.mats.hands.color.set('#f2f0e9');
      else if (a.gloves === 'black') this.mats.hands.color.set('#17181c');
      else this.mats.hands.color.set(a.skin);

      // headgear visibility
      for (const key of Object.keys(this.headgearGroups)) {
        this.headgearGroups[key].visible = key === a.headgear;
      }
      if (this.hairMesh) this.hairMesh.visible = a.headgear === 'none' || a.headgear === 'beret';

      // body scale
      this.root.scale.setScalar(a.height);
      for (const mesh of this.bulkMeshes) {
        if (!mesh.userData.baseScale) mesh.userData.baseScale = mesh.scale.clone();
        const b = mesh.userData.baseScale;
        mesh.scale.set(b.x * a.build, b.y, b.z * a.build);
      }
      return a;
    }

    getAppearance() {
      return Object.assign({}, this.appearance);
    }
  }

  window.Soldier = Soldier;
  window.SoldierData = { JOINT_DEFS, SKIN_TONES, CAMO_PALETTES, UNIFORM_PRESETS, HEADGEAR_TYPES, DEFAULT_APPEARANCE };
})();
