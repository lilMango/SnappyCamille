/**
 * Mutable effect state shared by the kaiju simulation (writes) and the effect components (read).
 * Plain typed arrays and objects: nothing here allocates per frame.
 */

export const BOLT_LEVELS = 4; // 2^4 + 1 = 17 points per bolt
export const BOLT_POINTS = (1 << BOLT_LEVELS) + 1;
export const MAX_BOLTS = 24;

export const fx = {
  // Godzilla's atomic breath
  beam: { on: false, charge: 0, ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 1, len: 0, hit: false, ex: 0, ey: 0, ez: 0, power: 0 },
  // charging glow at a jaw (also lights the unlit chunks); one slot per kaiju index
  jaw: [
    { x: 0, y: 0, z: 0, charge: 0, r: 0, g: 0, b: 0 },
    { x: 0, y: 0, z: 0, charge: 0, r: 0, g: 0, b: 0 },
  ],
  // Ghidorah's gravity lightning: a ring of bolts that live ~0.2 s
  bolts: Array.from({ length: MAX_BOLTS }, () => ({ ttl: 0, life: 0.2, pts: new Float32Array(BOLT_POINTS * 3) })),
  boltHead: 0,
};

export function nextBolt() {
  const b = fx.bolts[fx.boltHead];
  fx.boltHead = (fx.boltHead + 1) % MAX_BOLTS;
  return b;
}
