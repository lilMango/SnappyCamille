import { box, cone, panel, GLOW } from './rigKit';
import { mulberry32 } from '../rng';

/**
 * The two kaiju, as data: joint hierarchies whose parts are merged per joint (see rigKit.js).
 * Authored ~7 units tall facing +z with y up; the components scale the root x10.
 *
 *   godzillaSpec()  MonsterVerse 2019 "atomic": heavy forward lean, small head on a thick neck,
 *                   three rows of jagged icy-blue dorsal plates, charcoal pebbled hide, long
 *                   curled tail. Veins, plates, eyes and inner mouth glow with `motion.charge`.
 *   ghidorahSpec()  The 2019 gold version: three necks and heads, two bat wings, two tails.
 *
 * Rotation conventions used when animating (joint rotation order is YXZ):
 *   +x tips a joint's +y toward +z (leans forward) and moves its +z end DOWN (opens a jaw);
 *   on a tail pointing -z, +x curls the tip UP.
 */

const G = {
  hide: '#3b3e44',
  hideDark: '#2e3136',
  belly: '#72757a',
  plate: '#a9cce4',
  plateRoot: '#27384a',
  tooth: '#ebe6d4',
  eye: '#c9a227',
  mouth: '#2a1a1f',
  claw: '#d9d4c3',
};

const D = {
  gold: '#cf9f31',
  goldDark: '#8a6417',
  belly: '#ecc965',
  horn: '#f1e2b0',
  membrane: '#c4571f',
  rib: '#e3b44a',
  eye: '#fff2a8',
  mouth: '#3a1010',
  claw: '#efe6c4',
};

const PI = Math.PI;

/** A dorsal plate: a dark root block with an icy cone on it. `spine` = 0 tail tip .. 1 head. */
function plate(x, y, z, h, r, tilt, spine, seed, root = G.plateRoot) {
  return [
    box({ size: [r * 1.5, h * 0.22, r * 1.5], pos: [x, y, z], rot: [tilt, 0, 0], color: root, jitter: 0.12, seed }),
    cone({ radius: r, height: h, sides: 4, pos: [x, y, z], rot: [tilt, 0.4, 0], color: G.plate, glow: GLOW.PLATE, spine, jitter: 0.1, seed: seed + 1 }),
  ];
}

/** A short jagged crack on the hide. Invisible at rest (the colour is the hide's), lit by uVein. */
function vein(x, y, z, len, rot, seed) {
  return box({ size: [0.07, len, 0.07], pos: [x, y, z], rot, color: G.hide, glow: GLOW.VEIN, jitter: 0, seed });
}

/** A zig-zag of cracks running along y at (x, z) on a surface facing `nx`/`nz`. */
function veinChain(rng, x, y0, y1, z, n, spread = 0.35) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const y = y0 + ((y1 - y0) * (i + rng() * 0.5)) / n;
    const zz = z + (rng() - 0.5) * spread;
    out.push(vein(x, y, zz, 0.35 + rng() * 0.35, [(rng() - 0.5) * 0.5, 0, (rng() - 0.5) * 1.1], 7 + i));
  }
  return out;
}

export const GODZILLA_TAIL_SEGMENTS = 8;
export const GHIDORAH_NECK_SEGMENTS = 3;
export const GHIDORAH_TAIL_SEGMENTS = 4;

export function godzillaSpec() {
  const rng = mulberry32(2019);
  const joints = [];
  const J = (name, parent, pos, parts, rot) => joints.push({ name, parent, pos, rot, parts });

  // ---- hips: the root of the body, 2.6 above the soles ----
  J('hips', null, [0, 2.6, -0.2], [
    box({ size: [2.0, 1.5, 1.9], pos: [0, 0, 0], color: G.hide, seed: 1 }),
    box({ size: [1.5, 1.1, 1.6], pos: [0, -0.35, 0.3], color: G.belly, seed: 2 }),
  ]);

  // ---- legs: pillar thighs, broad flat feet, three toes with claws ----
  for (const s of [-1, 1]) {
    const n = s < 0 ? 'legL' : 'legR';
    J(n, 'hips', [s * 0.82, -0.4, 0.1], [
      box({ size: [1.05, 1.1, 1.25], pos: [0, -0.45, 0], rot: [0.15, 0, 0], color: G.hide, seed: 3 }),
      box({ size: [0.9, 1.0, 1.0], pos: [0, -1.4, 0.1], color: G.hideDark, seed: 4 }),
      box({ size: [1.15, 0.42, 1.55], pos: [0, -2.0, 0.35], color: G.hide, seed: 5 }),
      ...[-0.38, 0, 0.38].map((tx, i) =>
        cone({ radius: 0.16, height: 0.5, sides: 4, pos: [tx, -2.0, 1.1], rot: [PI / 2, 0, 0], color: G.claw, jitter: 0.04, seed: 20 + i }),
      ),
    ]);
  }

  // ---- torso: leans forward; barrel chest, pale belly, three rows of dorsal plates ----
  const torso = [
    box({ size: [2.0, 1.4, 1.8], pos: [0, 0.7, 0], color: G.hide, seed: 6 }),
    box({ size: [2.4, 1.6, 2.0], pos: [0, 1.9, 0.12], color: G.hide, seed: 7 }),
    box({ size: [1.7, 2.2, 0.3], pos: [0, 1.5, 1.05], color: G.belly, seed: 8 }),
  ];
  for (let i = 0; i < 6; i++) {
    const y = 0.45 + i * 0.42;
    const h = 0.7 + 0.5 * Math.sin(((i + 0.5) / 6) * PI); // biggest mid-back
    torso.push(...plate(0, y, -0.9, h, 0.3 + h * 0.12, -0.6, 0.45 + (i / 6) * 0.25, 100 + i));
  }
  for (const sx of [-0.62, 0.62]) {
    for (let i = 0; i < 5; i++) {
      const y = 0.6 + i * 0.46;
      const h = 0.5 + 0.35 * Math.sin(((i + 0.5) / 5) * PI);
      torso.push(...plate(sx, y, -0.86, h, 0.22 + h * 0.1, -0.5, 0.46 + (i / 5) * 0.25, 130 + i + (sx > 0 ? 7 : 0)));
    }
  }
  torso.push(...veinChain(rng, -1.2, 0.5, 2.7, 0.0, 6), ...veinChain(rng, 1.2, 0.5, 2.7, 0.0, 6));
  torso.push(...veinChain(rng, -0.55, 1.0, 2.6, 1.13, 4, 0.2), ...veinChain(rng, 0.55, 1.0, 2.6, 1.13, 4, 0.2));
  J('torso', 'hips', [0, 0.4, 0.3], torso, [0.25, 0, 0]);

  // ---- arms: short, held forward ----
  for (const s of [-1, 1]) {
    const n = s < 0 ? 'armL' : 'armR';
    J(n, 'torso', [s * 1.3, 2.3, 0.7], [
      box({ size: [0.5, 0.9, 0.5], pos: [0, -0.35, 0.1], rot: [-0.3, 0, 0], color: G.hide, seed: 9 }),
      box({ size: [0.42, 0.42, 0.75], pos: [0, -0.7, 0.5], color: G.hideDark, seed: 10 }),
      ...[-0.13, 0.13].map((cx, i) => cone({ radius: 0.08, height: 0.32, sides: 4, pos: [cx, -0.7, 0.9], rot: [PI / 2, 0, 0], color: G.claw, jitter: 0.04, seed: 30 + i })),
      ...veinChain(rng, s * 0.26, -0.7, 0.1, 0.2, 3, 0.1),
    ], [0, 0, 0]);
  }

  // ---- neck and head: a small head on a thick neck ----
  const neck = [box({ size: [1.25, 1.3, 1.2], pos: [0, 0.5, 0.2], rot: [0.3, 0, 0], color: G.hide, seed: 11 })];
  for (let i = 0; i < 3; i++) neck.push(...plate(0, 0.25 + i * 0.4, -0.35 + i * 0.18, 0.55 - i * 0.05, 0.22, -0.7, 0.78 + i * 0.05, 160 + i));
  neck.push(...veinChain(rng, -0.64, 0.1, 1.0, 0.3, 3, 0.1), ...veinChain(rng, 0.64, 0.1, 1.0, 0.3, 3, 0.1));
  J('neck', 'torso', [0, 2.5, 0.45], neck, [0.2, 0, 0]);

  const head = [
    box({ size: [1.25, 0.9, 1.4], pos: [0, 0.15, 0.4], color: G.hide, seed: 12 }), // skull
    box({ size: [0.95, 0.55, 1.1], pos: [0, 0.0, 1.35], color: G.hide, seed: 13 }), // upper jaw / snout
    box({ size: [1.35, 0.14, 0.5], pos: [0, 0.55, 0.95], color: G.hideDark, seed: 14 }), // brow
    ...[-1, 1].map((s) => box({ size: [0.17, 0.15, 0.3], pos: [s * 0.5, 0.36, 1.0], color: G.eye, glow: GLOW.EYE, jitter: 0, seed: 15 })),
  ];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) head.push(cone({ radius: 0.07, height: 0.24, sides: 4, pos: [s * 0.45, -0.27, 0.95 + i * 0.28], rot: [PI, 0, 0], color: G.tooth, jitter: 0.03, seed: 40 + i }));
  }
  J('head', 'neck', [0, 1.05, 0.6], head, [-0.05, 0, 0]);

  const jaw = [
    box({ size: [0.9, 0.26, 1.55], pos: [0, -0.13, 0.78], color: G.belly, seed: 16 }),
    box({ size: [0.78, 0.1, 1.35], pos: [0, 0.03, 0.8], color: G.mouth, glow: GLOW.EYE, jitter: 0, seed: 17 }), // inside the mouth
  ];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) jaw.push(cone({ radius: 0.06, height: 0.22, sides: 4, pos: [s * 0.38, 0.0, 0.5 + i * 0.28], color: G.tooth, jitter: 0.03, seed: 50 + i }));
  }
  J('jaw', 'head', [0, -0.28, 0.25], jaw, [0.05, 0, 0]);

  // ---- tail: ~body length, thick at the root, plates down the whole length, curled tip ----
  const N = GODZILLA_TAIL_SEGMENTS;
  const len = 0.95;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const w = 1.45 * (1 - t) + 0.22;
    const spine = 0.34 * (1 - t); // tip 0 .. root ~0.34, below the hips (0.4) so the wave runs tail -> head
    const parts = [
      box({ size: [w, w * 0.95, len * 1.05], pos: [0, 0, -len / 2], color: i % 2 ? G.hide : G.hideDark, seed: 60 + i }),
      box({ size: [w * 0.6, w * 0.3, len], pos: [0, -w * 0.4, -len / 2], color: G.belly, seed: 70 + i }),
      ...plate(0, w * 0.45, -len / 2, 0.35 + w * 0.45, 0.14 + w * 0.12, -0.4, spine, 200 + i),
    ];
    if (i < N - 3) {
      for (const sx of [-1, 1]) parts.push(...plate(sx * w * 0.32, w * 0.4, -len / 2 + 0.05, 0.25 + w * 0.3, 0.1 + w * 0.08, -0.4, spine, 230 + i + (sx > 0 ? 9 : 0)));
    }
    const curl = i < 3 ? 0.03 : 0.1 + (i - 3) * 0.04;
    J(`tail${i}`, i === 0 ? 'hips' : `tail${i - 1}`, i === 0 ? [0, -0.15, -0.9] : [0, 0, -len], parts, [curl, 0, 0]);
  }

  return { name: 'godzilla', joints };
}

/** A wing built for one side (s = -1 left, +1 right): upper arm + inner membrane, then the finger fan. */
function wingParts(s) {
  const upper = [
    box({ size: [2.2, 0.32, 0.42], pos: [s * 1.1, 0, 0], color: D.gold, seed: 301 }),
    box({ size: [2.0, 0.1, 0.1], pos: [s * 1.1, 0.12, 0.0], color: D.rib, glow: GLOW.VEIN, jitter: 0, seed: 302 }),
    panel({ pts: [[0, 0, -0.2], [s * 2.2, 0, -0.2], [s * 2.2, -0.06, -2.4], [0, -0.1, -3.1]], color: D.membrane, seed: 303 }),
  ];
  const tips = [
    [s * 3.0, 0.3, -0.6],
    [s * 2.8, 0.0, -1.9],
    [s * 2.3, -0.1, -3.2],
  ];
  const outer = [];
  for (const t of tips) {
    const len = Math.hypot(t[0], t[1], t[2]);
    const yaw = Math.atan2(t[0], t[2]);
    const pitch = -Math.asin(t[1] / len);
    // a finger: a thin box from the elbow to the tip (box +z axis aimed at t)
    outer.push(box({ size: [0.14, 0.14, len], pos: [t[0] / 2, t[1] / 2, t[2] / 2], rot: [pitch, yaw, 0], color: D.gold, seed: 310 }));
  }
  outer.push(panel({ pts: [[0, 0, -0.2], tips[0], tips[1], tips[2], [0, -0.1, -3.1]], color: D.membrane, seed: 320 }));
  outer.push(box({ size: [0.2, 0.2, 0.5], pos: [s * 0.1, 0.15, 0.1], color: D.horn, jitter: 0.04, seed: 321 }));
  return { upper, outer };
}

export function ghidorahSpec() {
  const joints = [];
  const J = (name, parent, pos, parts, rot) => joints.push({ name, parent, pos, rot, parts });
  const rng = mulberry32(5150);

  // ---- body (root = the hover point) ----
  const body = [
    box({ size: [2.1, 1.7, 3.1], pos: [0, 0, 0], color: D.gold, seed: 400 }),
    box({ size: [1.6, 1.2, 2.6], pos: [0, -0.35, 0.1], color: D.belly, seed: 401 }),
    box({ size: [1.4, 0.2, 2.4], pos: [0, 0.9, -0.2], color: D.goldDark, seed: 402 }),
  ];
  // crest of spines down the back, lit with the charge from tail to head
  for (let i = 0; i < 6; i++) body.push(cone({ radius: 0.2, height: 0.7 - i * 0.04, sides: 4, pos: [0, 0.8, -1.3 + i * 0.5], rot: [-0.5, 0.3, 0], color: D.horn, glow: GLOW.PLATE, spine: 0.3 + (i / 6) * 0.4, jitter: 0.06, seed: 410 + i }));
  // stripes of cracks across the chest and flanks
  for (let i = 0; i < 6; i++) {
    for (const s of [-1, 1]) body.push(box({ size: [0.06, 0.5, 0.06], pos: [s * 1.07, 0.1 + (rng() - 0.5) * 0.6, -1.0 + i * 0.4], rot: [0, 0, (rng() - 0.5) * 0.9], color: D.gold, glow: GLOW.VEIN, jitter: 0, seed: 420 + i }));
  }
  // legs tucked under the body, with claws
  for (const s of [-1, 1]) {
    body.push(box({ size: [0.6, 1.0, 0.7], pos: [s * 0.7, -1.1, -0.5], rot: [0.5, 0, 0], color: D.gold, seed: 430 }));
    body.push(box({ size: [0.5, 0.9, 0.55], pos: [s * 0.7, -1.7, -0.1], rot: [-0.4, 0, 0], color: D.goldDark, seed: 431 }));
    for (const cx of [-0.15, 0.15]) body.push(cone({ radius: 0.07, height: 0.4, sides: 4, pos: [s * 0.7 + cx, -2.0, 0.2], rot: [PI / 2 + 0.4, 0, 0], color: D.claw, jitter: 0.03, seed: 432 }));
  }
  J('body', null, [0, 0, 0], body);

  // ---- wings: two joints per side (shoulder flaps, elbow folds) ----
  for (const s of [-1, 1]) {
    const tag = s < 0 ? 'L' : 'R';
    const w = wingParts(s);
    J(`wing${tag}`, 'body', [s * 0.9, 0.8, 0.3], w.upper, [0, 0, 0]);
    J(`wing${tag}2`, `wing${tag}`, [s * 2.2, 0, 0], w.outer, [0, 0, 0]);
  }

  // ---- three necks, three heads ----
  const neckRoots = [
    { x: -0.75, yaw: 0.5, sway: 0 },
    { x: 0, yaw: 0, sway: 1.7 },
    { x: 0.75, yaw: -0.5, sway: 3.4 },
  ];
  neckRoots.forEach((nr, k) => {
    for (let i = 0; i < GHIDORAH_NECK_SEGMENTS; i++) {
      const w = 0.62 - i * 0.07;
      const parts = [box({ size: [w, 1.05, w], pos: [0, 0.5, 0], color: i % 2 ? D.gold : D.goldDark, seed: 500 + k * 10 + i })];
      parts.push(box({ size: [w * 0.55, 0.9, 0.1], pos: [0, 0.5, w * 0.5], color: D.belly, jitter: 0.05, seed: 510 + i }));
      parts.push(cone({ radius: 0.11, height: 0.34, sides: 4, pos: [0, 0.95, -w * 0.45], rot: [-0.7, 0, 0], color: D.horn, glow: GLOW.PLATE, spine: 0.75 + i * 0.07, jitter: 0.05, seed: 520 + i }));
      J(
        `neck${k}_${i}`,
        i === 0 ? 'body' : `neck${k}_${i - 1}`,
        i === 0 ? [nr.x, 0.55, 1.3] : [0, 1.0, 0],
        parts,
        i === 0 ? [0.45, nr.yaw, -nr.yaw * 0.5] : [-0.18, nr.yaw * 0.2, 0],
      );
    }
    // head
    const head = [
      box({ size: [0.85, 0.65, 1.05], pos: [0, 0.15, 0.35], color: D.gold, seed: 540 + k }),
      box({ size: [0.6, 0.36, 0.7], pos: [0, 0.0, 1.0], color: D.gold, seed: 541 }),
      box({ size: [0.5, 0.2, 0.9], pos: [0, -0.28, 0.6], color: D.belly, seed: 542 }), // lower jaw
      box({ size: [0.4, 0.06, 0.6], pos: [0, -0.15, 0.7], color: D.mouth, glow: GLOW.EYE, jitter: 0, seed: 543 }),
    ];
    for (const s of [-1, 1]) {
      head.push(box({ size: [0.14, 0.12, 0.2], pos: [s * 0.36, 0.3, 0.62], color: D.eye, glow: GLOW.EYE, jitter: 0, seed: 544 }));
      head.push(cone({ radius: 0.1, height: 0.8, sides: 4, pos: [s * 0.3, 0.4, -0.1], rot: [-1.1, 0, s * 0.35], color: D.horn, jitter: 0.04, seed: 545 })); // swept-back horns
      head.push(cone({ radius: 0.07, height: 0.4, sides: 4, pos: [s * 0.42, 0.1, -0.1], rot: [-0.9, 0, s * 0.9], color: D.horn, jitter: 0.04, seed: 546 })); // frill
      for (let i = 0; i < 3; i++) head.push(cone({ radius: 0.045, height: 0.18, sides: 4, pos: [s * 0.22, -0.17, 0.95 - i * 0.22], rot: [PI, 0, 0], color: D.horn, jitter: 0.03, seed: 547 }));
    }
    J(`head${k}`, `neck${k}_${GHIDORAH_NECK_SEGMENTS - 1}`, [0, 1.0, 0.05], head, [0.05, 0, 0]);
  });

  // ---- twin tails ----
  [-1, 1].forEach((s, k) => {
    for (let i = 0; i < GHIDORAH_TAIL_SEGMENTS; i++) {
      const t = i / (GHIDORAH_TAIL_SEGMENTS - 1);
      const w = 0.62 * (1 - t) + 0.18;
      const parts = [box({ size: [w, w * 0.9, 1.15], pos: [0, 0, -0.55], color: i % 2 ? D.gold : D.goldDark, seed: 600 + k * 10 + i })];
      if (i === GHIDORAH_TAIL_SEGMENTS - 1) parts.push(cone({ radius: 0.2, height: 0.9, sides: 4, pos: [0, 0, -1.1], rot: [-PI / 2, 0, 0], color: D.horn, jitter: 0.04, seed: 610 }));
      J(`tail${k}_${i}`, i === 0 ? 'body' : `tail${k}_${i - 1}`, i === 0 ? [s * 0.4, -0.2, -1.4] : [0, 0, -1.1], parts, [i === 0 ? -0.1 : -0.12, i === 0 ? s * 0.25 : s * 0.1, 0]);
    }
  });

  return { name: 'ghidorah', joints };
}
