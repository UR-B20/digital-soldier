/* Realistic human figure: the rigged "Vanguard" soldier (Mixamo skeleton,
 * vendored from the three.js examples) driven by the same joint keys as the
 * stylized figure.
 *
 * How posing works: an invisible "virtual skeleton" of plain Groups mirrors
 * the stylized figure's pivot hierarchy, and poses are applied to it with
 * exactly the primitive's Euler conventions. At load time each Mixamo bone
 * is calibrated against its virtual pivot (C = V⁻¹·W at the neutral pose);
 * afterwards every bone's orientation is solved from its virtual pivot in
 * one top-down pass. Sliders, presets, keyframes and saved projects behave
 * identically on both figures.
 *
 * Marching uses the model's bundled motion-capture Walk/Run clips through an
 * AnimationMixer instead of the procedural gait.
 */
(function () {
  'use strict';

  const DEG = Math.PI / 180;
  const { JOINT_DEFS } = window.SoldierData;
  const JOINT_INDEX = {};
  for (const d of JOINT_DEFS) JOINT_INDEX[d.key] = d;

  // model faces -Z as authored; our convention is +Z
  const MODEL_YAW = Math.PI;
  const TARGET_HEIGHT = 1.80;
  const ARM_REST_ANGLE = 12 * DEG; // final hang: ~12° out from vertical
  const FINGER_CURL = 0.55;        // relaxed drill hand

  // virtual pivot → Mixamo bone (canonical name, mixamorig prefix stripped —
  // GLTFLoader sanitizes node names, so 'mixamorig:LeftArm' may load as
  // 'mixamorigLeftArm')
  const BONE_MAP = {
    torso: 'Spine1',
    head: 'Head',
    shoulderL: 'LeftArm',
    elbowL: 'LeftForeArm',
    wristL: 'LeftHand',
    shoulderR: 'RightArm',
    elbowR: 'RightForeArm',
    wristR: 'RightHand',
    hipL: 'LeftUpLeg',
    kneeL: 'LeftLeg',
    ankleL: 'LeftFoot',
    hipR: 'RightUpLeg',
    kneeR: 'RightLeg',
    ankleR: 'RightFoot',
  };

  const canonicalBoneName = (name) => name.replace(/^mixamorig:?/i, '');

  /* Build the virtual skeleton (orientations only; positions irrelevant). */
  function buildVirtualSkeleton() {
    const nodes = {};
    const mk = (name, parent) => {
      const g = new THREE.Group();
      g.name = 'v-' + name;
      if (parent) parent.add(g);
      nodes[name] = g;
      return g;
    };
    const root = mk('vroot', null);
    const pelvis = mk('pelvis', root);
    const torso = mk('torso', pelvis);
    const neck = mk('neck', torso);
    mk('head', neck);
    for (const s of ['L', 'R']) {
      const sh = mk('shoulder' + s, torso);
      const el = mk('elbow' + s, sh);
      mk('wrist' + s, el);
      const hip = mk('hip' + s, pelvis);
      const knee = mk('knee' + s, hip);
      mk('ankle' + s, knee);
    }
    return { root, nodes };
  }

  class HumanSoldier {
    /** @param {THREE.Object3D} modelScene loaded glTF scene
     *  @param {THREE.AnimationClip[]} clips */
    constructor(modelScene, clips) {
      this.root = new THREE.Group();
      this.root.name = 'human-soldier';
      this.pose = {};
      this.appearance = Object.assign({}, window.SoldierData.DEFAULT_APPEARANCE, { tint: '#ffffff' });
      this.onPoseApplied = null;
      this._lifeOffsets = null;
      this._clipMode = null;

      // holder applies facing + scale + ground alignment
      this.holder = new THREE.Group();
      this.holder.rotation.y = MODEL_YAW;
      this.root.add(this.holder);
      this.model = modelScene;
      this.holder.add(modelScene);

      const box = new THREE.Box3().setFromObject(this.root);
      const height = box.max.y - box.min.y;
      const s = TARGET_HEIGHT / height;
      this.holder.scale.setScalar(s);
      const box2 = new THREE.Box3().setFromObject(this.root);
      this.holder.position.y = -box2.min.y;

      this.bones = {};
      this.bodyMaterials = [];
      this.model.traverse((o) => {
        if (o.isBone) this.bones[canonicalBoneName(o.name)] = o;
        if (o.isMesh || o.isSkinnedMesh) {
          o.castShadow = true;
          o.frustumCulled = false;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) if (m && !this.bodyMaterials.includes(m)) this.bodyMaterials.push(m);
        }
      });

      const v = buildVirtualSkeleton();
      this.vroot = v.root;
      this.vnodes = v.nodes;

      this._applyNeutralPose();
      this._calibrate();

      // motion-capture clips
      this.mixer = new THREE.AnimationMixer(this.model);
      this.actions = {};
      for (const clip of clips) {
        this.actions[clip.name] = this.mixer.clipAction(clip);
      }
      // natural cadence: one clip cycle = 2 steps
      this._naturalSPM = {
        quick: this.actions.Walk ? 120 / this.actions.Walk.getClip().duration : 116,
        double: this.actions.Run ? 120 / this.actions.Run.getClip().duration : 180,
      };

      for (const d of JOINT_DEFS) this.pose[d.key] = 0;
      this._solve();
    }

    /* Neutral pose: bring the bind-pose arms down to the sides, relax the
     * fingers. The drop angle is measured from the model's actual bind pose
     * (T-pose, A-pose, …) so any Mixamo-rigged character calibrates. */
    _applyNeutralPose() {
      const q = new THREE.Quaternion();
      const rotateBoneWorld = (boneName, worldQ) => {
        const bone = this.bones[boneName];
        if (!bone) return;
        bone.updateWorldMatrix(true, false);
        const pw = new THREE.Quaternion();
        bone.parent.getWorldQuaternion(pw);
        // newLocal = Pw⁻¹ · R · Pw · oldLocal
        const pwInv = pw.clone().invert();
        bone.quaternion.premultiply(pw).premultiply(worldQ).premultiply(pwInv);
      };
      // measure how far each arm currently hangs from vertical
      const armDrop = (side) => {
        const a = this.bones[side + 'Arm'], f = this.bones[side + 'ForeArm'];
        if (!a || !f) return 0;
        this.model.updateWorldMatrix(true, true);
        const pa = a.getWorldPosition(new THREE.Vector3());
        const pf = f.getWorldPosition(new THREE.Vector3());
        const dir = pf.sub(pa).normalize();
        const fromVertical = Math.acos(THREE.MathUtils.clamp(-dir.y, -1, 1));
        return Math.max(0, fromVertical - ARM_REST_ANGLE);
      };
      rotateBoneWorld('LeftArm', q.clone().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -armDrop('Left')));
      rotateBoneWorld('RightArm', q.clone().setFromAxisAngle(new THREE.Vector3(0, 0, 1), armDrop('Right')));

      // relaxed finger curl (local-axis rotation per segment)
      for (const side of ['Left', 'Right']) {
        for (const finger of ['Index', 'Middle', 'Ring', 'Pinky']) {
          for (let seg = 1; seg <= 3; seg++) {
            const b = this.bones[side + 'Hand' + finger + String(seg)];
            if (b) b.rotateZ(side === 'Left' ? FINGER_CURL : -FINGER_CURL);
          }
        }
        const t2 = this.bones[side + 'HandThumb2'];
        if (t2) t2.rotateZ(side === 'Left' ? 0.25 : -0.25);
      }
      this.model.updateWorldMatrix(true, true);
    }

    /* C = V⁻¹·W at neutral. Virtual is identity at neutral, so C = W.
     * The walk starts at the yaw holder so calibration and solve both live
     * in the app's world frame (character facing +Z). */
    _calibrate() {
      this.calib = [];
      const wq = new Map();
      const walk = (node, parentQ) => {
        const q = parentQ.clone().multiply(node.quaternion);
        wq.set(node, q);
        for (const c of node.children) walk(c, q);
      };
      walk(this.holder, new THREE.Quaternion());
      for (const vname of Object.keys(BONE_MAP)) {
        const bone = this.bones[BONE_MAP[vname]];
        if (!bone) continue;
        this.calib.push({
          vnode: this.vnodes[vname],
          bone,
          C: wq.get(bone).clone(),
        });
      }
      this.calibByBone = new Map(this.calib.map((c) => [c.bone, c]));
    }

    /* ---------- pose application ---------- */

    _applyVirtualJoint(def, value) {
      const node = this.vnodes[def.node];
      if (!node || def.kind === 'pos') return;
      node.rotation[def.axis] = value * def.sign * DEG;
    }

    /** Solve all mapped bones from the virtual skeleton in one pass. */
    _solve(overlay) {
      if (this._clipMode) return; // mocap clip owns the skeleton

      // 1. pose the virtual skeleton (pose + overlay + life offsets)
      const val = (key) => {
        let x = overlay && overlay[key] != null ? overlay[key] : (this.pose[key] || 0);
        if (this._lifeOffsets && this._lifeOffsets[key]) x += this._lifeOffsets[key];
        return x;
      };
      for (const d of JOINT_DEFS) {
        if (d.kind === 'pos' || d.node === 'root') continue;
        this._applyVirtualJoint(d, val(d.key));
      }
      // 2. virtual world orientations
      const vq = new Map();
      const vwalk = (node, parentQ) => {
        const q = parentQ.clone().multiply(node.quaternion);
        vq.set(node, q);
        for (const c of node.children) vwalk(c, q);
      };
      vwalk(this.vroot, new THREE.Quaternion());
      // 3. re-orient bones top-down: bone.local = Pw⁻¹ · (V·C)
      // (same app-frame walk as calibration, starting at the yaw holder)
      const walk = (node, parentQ) => {
        const c = this.calibByBone.get(node);
        if (c) {
          const target = vq.get(c.vnode).clone().multiply(c.C);
          node.quaternion.copy(parentQ.clone().invert().multiply(target));
        }
        const q = parentQ.clone().multiply(node.quaternion);
        for (const ch of node.children) walk(ch, q);
      };
      walk(this.holder, new THREE.Quaternion());

      // root position / facing on the wrapper
      const p = (k) => (overlay && overlay[k] != null ? overlay[k] : (this.pose[k] || 0));
      this.root.position.set(p('root.posX'), p('root.lift'), p('root.posZ'));
      this.root.rotation.y = p('root.turn') * DEG;
    }

    applyPose(pose, partial) {
      if (!partial) {
        for (const d of JOINT_DEFS) this.pose[d.key] = pose[d.key] != null ? pose[d.key] : 0;
      } else {
        for (const key of Object.keys(pose)) if (JOINT_INDEX[key]) this.pose[key] = pose[key];
      }
      this._solve();
      if (this.onPoseApplied) this.onPoseApplied();
    }

    setJoint(key, value) {
      if (!JOINT_INDEX[key]) return;
      this.pose[key] = value;
      this._solve();
    }

    applyOverlay(values) {
      this._solve(values);
    }

    getPose() {
      return Object.assign({}, this.pose);
    }

    mirrorPose(mode) {
      const p = this.getPose();
      for (const d of JOINT_DEFS) {
        if (!d.key.includes('R.')) continue;
        const lKey = d.key.replace('R.', 'L.');
        if (p[lKey] === undefined) continue;
        if (mode === 'R2L') p[lKey] = p[d.key];
        else if (mode === 'L2R') p[d.key] = p[lKey];
        else { const t = p[d.key]; p[d.key] = p[lKey]; p[lKey] = t; }
      }
      if (mode === 'swap') {
        for (const key of ['torso.twist', 'torso.lean', 'head.turn', 'head.tilt', 'root.turn', 'root.posX']) {
          p[key] = -p[key];
        }
      }
      this.applyPose(p);
    }

    /* ---------- life layer ---------- */
    applyLife(offsets) {
      // offsets: {'torso.bend': deg, ...} or null to clear
      this._lifeOffsets = offsets;
      this._solve();
    }

    /* ---------- mocap marching ---------- */
    setClipMarch(mode, tempo) {
      const want = mode === 'double' ? 'Run' : mode === 'quick' ? 'Walk' : null;
      const action = want && this.actions[want];
      if (this._clipAction && this._clipAction !== action) {
        this._clipAction.fadeOut(0.3);
        this._clipAction = null;
      }
      this._clipMode = mode || null;
      if (action) {
        action.reset().setEffectiveWeight(1).fadeIn(0.3).play();
        this._clipAction = action;
        this.setClipTempo(tempo || 116);
      } else if (!mode) {
        this.mixer.stopAllAction();
        this._clipAction = null;
        this._solve(); // back to the slider pose
      }
    }

    setClipTempo(tempo) {
      if (!this._clipAction || !this._clipMode) return;
      const nat = this._naturalSPM[this._clipMode] || 116;
      this._clipAction.setEffectiveTimeScale(tempo / nat);
    }

    update(dt) {
      if (this._clipMode) this.mixer.update(dt);
    }

    /* ---------- appearance (limited on the scanned model) ---------- */
    setAppearance(patch) {
      const a = Object.assign(this.appearance, patch);
      const tint = a.tint || '#ffffff';
      for (const m of this.bodyMaterials) {
        m.color.set(tint);
      }
      this.root.scale.setScalar(a.height || 1);
      const b = a.build || 1;
      this.root.scale.x *= b;
      this.root.scale.z *= b;
      return a;
    }

    getAppearance() {
      return Object.assign({}, this.appearance);
    }
  }

  /** Decode the vendored base64 GLB and build the figure. */
  function loadHumanSoldier(onReady, onError) {
    try {
      const b64 = window.SOLDIER_GLB_BASE64;
      if (!b64 || typeof THREE.GLTFLoader === 'undefined') {
        throw new Error('model or loader missing');
      }
      const bin = atob(b64);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      new THREE.GLTFLoader().parse(buf.buffer, '', (gltf) => {
        try {
          onReady(new HumanSoldier(gltf.scene, gltf.animations));
        } catch (e) {
          if (onError) onError(e);
        }
      }, (e) => { if (onError) onError(e); });
    } catch (e) {
      if (onError) onError(e);
    }
  }

  window.HumanSoldier = HumanSoldier;
  window.loadHumanSoldier = loadHumanSoldier;
})();
