/**
 * Voxel ray cast (Amanatides & Woo DDA): walks the grid cell by cell along a ray, so it
 * visits exactly the cells the ray passes through. Allocation-free — the caller passes in
 * the `hit` object to fill. Used for block targeting, the third-person camera's wall
 * pull-in and (phase 5) grapple anchors and beam stepping.
 *
 * Pure: depends only on `world.isSolid(x, y, z)`.
 *
 * hit = { x, y, z   the solid cell
 *         nx, ny, nz  normal of the face the ray entered through (0,0,0 if it started inside)
 *         t         distance along the ray to that face
 *         px, py, pz  the point on that face }
 */
export function createHit() {
  return { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, t: 0, px: 0, py: 0, pz: 0 };
}

/** @returns {boolean} whether a solid cell was hit within `maxDist` (direction need not be normalised) */
export function raycastVoxel(world, ox, oy, oz, dx, dy, dz, maxDist, hit) {
  const len = Math.hypot(dx, dy, dz);
  if (len === 0) return false;
  dx /= len;
  dy /= len;
  dz /= len;

  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);

  if (world.isSolid(x, y, z)) {
    // started inside a block: report it with no face normal
    hit.x = x; hit.y = y; hit.z = z;
    hit.nx = 0; hit.ny = 0; hit.nz = 0;
    hit.t = 0;
    hit.px = ox; hit.py = oy; hit.pz = oz;
    return true;
  }

  const sx = dx > 0 ? 1 : -1;
  const sy = dy > 0 ? 1 : -1;
  const sz = dz > 0 ? 1 : -1;
  // distance along the ray between successive grid planes, per axis
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  // distance to the first grid plane, per axis
  let tmx = dx > 0 ? (x + 1 - ox) / dx : dx < 0 ? (ox - x) / -dx : Infinity;
  let tmy = dy > 0 ? (y + 1 - oy) / dy : dy < 0 ? (oy - y) / -dy : Infinity;
  let tmz = dz > 0 ? (z + 1 - oz) / dz : dz < 0 ? (oz - z) / -dz : Infinity;

  let nx = 0;
  let ny = 0;
  let nz = 0;
  let t = 0;
  // A ray can cross at most ~3 cells per unit of distance
  for (let i = 0, max = Math.ceil(maxDist * 3) + 3; i < max; i++) {
    // step across the nearest grid plane
    if (tmx < tmy && tmx < tmz) {
      t = tmx;
      tmx += tdx;
      x += sx;
      nx = -sx; ny = 0; nz = 0;
    } else if (tmy < tmz) {
      t = tmy;
      tmy += tdy;
      y += sy;
      nx = 0; ny = -sy; nz = 0;
    } else {
      t = tmz;
      tmz += tdz;
      z += sz;
      nx = 0; ny = 0; nz = -sz;
    }
    if (t > maxDist) return false;
    if (world.isSolid(x, y, z)) {
      hit.x = x; hit.y = y; hit.z = z;
      hit.nx = nx; hit.ny = ny; hit.nz = nz;
      hit.t = t;
      hit.px = ox + dx * t;
      hit.py = oy + dy * t;
      hit.pz = oz + dz * t;
      return true;
    }
  }
  return false;
}
