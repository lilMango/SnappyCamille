import { ODM } from '../constants/odmConfig';
import { createHit, raycastVoxel } from './raycast';

/**
 * ODM gear: two hooks, rope constraints, reel, boost, air dash, gas. Pure — depends only on
 * `world.isSolid` and plain bodies — so it is unit-tested without a browser.
 *
 * Two entry points:
 *   odmUpdate(world, odm, body, io, dt)   once per frame: gas, firing/releasing hooks, reel,
 *                                         boost, pump, dash, drag.
 *   odmConstraint(odm, body)              once per physics SUBSTEP (body.constraint): the hard
 *                                         rope. Doing it per substep is what keeps a 55 m/s
 *                                         swing stable instead of stretching then snapping back.
 */

const _hit = createHit();
const _best = createHit();
const GOLDEN = 2.399963229728653;

export function createAnchor() {
  return { active: false, x: 0, y: 0, z: 0, bx: 0, by: 0, bz: 0, len: 0, len0: 0, age: 0, held: false };
}

export function createOdm() {
  return {
    gas: ODM.gasMax,
    gasIdle: 0, // time since gas was last spent
    anchors: [createAnchor(), createAnchor()], // 0 = left, 1 = right
    dashUsed: false,
    noGravity: 0, // s of zero gravity left after a dash
    time: 0, // simulation clock (for the release-pop window)
    bottomT: -1e9, // when the body last passed the bottom of a swing (vy crossed - to +)
    prevVy: 0,
    swinging: false, // any rope attached
    boosting: false,
    reeling: false,
    events: [], // { type: 'attach' | 'detach' | 'dash' | 'pop' | 'empty', ... } for effects
    swingDistance: 0, // metres travelled while attached (feeds the score)
  };
}

export const attachedCount = (odm) => (odm.anchors[0].active ? 1 : 0) + (odm.anchors[1].active ? 1 : 0);

// ---- anchoring -------------------------------------------------------------------

/**
 * Find where a hook fired along (ox,oy,oz) + t*(dx,dy,dz) would stick. The centre ray goes
 * first; if it misses, 8 rays in a Fibonacci spiral within `assistDeg` are tried and the best
 * (smallest angle, then nearest) wins — forgiveness is the difference between "I keep
 * whiffing" and "it feels amazing". Fills `out`; returns whether anything was found.
 */
export function findAnchor(world, ox, oy, oz, dx, dy, dz, out) {
  const len = Math.hypot(dx, dy, dz);
  dx /= len;
  dy /= len;
  dz /= len;

  if (raycastVoxel(world, ox, oy, oz, dx, dy, dz, ODM.range, _hit) && _hit.t > 0.5) {
    return fill(out, _hit);
  }

  // two unit vectors perpendicular to the aim direction
  let ux = -dz;
  let uy = 0;
  let uz = dx;
  if (Math.hypot(ux, uz) < 1e-3) {
    ux = 1;
    uz = 0;
  }
  const ul = Math.hypot(ux, uy, uz);
  ux /= ul;
  uy /= ul;
  uz /= ul;
  const vx = dy * uz - dz * uy;
  const vy = dz * ux - dx * uz;
  const vz = dx * uy - dy * ux;

  let bestScore = Infinity;
  const N = 8;
  for (let i = 0; i < N; i++) {
    const deg = ODM.assistDeg * Math.sqrt((i + 1) / N);
    const off = Math.tan((deg * Math.PI) / 180);
    const th = i * GOLDEN;
    const c = Math.cos(th) * off;
    const s = Math.sin(th) * off;
    const rx = dx + ux * c + vx * s;
    const ry = dy + uy * c + vy * s;
    const rz = dz + uz * c + vz * s;
    if (raycastVoxel(world, ox, oy, oz, rx, ry, rz, ODM.range, _hit) && _hit.t > 0.5) {
      const score = deg * 2 + _hit.t * 0.01;
      if (score < bestScore) {
        bestScore = score;
        copyHit(_best, _hit);
      }
    }
  }
  return bestScore < Infinity ? fill(out, _best) : false;
}

function copyHit(to, from) {
  Object.assign(to, from);
}

function fill(out, h) {
  out.x = h.px;
  out.y = h.py;
  out.z = h.pz;
  out.bx = h.x;
  out.by = h.y;
  out.bz = h.z;
  out.dist = h.t;
  return true;
}

/**
 * Fallback when nothing was hit (aiming at the sky): snap to a roof corner inside a cone around
 * the aim direction. `anchors` is the city's Int16Array of (x, y, z) triples. Prefers corners
 * that are higher than the player, which swing best.
 */
export function snapAnchor(world, anchors, ox, oy, oz, dx, dy, dz, py, out) {
  if (!anchors) return false;
  const len = Math.hypot(dx, dy, dz);
  dx /= len;
  dy /= len;
  dz /= len;
  const cosMax = Math.cos((ODM.snapDeg * Math.PI) / 180);
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < anchors.length; i += 3) {
    const ax = anchors[i] + 0.5;
    const ay = anchors[i + 1] + 1; // the top face of the corner block
    const az = anchors[i + 2] + 0.5;
    const rx = ax - ox;
    const ry = ay - oy;
    const rz = az - oz;
    const d = Math.hypot(rx, ry, rz);
    if (d < ODM.snapMin || d > ODM.snapMax) continue;
    const cos = (rx * dx + ry * dy + rz * dz) / d;
    if (cos < cosMax) continue;
    const angle = (Math.acos(Math.min(1, cos)) * 180) / Math.PI;
    const score = angle + d * 0.02 - Math.max(0, ay - py) * 0.04;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  if (best < 0) return false;
  out.x = anchors[best] + 0.5;
  out.y = anchors[best + 1] + 1;
  out.z = anchors[best + 2] + 0.5;
  out.bx = anchors[best];
  out.by = anchors[best + 1];
  out.bz = anchors[best + 2];
  out.dist = Math.hypot(out.x - ox, out.y - oy, out.z - oz);
  return world.isSolid(out.bx, out.by, out.bz);
}

// ---- the rope (per physics substep) ---------------------------------------------------

/**
 * Hard distance constraint: if the body is further than `len` from an anchor, pull it back
 * onto the sphere and remove ONLY its outward radial velocity. Tangential velocity is
 * untouched, so you swing; inward velocity is untouched, so reeling accelerates you.
 */
export function odmConstraint(odm, b) {
  const chest = ODM.chestHeight;
  for (let it = 0; it < ODM.iterations; it++) {
    for (let i = 0; i < 2; i++) {
      const a = odm.anchors[i];
      if (!a.active) continue;
      const dx = b.x - a.x;
      const dy = b.y + chest - a.y;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist <= a.len || dist === 0) continue;
      const nx = dx / dist;
      const ny = dy / dist;
      const nz = dz / dist;
      const excess = dist - a.len;
      b.x -= nx * excess;
      b.y -= ny * excess;
      b.z -= nz * excess;
      const vr = b.vx * nx + b.vy * ny + b.vz * nz;
      if (vr > 0) {
        b.vx -= nx * vr;
        b.vy -= ny * vr;
        b.vz -= nz * vr;
      }
    }
  }
  // the speed cap, enforced after gravity too (so what you measure after a step is <= the cap)
  const sp = Math.hypot(b.vx, b.vy, b.vz);
  if (sp > ODM.maxSpeed) {
    const k = ODM.maxSpeed / sp;
    b.vx *= k;
    b.vy *= k;
    b.vz *= k;
  }
}

// ---- per frame ---------------------------------------------------------------------------

function spend(odm, amount) {
  if (ODM.unlimitedGas) return;
  odm.gas = Math.max(0, odm.gas - amount);
  odm.gasIdle = 0;
}

function detach(odm, i, b, byPlayer) {
  const a = odm.anchors[i];
  if (!a.active) return;
  a.active = false;
  odm.events.push({ type: 'detach', side: i, x: a.x, y: a.y, z: a.z });
  // the pop: let go just after the bottom of the arc and the swing flings you
  if (byPlayer && b.vy > 0 && odm.time - odm.bottomT <= ODM.releaseWindow && !b.grounded) {
    b.vx *= ODM.releasePop;
    b.vz *= ODM.releasePop;
    b.vy += ODM.releaseLift;
    odm.events.push({ type: 'pop' });
  }
}

/**
 * @param io {
 *   hook: [boolLeft, boolRight]   held this frame
 *   ray:  {ox,oy,oz,dx,dy,dz}     the crosshair ray (camera through the crosshair)
 *   anchors: Int16Array | null    city roof corners for the snap assist
 *   reel, boost: bool             held
 *   dash: bool                    pressed this frame (edge)
 *   fwd: number                   forward input 0..1 (for the pump)
 *   look: {x,y,z}                 unit camera look direction (for boost/dash)
 *   move: {x,z}                   wanted horizontal direction (unit or zero) (for dash)
 * }
 */
export function odmUpdate(world, odm, b, io, dt) {
  odm.time += dt;
  odm.events.length = 0;
  const grounded = b.grounded;
  const chest = ODM.chestHeight;

  // dash recharges on the ground
  if (grounded) odm.dashUsed = false;

  // bottom-of-the-arc detector: vertical velocity crossing from falling to rising while roped
  if (attachedCount(odm) > 0 && odm.prevVy < 0 && b.vy >= 0) odm.bottomT = odm.time;
  odm.prevVy = b.vy;

  // ---- hooks: fire on press, hold while held, release on let-go ----
  for (let i = 0; i < 2; i++) {
    const a = odm.anchors[i];
    const held = io.hook[i];
    if (held && !a.held) {
      // pressed this frame
      if (odm.gas >= ODM.shotCost && !a.active) {
        const r = io.ray;
        let got = findAnchor(world, r.ox, r.oy, r.oz, r.dx, r.dy, r.dz, a);
        if (!got) got = snapAnchor(world, io.anchors, r.ox, r.oy, r.oz, r.dx, r.dy, r.dz, b.y, a);
        if (got) {
          a.active = true;
          a.age = 0;
          a.len = Math.hypot(b.x - a.x, b.y + chest - a.y, b.z - a.z);
          a.len0 = a.len;
          spend(odm, ODM.shotCost);
          odm.dashUsed = false; // a fresh hook refreshes the dash
          odm.events.push({ type: 'attach', side: i, x: a.x, y: a.y, z: a.z });
        }
      } else if (odm.gas < ODM.shotCost) {
        odm.events.push({ type: 'empty' });
      }
    }
    if (!held && a.held && a.active) detach(odm, i, b, true);
    a.held = held;

    if (a.active) {
      a.age += dt;
      // the anchor block was destroyed (a kaiju beam cutting your rope mid-swing is a feature)
      if (!world.isSolid(a.bx, a.by, a.bz)) detach(odm, i, b, false);
    }
  }

  const n = attachedCount(odm);
  odm.swinging = n > 0;

  // gas upkeep for the ropes
  if (n > 0) spend(odm, ODM.upkeep * n * dt);

  // ---- reel ----
  odm.reeling = false;
  if (io.reel && n > 0 && odm.gas > 0) {
    odm.reeling = true;
    spend(odm, ODM.reelCost * dt);
    for (const a of odm.anchors) {
      if (!a.active) continue;
      const oldLen = a.len;
      a.len = Math.max(ODM.minLen, oldLen - ODM.reelSpeed * dt);
      // Angular momentum: shorten the rope and the tangential speed grows by oldLen / newLen.
      // (Positional projection alone would just lift you and lose speed; this is the "pump".)
      if (a.len < oldLen) {
        const nx = b.x - a.x;
        const ny = b.y + chest - a.y;
        const nz = b.z - a.z;
        const nl = Math.hypot(nx, ny, nz) || 1;
        const ux = nx / nl;
        const uy = ny / nl;
        const uz = nz / nl;
        const vr = b.vx * ux + b.vy * uy + b.vz * uz;
        const k = Math.min(ODM.reelSpinMax, oldLen / a.len);
        b.vx = ux * vr + (b.vx - ux * vr) * k;
        b.vy = uy * vr + (b.vy - uy * vr) * k;
        b.vz = uz * vr + (b.vz - uz * vr) * k;
      }
      const dx = a.x - b.x;
      const dy = a.y - (b.y + chest);
      const dz = a.z - b.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      b.vx += (dx / d) * ODM.zipAccel * dt;
      b.vy += (dy / d) * ODM.zipAccel * dt;
      b.vz += (dz / d) * ODM.zipAccel * dt;
    }
  } else {
    for (const a of odm.anchors) if (a.active && a.len < a.len0) a.len = Math.min(a.len0, a.len + ODM.regrow * dt);
  }

  // ---- swing pump: forward input on the downswing adds speed along the arc ----
  if (n > 0 && !grounded && io.fwd > 0.3) {
    for (const a of odm.anchors) {
      if (!a.active) continue;
      const nx = b.x - a.x;
      const ny = b.y + chest - a.y;
      const nz = b.z - a.z;
      const nl = Math.hypot(nx, ny, nz) || 1;
      const vr = (b.vx * nx + b.vy * ny + b.vz * nz) / nl;
      let tx = b.vx - (nx / nl) * vr;
      let ty = b.vy - (ny / nl) * vr;
      let tz = b.vz - (nz / nl) * vr;
      const tl = Math.hypot(tx, ty, tz);
      if (tl < 1) continue;
      const k = (ODM.pump * Math.max(0, -ny / nl) * dt) / tl;
      tx *= k;
      ty *= k;
      tz *= k;
      b.vx += tx;
      b.vy += ty;
      b.vz += tz;
    }
  }

  // ---- boost: thrust along the direction of travel (roped, airborne) ----
  odm.boosting = false;
  if (io.boost && n > 0 && !grounded && odm.gas > 0) {
    odm.boosting = true;
    spend(odm, ODM.boostCost * dt);
    let hx = b.vx;
    let hy = b.vy;
    let hz = b.vz;
    let hl = Math.hypot(hx, hy, hz);
    if (hl < 2) {
      hx = io.look.x;
      hy = io.look.y;
      hz = io.look.z;
      hl = 1;
    }
    b.vx += (hx / hl) * ODM.boostAccel * dt;
    b.vy += (hy / hl) * ODM.boostAccel * dt;
    b.vz += (hz / hl) * ODM.boostAccel * dt;
  }

  // ---- air dash: one per airtime ----
  if (io.dash && !grounded && !odm.dashUsed && odm.gas >= ODM.dashCost) {
    odm.dashUsed = true;
    spend(odm, ODM.dashCost);
    let dx;
    let dy;
    let dz;
    if (io.move.x !== 0 || io.move.z !== 0) {
      dx = io.move.x;
      dy = 0.1;
      dz = io.move.z;
    } else {
      dx = io.look.x;
      dy = io.look.y;
      dz = io.look.z;
    }
    const dl = Math.hypot(dx, dy, dz) || 1;
    b.vx += (dx / dl) * ODM.dashSpeed;
    b.vy += (dy / dl) * ODM.dashSpeed;
    b.vz += (dz / dl) * ODM.dashSpeed;
    odm.noGravity = ODM.dashNoGravity;
    odm.events.push({ type: 'dash' });
  }
  odm.noGravity = Math.max(0, odm.noGravity - dt);
  b.gravityScale = odm.noGravity > 0 ? 0 : 1;

  // ---- drag and the speed cap ----
  const sp = Math.hypot(b.vx, b.vy, b.vz);
  if (sp > 0) {
    const drag = Math.max(0, 1 - ODM.drag * sp * dt);
    b.vx *= drag;
    b.vy *= drag;
    b.vz *= drag;
    const cap = ODM.maxSpeed / Math.max(ODM.maxSpeed, sp);
    if (cap < 1) {
      b.vx *= cap;
      b.vy *= cap;
      b.vz *= cap;
    }
  }

  // ---- gas refill ----
  odm.gasIdle += dt;
  if (odm.gas < ODM.gasMax) {
    if (grounded && odm.gasIdle > ODM.refillGroundDelay) odm.gas = Math.min(ODM.gasMax, odm.gas + ODM.refillGround * dt);
    else if (!grounded && odm.gasIdle > ODM.refillAirDelay) odm.gas = Math.min(ODM.gasMax, odm.gas + ODM.refillAir * dt);
  }

  if (n > 0) odm.swingDistance += Math.hypot(b.vx, b.vy, b.vz) * dt;
}

/** Drop every rope (death, respawn, free-cam). */
export function odmReset(odm) {
  for (const a of odm.anchors) {
    a.active = false;
    a.held = false;
  }
  odm.gas = ODM.gasMax;
  odm.dashUsed = false;
  odm.noGravity = 0;
  odm.swinging = false;
}

/** Anchor attach point as a world position, for rendering. */
export function anchorPoint(a, out) {
  out.x = a.x;
  out.y = a.y;
  out.z = a.z;
  return out;
}
