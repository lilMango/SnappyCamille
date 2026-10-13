import { createHit, raycastVoxel } from '../raycast';

/**
 * Kaiju weapon maths. Pure: depends on `world.isSolid` only.
 *
 * Atomic breath is a straight beam from the jaw. Its LENGTH is found by a voxel DDA (it stops at
 * the first solid block), and as the head sweeps, a throttled bore carves a trench through
 * whatever it crosses. Gravity lightning is a jagged polyline from each head to a target point.
 */

const _hit = createHit();

/** Unit direction for a yaw (player convention: yaw 0 looks toward -z) and pitch. */
export function aimDir(yaw, pitch, out = { x: 0, y: 0, z: 0 }) {
  const cp = Math.cos(pitch);
  out.x = -Math.sin(yaw) * cp;
  out.y = Math.sin(pitch);
  out.z = -Math.cos(yaw) * cp;
  return out;
}

/**
 * Where a beam fired from (ox,oy,oz) along unit (dx,dy,dz) ends. `out` = { len, hit, x, y, z }
 * where (x,y,z) is the end point, `hit` whether a solid block stopped it.
 */
export function beamEnd(world, ox, oy, oz, dx, dy, dz, range, out) {
  if (raycastVoxel(world, ox, oy, oz, dx, dy, dz, range, _hit)) {
    out.len = _hit.t;
    out.hit = true;
  } else {
    out.len = range;
    out.hit = false;
  }
  out.x = ox + dx * out.len;
  out.y = oy + dy * out.len;
  out.z = oz + dz * out.len;
  return out;
}

/** The head's yaw offset while firing: sweeps -sweep .. +sweep linearly over the fire time. */
export function sweepYaw(t, fireTime, sweep) {
  const u = Math.max(0, Math.min(1, t / fireTime));
  return -sweep + 2 * sweep * u;
}

/** Distance from a point to the segment a-b. */
export function distToSegment(px, py, pz, ax, ay, az, bx, by, bz) {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const ab2 = abx * abx + aby * aby + abz * abz;
  let t = ab2 === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby + (pz - az) * abz) / ab2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t), pz - (az + abz * t));
}

/**
 * A jagged lightning bolt from A to B by midpoint displacement. Returns a Float32Array of
 * (2^levels + 1) points as x,y,z triples; the ends are exact. Displacement is perpendicular to
 * the segment and shrinks by half each level, so the overall shape stays a bolt, not a scribble.
 *
 * @param rnd () => [0,1)  (pass a seeded generator for a reproducible bolt)
 */
export function lightningBolt(ax, ay, az, bx, by, bz, levels, jitter, rnd, out) {
  const n = (1 << levels) + 1;
  const pts = out && out.length >= n * 3 ? out : new Float32Array(n * 3);
  pts[0] = ax;
  pts[1] = ay;
  pts[2] = az;
  const last = (n - 1) * 3;
  pts[last] = bx;
  pts[last + 1] = by;
  pts[last + 2] = bz;

  const len = Math.hypot(bx - ax, by - ay, bz - az) || 1;
  // two unit vectors perpendicular to the bolt
  const dx = (bx - ax) / len;
  const dy = (by - ay) / len;
  const dz = (bz - az) / len;
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

  let amp = len * jitter;
  for (let level = 0, step = n - 1; level < levels; level++, step >>= 1) {
    const half = step >> 1;
    for (let i = half; i < n - 1; i += step) {
      const a = (i - half) * 3;
      const b = (i + half) * 3;
      const o = i * 3;
      const r1 = (rnd() * 2 - 1) * amp;
      const r2 = (rnd() * 2 - 1) * amp;
      pts[o] = (pts[a] + pts[b]) / 2 + ux * r1 + vx * r2;
      pts[o + 1] = (pts[a + 1] + pts[b + 1]) / 2 + uy * r1 + vy * r2;
      pts[o + 2] = (pts[a + 2] + pts[b + 2]) / 2 + uz * r1 + vz * r2;
    }
    amp *= 0.5;
  }
  return pts;
}
