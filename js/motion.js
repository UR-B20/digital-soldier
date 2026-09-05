/* Living motion: an additive idle "life" layer (breathing, blinking,
 * micro-sway) and a procedural marching gait. Both drive the figure through
 * visual overlays each frame — the saved pose state, sliders and keyframes
 * are never polluted by them.
 */
(function () {
  'use strict';


  /* ------------------------------------------------------------------ *
   *  LifeLayer — breathing, blinks, micro-sway. Computes small offsets in
   *  slider units and hands them to the active figure's applyLife(), so it
   *  works on any figure (stylized pivots or the rigged human).
   * ------------------------------------------------------------------ */
  class LifeLayer {
    constructor(soldier) {
      this.soldier = soldier;
      this.enabled = true;
      this.gaitActive = () => false; // torso is ceded to the gait when marching
      this.t = Math.random() * 10;
      this._nextBlink = 1 + Math.random() * 3;
      this._blinkUntil = -1;
      this._dirty = false;
    }

    update(dt) {
      const s = this.soldier;
      if (!this.enabled) {
        if (this._dirty) {
          // keep the gait's torso values if a march is running
          s.applyLife(this.gaitActive() ? { offsets: {} } : null);
          this._dirty = false;
        }
        return;
      }
      this._dirty = true;
      this.t += dt;
      const t = this.t;

      // breathing ≈ 14 breaths/min
      const breath = Math.sin(t * (2 * Math.PI / 4.3));
      // slow wander built from incommensurate sines
      const w1 = Math.sin(t * 0.41) + Math.sin(t * 0.97 + 1.7);
      const w2 = Math.sin(t * 0.31 + 0.6) + Math.sin(t * 0.83);

      const offsets = {
        'head.turn': w1 * 0.65,
        'head.nod': -(w2 * 0.4 + breath * 0.25), // sign -1 on the slider
      };
      if (!this.gaitActive()) {
        offsets['torso.bend'] = breath * 0.55;
        offsets['torso.lean'] = w2 * 0.22;
      }

      if (this.t >= this._nextBlink) {
        this._blinkUntil = this.t + 0.14;
        this._nextBlink = this.t + 2 + Math.random() * 4;
      }

      s.applyLife({
        offsets,
        rise: breath * 0.0035,
        blink: this.t < this._blinkUntil,
      });
    }
  }

  /* ------------------------------------------------------------------ *
   *  GaitDriver — continuous quick/double march on the spot.
   * ------------------------------------------------------------------ */
  const GAIT_KEYS = [
    'legL.swing', 'legR.swing', 'legL.knee', 'legR.knee', 'legL.ankle', 'legR.ankle',
    'armL.swing', 'armR.swing', 'armL.elbow', 'armR.elbow',
    'torso.bend', 'torso.twist', 'root.lift',
  ];

  class GaitDriver {
    constructor(soldier) {
      this.soldier = soldier;
      this.mode = null;         // null | 'quick' | 'double'
      this.tempo = 116;         // steps per minute
      this.phase = 0;
      this.weight = 0;          // blend-in from the standing pose
      this.onModeChange = null;
      this._last = null;
      this._blendFrom = null;
    }

    get active() { return !!this.mode; }

    start(mode) {
      if (this.mode === mode) return;
      this.tempo = mode === 'double' ? 180 : 116;
      // figures with motion-capture clips (the rigged human) march via clips
      if (this.soldier.setClipMarch) {
        this.mode = mode;
        this.soldier.setClipMarch(mode, this.tempo);
        if (this.onModeChange) this.onModeChange(this.mode, this.tempo);
        return;
      }
      if (this.mode) {
        // switching mid-march: crossfade from the current stride so the
        // amplitude change doesn't snap in a single frame
        this._blendFrom = Object.assign({}, this._last);
        this.weight = 0;
      } else {
        this._blendFrom = null;
        this.weight = 0;
        this.phase = 0;
      }
      this.mode = mode;
      if (this.onModeChange) this.onModeChange(this.mode, this.tempo);
    }

    /** Halt: bake the current stride into the pose so nothing snaps —
     *  except root.lift, which is grounded so the soldier doesn't hover. */
    stop() {
      if (!this.mode) return;
      if (this.soldier.setClipMarch) {
        this.soldier.setClipMarch(null);
        this.mode = null;
        this.weight = 0;
        this._last = null;
        this._blendFrom = null;
        if (this.onModeChange) this.onModeChange(null, this.tempo);
        return;
      }
      if (this._last) {
        const baked = Object.assign({}, this._last);
        baked['root.lift'] = 0;
        this.soldier.applyPose(baked, true);
      }
      this.mode = null;
      this.weight = 0;
      this._last = null;
      this._blendFrom = null;
      if (this.onModeChange) this.onModeChange(null, this.tempo);
    }

    update(dt) {
      if (!this.mode) return;
      if (this.soldier.setClipMarch) {
        this.soldier.setClipTempo(this.tempo); // live tempo slider
        return;
      }
      this.weight = Math.min(1, this.weight + dt / 0.35);
      this.phase += dt * Math.PI * (this.tempo / 60); // π per step
      const p = this.phase;
      const dbl = this.mode === 'double';

      // drill-style: arms swing straight, breast-pocket high
      const hipA = dbl ? 34 : 26;
      const kneeA = dbl ? 78 : 42;
      const armA = dbl ? 26 : 54;

      const legL = Math.sin(p), legR = Math.sin(p + Math.PI);
      const J = {};
      J['legL.swing'] = hipA * legL + (dbl ? 6 : 0);
      J['legR.swing'] = hipA * legR + (dbl ? 6 : 0);
      // knee bends while its leg swings forward, straight when planted
      J['legL.knee'] = kneeA * Math.max(0, Math.sin(p - 0.55));
      J['legR.knee'] = kneeA * Math.max(0, Math.sin(p + Math.PI - 0.55));
      // toe points down as the leg passes behind
      J['legL.ankle'] = 13 * Math.max(0, -Math.sin(p - 0.3)) - 4 * Math.max(0, legL);
      J['legR.ankle'] = 13 * Math.max(0, -Math.sin(p + Math.PI - 0.3)) - 4 * Math.max(0, legR);
      // arms swing opposite their own leg
      if (dbl) {
        J['armL.swing'] = 18 + armA * legR;
        J['armR.swing'] = 18 + armA * legL;
        J['armL.elbow'] = 92;
        J['armR.elbow'] = 92;
      } else {
        J['armL.swing'] = armA * legR;
        J['armR.swing'] = armA * legL;
        J['armL.elbow'] = 5;
        J['armR.elbow'] = 5;
      }
      J['torso.bend'] = dbl ? 6 : 2;
      J['torso.twist'] = (dbl ? 2.5 : 3.5) * legR;
      // body rises as the legs pass each other (double bounce per cycle)
      J['root.lift'] = (dbl ? 0.035 : 0.016) * (0.5 - 0.5 * Math.cos(2 * p));

      // blend into the cycle — from the previous stride on a mode switch,
      // from the underlying pose when starting fresh
      const w = this.weight;
      const pose = this.soldier.pose;
      const from = this._blendFrom;
      for (const key of GAIT_KEYS) {
        const src = from && from[key] != null ? from[key] : (pose[key] || 0);
        J[key] = src * (1 - w) + J[key] * w;
      }
      if (w >= 1) this._blendFrom = null;
      this._last = J;
      this.soldier.applyOverlay(J);
    }
  }

  window.SoldierMotion = { LifeLayer, GaitDriver, GAIT_KEYS };
})();
