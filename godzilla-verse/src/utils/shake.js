/**
 * Camera shake, trauma model (Squirrel Eiserloh): events add "trauma" 0..1 which decays
 * linearly; the shake magnitude is trauma squared, so small hits are subtle and big hits are
 * violent. Offsets come from layered sines at incommensurate frequencies (smooth pseudo-noise).
 * Applied AFTER the camera's own damping so it never pollutes the damped state.
 *
 * Pure: no THREE, no DOM.
 */

export const SHAKE = {
  decay: 1.4, // trauma lost per second
  maxYaw: 0.07, // radians at trauma = 1
  maxPitch: 0.05,
  maxRoll: 0.08,
  maxOffset: 0.35, // metres
  falloffDist: 50, // a source this far away has a quarter of its strength
};

const state = { trauma: 0, t: 0 };

export function addTrauma(amount) {
  state.trauma = Math.min(1, state.trauma + amount);
}

/** Trauma from a world-space source: weaker the further it is from the camera. */
export function addTraumaAt(amount, sx, sy, sz, cx, cy, cz) {
  const d2 = (sx - cx) ** 2 + (sy - cy) ** 2 + (sz - cz) ** 2;
  addTrauma(amount / (1 + d2 / (SHAKE.falloffDist * SHAKE.falloffDist)));
}

export function traumaNow() {
  return state.trauma;
}

export function resetShake() {
  state.trauma = 0;
  state.t = 0;
}

const wave = (t, a, b, c) => Math.sin(t * a + 1.3) * 0.6 + Math.sin(t * b + 4.1) * 0.3 + Math.sin(t * c + 0.7) * 0.1;

/** Advance by dt and write this frame's offsets into `out` ({yaw,pitch,roll,x,y,z}). */
export function tickShake(dt, out) {
  state.t += dt;
  state.trauma = Math.max(0, state.trauma - SHAKE.decay * dt);
  const s = state.trauma * state.trauma;
  const t = state.t;
  out.yaw = s * SHAKE.maxYaw * wave(t, 23, 37, 53);
  out.pitch = s * SHAKE.maxPitch * wave(t, 29, 41, 59);
  out.roll = s * SHAKE.maxRoll * wave(t, 19, 43, 61);
  out.x = s * SHAKE.maxOffset * wave(t, 27, 47, 67);
  out.y = s * SHAKE.maxOffset * wave(t, 31, 53, 71);
  out.z = s * SHAKE.maxOffset * wave(t, 33, 49, 73);
  return out;
}
