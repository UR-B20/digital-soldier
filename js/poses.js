/* Preset drill positions. Values are degrees on the joint keys defined in
 * soldier.js; unspecified joints are 0 (neutral standing).
 * Positive convention: forward / out / up / left.
 */
(function () {
  'use strict';

  const POSES = {
    'Attention': {
      // Heels together, feet at ~30° V, arms pinned to the sides, thumbs
      // to the front seam, chin up.
      'legR.turn': 14, 'legL.turn': 14,
      'armR.raise': -6, 'armL.raise': -6,
      'armR.elbow': 4, 'armL.elbow': 4,
      'head.nod': 2,
    },

    'Stand at ease': {
      // Feet shoulder-width apart, hands clasped behind the back.
      'legR.spread': 9, 'legL.spread': 9,
      'legR.turn': 8, 'legL.turn': 8,
      'armR.swing': -26, 'armL.swing': -26,
      'armR.raise': 6, 'armL.raise': 6,
      'armR.elbow': 62, 'armL.elbow': 62,
      'armR.rotate': -85, 'armL.rotate': -85,
    },

    'Stand easy': {
      // As stand-at-ease but relaxed: shoulders dropped, head free.
      'legR.spread': 10, 'legL.spread': 10,
      'legR.turn': 10, 'legL.turn': 10,
      'armR.swing': -20, 'armL.swing': -20,
      'armR.raise': 6, 'armL.raise': 6,
      'armR.elbow': 48, 'armL.elbow': 48,
      'armR.rotate': -75, 'armL.rotate': -75,
      'torso.bend': 3, 'head.nod': -3,
    },

    'Salute': {
      // Right-hand salute: upper arm out, forearm folded up to the brow.
      // With the arm abducted, 'swing' acts as a twist that tilts the
      // elbow-bend plane upward — that is what carries the hand to the brow.
      'legR.turn': 14, 'legL.turn': 14,
      'armL.raise': -6, 'armL.elbow': 4,
      'armR.raise': 90,
      'armR.swing': 50,
      'armR.rotate': -25,
      'armR.elbow': 145,
      'armR.wrist': -10,
      'head.nod': 2,
    },

    'Eyes right': {
      'legR.turn': 14, 'legL.turn': 14,
      'armR.raise': -6, 'armL.raise': -6,
      'armR.elbow': 4, 'armL.elbow': 4,
      'head.turn': -62,
    },

    'Eyes left': {
      'legR.turn': 14, 'legL.turn': 14,
      'armR.raise': -6, 'armL.raise': -6,
      'armR.elbow': 4, 'armL.elbow': 4,
      'head.turn': 62,
    },

    'Quick march': {
      // Left foot forward, right arm swung forward shoulder-high,
      // arms straight, toes of the rear foot on the ground.
      'legL.swing': 28, 'legL.ankle': -12,
      'legR.swing': -22, 'legR.knee': 12, 'legR.ankle': 28,
      'armR.swing': 55, 'armL.swing': -35,
      'armR.elbow': 4, 'armL.elbow': 4,
      'torso.bend': 2,
    },

    'Double march': {
      // Running pace: knees up, arms bent at 90° driving.
      'legL.swing': 55, 'legL.knee': 65, 'legL.ankle': 15,
      'legR.swing': -25, 'legR.knee': 40, 'legR.ankle': 30,
      'armR.swing': 45, 'armR.elbow': 95,
      'armL.swing': -30, 'armL.elbow': 95,
      'torso.bend': 6,
      'root.lift': 0.04,
    },

    'Mark time': {
      // Marching on the spot: left knee raised, thigh parallel.
      'legL.swing': 70, 'legL.knee': 80, 'legL.ankle': 20,
      'armR.raise': -6, 'armL.raise': -6,
      'armR.elbow': 4, 'armL.elbow': 4,
    },

    'Present (hands)': {
      // Both arms extended forward, palms up (weaponless present).
      'armR.swing': 70, 'armL.swing': 70,
      'armR.elbow': 15, 'armL.elbow': 15,
      'armR.twist': -80, 'armL.twist': -80,
      'legR.turn': 14, 'legL.turn': 14,
    },

    'Kneel': {
      'legL.swing': 85, 'legL.knee': 95, 'legL.ankle': -10,
      'legR.swing': -12, 'legR.knee': 118, 'legR.ankle': 40,
      'root.lift': -0.42,
      'armR.raise': -4, 'armL.raise': -4,
      'torso.bend': 5,
    },

    'T-pose': {
      'armR.raise': 90, 'armL.raise': 90,
    },
  };

  window.SoldierPoses = POSES;
})();
