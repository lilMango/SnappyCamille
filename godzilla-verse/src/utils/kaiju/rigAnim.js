import { GODZILLA_TAIL_SEGMENTS, GHIDORAH_NECK_SEGMENTS, GHIDORAH_TAIL_SEGMENTS } from './rigParts';

/**
 * Pose a rig from the controller's `motion` object. No allocation: it only writes joint rotations
 * (and a couple of positions). Each joint's rest pose is `joint.userData.rest`.
 *
 * Everything glowing is keyed to ONE number, `motion.charge` (0..1): the plates light tail -> head,
 * the veins and eyes follow, the head rears back, then it thrusts forward while firing.
 */

const set = (j, x, y, z) => {
  const r = j.userData.rest;
  j.rotation.set(r.x + x, r.y + y, r.z + z);
};

export function poseGodzilla(J, m, t) {
  const sp = m.speed;
  const p = m.phase;
  const swing = Math.sin(p);
  const charge = m.charge;
  const fire = m.firing ? 1 : 0;
  const breathe = Math.sin(t * 1.2) * 0.02;

  // legs alternate; the hips drop a little on each footfall and roll with the stride
  set(J.legL, swing * 0.55 * sp, 0, 0);
  set(J.legR, -swing * 0.55 * sp, 0, 0);
  J.hips.position.y = 2.6 - Math.abs(Math.cos(p)) * 0.14 * sp;
  set(J.hips, 0, 0, swing * 0.04 * sp);

  // torso twists against the hips, leans back to inhale while charging, forward as it fires
  const stag = Math.min(1, m.stagger / 0.9);
  const atk = m.attack; // -1 winding up .. +1 striking
  const torsoX = breathe - charge * 0.14 + fire * 0.22 - stag * 0.3;
  const neckX = -charge * 0.12 + fire * 0.12 - m.roar * 0.25;
  const twist = atk > 0 ? -atk * 0.45 : -atk * 0.3; // wind up one way, whip the other
  set(J.torso, torsoX, -swing * 0.07 * sp + twist, 0);
  // the claw swipe uses the right arm (back on the windup, across on the strike); a grab reaches with both
  const swipe = atk < 0 ? -atk * 1.3 : -atk * 2.1;
  set(J.armL, -swing * 0.3 * sp - charge * 0.2 - m.grab * 1.6, 0, 0.05 + m.roar * 0.5 + m.grab * 0.15);
  set(J.armR, swing * 0.3 * sp - charge * 0.2 + swipe - m.grab * 1.6, 0, -0.05 - m.roar * 0.5 - m.grab * 0.15);

  // head: the chain torso -> neck -> head is pitched so the HEAD ends up looking 0.12 rad down
  // (0.2 while a beam is out, matching m.aimPitch), rearing back while it charges; yaw splits
  // 35/65 between neck and head so the total equals m.aim, i.e. where the beam goes.
  const aimBlend = Math.min(1, charge * 3);
  const headPitch = 0.12 + (-m.aimPitch - 0.12) * aimBlend - charge * 0.15 * (1 - fire);
  set(J.neck, neckX, m.aim * 0.35, 0);
  set(J.head, headPitch - (0.25 + torsoX + 0.2 + neckX - 0.05) - stag * 0.35, m.aim * 0.65, 0);
  set(J.jaw, charge * 0.18 + fire * 0.5 + m.roar * 0.55 + (atk > 0 ? atk * 0.4 : 0) + stag * 0.4, 0, 0);

  // tail: a travelling wave, wider at speed, swung opposite the turn
  const N = GODZILLA_TAIL_SEGMENTS;
  for (let i = 0; i < N; i++) {
    const k = (i + 1) / N;
    const yaw = Math.sin(p * 0.5 - i * 0.55) * 0.16 * (0.35 + sp) + Math.sin(t * 0.8 - i * 0.45) * 0.05 - m.turn * 0.1 * k;
    set(J[`tail${i}`], Math.sin(t * 1.1 - i * 0.5) * 0.012 + charge * 0.015, yaw, 0);
  }
}

export function poseGhidorah(J, m, t) {
  const f = m.phase;
  const charge = m.charge;
  const fire = m.firing ? 1 : 0;
  const glide = 1 - Math.min(1, m.speed * 0.6); // hovering flaps harder, cruising glides

  // wings: shoulder flaps, elbow follows a beat behind
  const flap = Math.sin(f) * (0.45 + glide * 0.2);
  set(J.wingR, 0, 0, flap + 0.1);
  set(J.wingL, 0, 0, -flap - 0.1);
  set(J.wingR2, 0, 0, Math.sin(f - 1.0) * 0.4 - 0.1);
  set(J.wingL2, 0, 0, -Math.sin(f - 1.0) * 0.4 + 0.1);

  const stag = Math.min(1, m.stagger / 0.9);
  const atk = m.attack; // -1 winding up .. +1 lunging

  // body banks into turns and noses down at speed (and rocks back when hit)
  set(J.body, m.speed * 0.1 + Math.cos(f) * 0.03 - stag * 0.3, 0, -m.turn * 0.18);

  // three necks, each with its own phase so the heads never sync; they rear back to charge and lunge to fire
  for (let k = 0; k < 3; k++) {
    const ph = k * 1.9;
    for (let i = 0; i < GHIDORAH_NECK_SEGMENTS; i++) {
      const sway = Math.sin(t * 0.9 + ph + i * 0.7) * 0.22 + (k - 1) * fire * 0.12;
      const lunge = atk < 0 ? atk * 0.25 : atk * 0.35; // rear back, then strike
      const nod = Math.sin(t * 0.7 + ph * 1.3 + i * 0.5) * 0.1 - charge * 0.14 + fire * 0.16 + lunge - stag * 0.15;
      set(J[`neck${k}_${i}`], nod, sway, 0);
    }
    set(J[`head${k}`], -charge * 0.25 + fire * 0.5 + Math.sin(t * 1.3 + ph) * 0.08 + (atk > 0 ? atk * 0.6 : atk * 0.3), Math.sin(t * 0.6 + ph) * 0.15, 0);
  }

  for (let k = 0; k < 2; k++) {
    for (let i = 0; i < GHIDORAH_TAIL_SEGMENTS; i++) {
      set(J[`tail${k}_${i}`], Math.sin(t * 1.4 - i * 0.6 + k) * 0.05, Math.sin(t * 1.2 - i * 0.8 + k * 2) * 0.2 - m.turn * 0.1, 0);
    }
  }
}
