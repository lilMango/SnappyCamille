/**
 * Kinematic body vs. voxel grid: swept AABB, resolved one axis at a time (Y, then X, then Z
 * — Minecraft's order, which makes ceilings, floors and step-up unambiguous). One shared
 * mover for the player, and later debris and kaiju feet.
 *
 * Pure: depends only on `world.isSolid(x, y, z)`, so it runs in the unit tests unchanged.
 *
 * Body = { x, y, z   feet centre
 *          vx, vy, vz
 *          hw, h     half width (x/z) and height
 *          stepHeight, gravity, terminal
 *          gravityScale   multiplies gravity (0 = a brief zero-g window); default 1
 *          constraint     optional fn(body) run after every substep (the ODM rope)
 *          grounded, hitWall, hitCeiling }  (the last three are outputs)
 */

const EPS = 1e-4; // standoff kept between a body and the surface it stopped against
const MAX_SUBSTEP_DIST = 0.4; // a body never moves more than this per substep
const MAX_SUBSTEPS = 16;

export function createBody({ x = 0, y = 0, z = 0, halfWidth = 0.3, height = 1.8, stepHeight = 1, gravity = 28, terminal = 60 } = {}) {
  return {
    x, y, z,
    vx: 0, vy: 0, vz: 0,
    hw: halfWidth, h: height,
    stepHeight, gravity, terminal,
    gravityScale: 1,
    constraint: null,
    grounded: false, hitWall: false, hitCeiling: false,
  };
}

const _lo = [0, 0, 0];
const _hi = [0, 0, 0];
const _c = [0, 0, 0];

/**
 * How far the body can move along `axis` (0=x, 1=y, 2=z) by `d` before hitting a solid
 * voxel. Returns `d` if the way is clear, else the (smaller-magnitude) allowed distance.
 * Does not move the body.
 */
export function sweep(world, b, axis, d) {
  if (d === 0) return 0;
  _lo[0] = b.x - b.hw;
  _hi[0] = b.x + b.hw;
  _lo[1] = b.y;
  _hi[1] = b.y + b.h;
  _lo[2] = b.z - b.hw;
  _hi[2] = b.z + b.hw;

  const a1 = axis === 0 ? 1 : 0;
  const a2 = axis === 2 ? 1 : 2;
  // cells the box overlaps on the two axes it is not moving along
  const i0 = Math.floor(_lo[a1] + EPS);
  const i1 = Math.floor(_hi[a1] - EPS);
  const j0 = Math.floor(_lo[a2] + EPS);
  const j1 = Math.floor(_hi[a2] - EPS);

  if (d > 0) {
    const face = _hi[axis];
    const c0 = Math.floor(face - EPS) + 1; // first cell strictly ahead of the leading face
    const c1 = Math.floor(face + d - EPS); // last cell the move reaches into
    for (let c = c0; c <= c1; c++) {
      _c[axis] = c;
      for (let i = i0; i <= i1; i++) {
        _c[a1] = i;
        for (let j = j0; j <= j1; j++) {
          _c[a2] = j;
          if (world.isSolid(_c[0], _c[1], _c[2])) return Math.max(0, c - face - EPS);
        }
      }
    }
    return d;
  }

  const face = _lo[axis];
  const c0 = Math.floor(face + EPS) - 1; // first cell strictly behind the leading face
  const c1 = Math.floor(face + d + EPS);
  for (let c = c0; c >= c1; c--) {
    _c[axis] = c;
    for (let i = i0; i <= i1; i++) {
      _c[a1] = i;
      for (let j = j0; j <= j1; j++) {
        _c[a2] = j;
        if (world.isSolid(_c[0], _c[1], _c[2])) return -Math.max(0, face - (c + 1) - EPS);
      }
    }
  }
  return d;
}

/** Does the body's box overlap the unit cell at (x, y, z)? Used to refuse placing blocks inside the player. */
export function bodyOverlapsCell(b, x, y, z) {
  return (
    b.x + b.hw > x && b.x - b.hw < x + 1 &&
    b.y + b.h > y && b.y < y + 1 &&
    b.z + b.hw > z && b.z - b.hw < z + 1
  );
}

/**
 * Advance the body by `dt`: gravity, then collision-resolved movement by its velocity.
 * Long moves are split into substeps of at most MAX_SUBSTEP_DIST so a fast body (a swinging
 * player, a tossed kaiju) can never tunnel through a one-block wall.
 */
export function moveBody(world, b, dt) {
  b.hitWall = false;
  b.hitCeiling = false;
  const fastest = Math.max(Math.abs(b.vx), Math.abs(b.vy), Math.abs(b.vz));
  const n = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil((fastest * dt) / MAX_SUBSTEP_DIST)));
  const h = dt / n;
  for (let s = 0; s < n; s++) step(world, b, h);
}

function step(world, b, dt) {
  // ---- vertical ----
  b.vy = Math.max(-b.terminal, b.vy - b.gravity * b.gravityScale * dt);
  const dy = b.vy * dt;
  const ay = sweep(world, b, 1, dy);
  b.y += ay;
  b.grounded = false;
  if (ay !== dy) {
    if (dy < 0) b.grounded = true;
    else b.hitCeiling = true;
    b.vy = 0;
  }

  // ---- horizontal (X then Z, so the body slides along walls) ----
  const vx0 = b.vx;
  const vz0 = b.vz;
  const dx = vx0 * dt;
  const dz = vz0 * dt;
  const x0 = b.x;
  const z0 = b.z;
  const mx = sweep(world, b, 0, dx);
  b.x += mx;
  if (mx !== dx) {
    b.vx = 0;
    b.hitWall = true;
  }
  const mz = sweep(world, b, 2, dz);
  b.z += mz;
  if (mz !== dz) {
    b.vz = 0;
    b.hitWall = true;
  }

  // ---- step-up: blocked while standing on something -> try hopping onto a low ledge ----
  if (b.hitWall && b.grounded && b.stepHeight > 0 && (dx !== 0 || dz !== 0)) {
    if (tryStepUp(world, b, x0, z0, dx, dz, Math.abs(mx) + Math.abs(mz))) {
      b.vx = vx0;
      b.vz = vz0;
      b.hitWall = false;
    }
  }

  // ---- external constraint (the ODM rope), applied every substep so it stays stable at speed ----
  if (b.constraint) b.constraint(b);
}

// Re-do the horizontal move from (x0, z0) after rising by up to stepHeight. Accepted only
// if it gets further than the plain slide did; then the body settles back down onto the step.
function tryStepUp(world, b, x0, z0, dx, dz, slideProgress) {
  const sx = b.x;
  const sy = b.y;
  const sz = b.z;

  b.x = x0;
  b.z = z0;
  const rise = sweep(world, b, 1, b.stepHeight); // limited by any ceiling
  if (rise > EPS) {
    b.y += rise;
    const mx = sweep(world, b, 0, dx);
    b.x += mx;
    const mz = sweep(world, b, 2, dz);
    b.z += mz;
    if (Math.abs(mx) + Math.abs(mz) > slideProgress + 1e-3) {
      const drop = sweep(world, b, 1, -rise);
      b.y += drop;
      b.grounded = drop !== -rise; // landed on the step (always, unless it was a thin lip)
      return true;
    }
  }
  b.x = sx;
  b.y = sy;
  b.z = sz;
  return false;
}
