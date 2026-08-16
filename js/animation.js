/* Pose tweening + keyframe timeline.
 * PoseTweener: short smooth transitions (e.g. clicking a preset).
 * Timeline: ordered keyframes {name, pose, transition, hold} with playback,
 * looping, and a total duration used for auto-stopping video recordings.
 */
(function () {
  'use strict';

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function lerpPose(a, b, t) {
    const out = {};
    for (const key of Object.keys(b)) {
      const av = a[key] != null ? a[key] : 0;
      out[key] = av + (b[key] - av) * t;
    }
    // keys present in a but not b ease back to 0
    for (const key of Object.keys(a)) {
      if (!(key in out)) out[key] = a[key] * (1 - t);
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  class PoseTweener {
    constructor(soldier) {
      this.soldier = soldier;
      this.active = null;
    }
    /** Smoothly move from the current pose to `pose` over `dur` seconds. */
    to(pose, dur) {
      const full = Object.assign({}, this.soldier.getPose());
      const target = Object.assign({}, full);
      for (const k of Object.keys(target)) target[k] = pose[k] != null ? pose[k] : 0;
      for (const k of Object.keys(pose)) target[k] = pose[k];
      if (!dur) {
        this.active = null;
        this.soldier.applyPose(target);
        return;
      }
      this.active = { from: full, to: target, dur, t: 0 };
    }
    cancel() { this.active = null; }
    update(dt) {
      if (!this.active) return;
      const a = this.active;
      a.t += dt;
      const t = Math.min(1, a.t / a.dur);
      this.soldier.applyPose(lerpPose(a.from, a.to, easeInOutCubic(t)));
      if (t >= 1) this.active = null;
    }
  }

  /* ------------------------------------------------------------------ */
  class Timeline {
    constructor(soldier) {
      this.soldier = soldier;
      this.keyframes = [];       // {name, pose, transition, hold}
      this.playing = false;
      this.loop = false;
      this.onChange = null;      // list mutated
      this.onPlayState = null;   // started/stopped
      this.onFinished = null;    // one-shot playback completed
      this._state = null;
    }

    addKeyframe(pose, name) {
      this.keyframes.push({
        name: name || 'Pose ' + (this.keyframes.length + 1),
        pose: Object.assign({}, pose),
        transition: 0.8,
        hold: 0.6,
      });
      this._changed();
    }
    removeKeyframe(i) { this.keyframes.splice(i, 1); this._changed(); }
    moveKeyframe(i, dir) {
      const j = i + dir;
      if (j < 0 || j >= this.keyframes.length) return;
      const [kf] = this.keyframes.splice(i, 1);
      this.keyframes.splice(j, 0, kf);
      this._changed();
    }
    updateKeyframe(i, patch) { Object.assign(this.keyframes[i], patch); this._changed(); }
    clear() { this.keyframes = []; this.stop(); this._changed(); }
    _changed() { if (this.onChange) this.onChange(); }

    /** Total run time of one pass, in seconds. */
    duration() {
      let d = 0;
      for (const kf of this.keyframes) d += kf.transition + kf.hold;
      return d;
    }

    play(loop) {
      if (!this.keyframes.length) return false;
      this.loop = !!loop;
      this.playing = true;
      this._state = {
        idx: 0,
        phase: 'transition',
        t: 0,
        from: this.soldier.getPose(),
      };
      if (this.onPlayState) this.onPlayState(true);
      return true;
    }

    stop() {
      const was = this.playing;
      this.playing = false;
      this._state = null;
      if (was && this.onPlayState) this.onPlayState(false);
    }

    update(dt) {
      if (!this.playing || !this._state) return;
      const s = this._state;
      const kf = this.keyframes[s.idx];
      if (!kf) { this.stop(); return; }
      s.t += dt;

      if (s.phase === 'transition') {
        const dur = Math.max(0.001, kf.transition);
        const t = Math.min(1, s.t / dur);
        this.soldier.applyPose(lerpPose(s.from, kf.pose, easeInOutCubic(t)));
        if (t >= 1) { s.phase = 'hold'; s.t = 0; }
      } else { // hold
        if (s.t >= kf.hold) {
          s.idx += 1;
          s.t = 0;
          s.phase = 'transition';
          s.from = this.soldier.getPose();
          if (s.idx >= this.keyframes.length) {
            if (this.loop) {
              s.idx = 0;
            } else {
              this.stop();
              if (this.onFinished) this.onFinished();
            }
          }
        }
      }
    }

    serialize() {
      return this.keyframes.map((kf) => ({
        name: kf.name, pose: kf.pose, transition: kf.transition, hold: kf.hold,
      }));
    }
    load(arr) {
      if (!Array.isArray(arr)) return;
      this.keyframes = arr.map((kf, i) => ({
        name: String(kf.name || 'Pose ' + (i + 1)),
        pose: Object.assign({}, kf.pose),
        transition: Number(kf.transition) > 0 ? Number(kf.transition) : 0.8,
        hold: Number(kf.hold) >= 0 ? Number(kf.hold) : 0.6,
      }));
      this._changed();
    }
  }

  window.SoldierAnim = { PoseTweener, Timeline, lerpPose, easeInOutCubic };
})();
