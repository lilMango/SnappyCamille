import * as THREE from 'three';
import { latLonToDir, dirToLatLon } from './sphere';
import { PLANET_RADIUS, SPAWN_LAT, SPAWN_LON } from '../constants/worldConfig';

/**
 * Analytic island terrain. Height is a pure function of direction, so the
 * planet mesh, the character's foot height and every Anchor all sample the SAME
 * surface — nothing floats and no raycasts are needed (same contract as
 * camille-galaxy).
 *
 * GEOGRAPHY — everything is laid out in "ocean polar" coordinates:
 *   d = great-circle angle (radians) from the OCEAN center
 *   θ = azimuth (degrees) around the ocean center; θ = 0 points at the spawn,
 *       θ > 0 is east of it, θ < 0 west.
 *
 *   d < SHORE              lagoon / ocean (flat, height 0; painted turquoise ->
 *                          deep blue; blocked by a circle collider in
 *                          islandLayout.js, so it is never walkable)
 *   SHORE .. BEACH_END     Lanikai Beach: a flat, low sand band (flat-masked the
 *                          same way camille's villa courtyard is)
 *   BEACH_END .. LAND_FULL smoothstep ramp from the sand up into the land
 *   > LAND_FULL            Kualoa Ranch: low rolling pasture, two fluted cliff
 *                          ridges (the pali) that box in a valley, and a tall
 *                          peak crowning the far side of the globe.
 *
 * Heights are world units above PLANET_RADIUS and are always >= 0.
 */

const DEG = Math.PI / 180;
const R = PLANET_RADIUS;

// --- Ocean -----------------------------------------------------------------
// The ocean is a spherical cap centered SPAWN_D radians due south of the spawn,
// so the spawn sits near the front of the sand, ~1.5m from the water, facing it.
// (The camera trails ~6.5m behind her, so this keeps it over the sand and in
// front of the palm fringe.)
const SPAWN_D = 0.95;
// spawn sits in the middle of the sand band facing the water.
export const OCEAN = { lat: SPAWN_LAT - SPAWN_D / DEG, lon: SPAWN_LON };
export const OCEAN_DIR = latLonToDir(OCEAN.lat, OCEAN.lon);

export const SHORE = 0.9; // water's edge (radians from ocean center, ~27m)
export const BEACH_END = 1.18; // sand ends (~8.4m wide beach)
export const LAND_FULL = 1.38; // fully "land" height by here

const BEACH_HEIGHT = 0.18; // sand sits just above the water (low, so the lagoon stays in view)
const BEACH_RISE = 0.32; // extra gentle rise toward the back of the beach

// Ocean-polar frame: e1 points from the ocean center toward the spawn, e2 = O x e1.
const _spawnDir = latLonToDir(SPAWN_LAT, SPAWN_LON);
const E1 = _spawnDir.clone().addScaledVector(OCEAN_DIR, -_spawnDir.dot(OCEAN_DIR)).normalize();
const E2 = new THREE.Vector3().crossVectors(OCEAN_DIR, E1).normalize();

/** Unit direction -> { d (radians from ocean center), theta (degrees) }. */
export function oceanPolar(dir) {
  const d = Math.acos(THREE.MathUtils.clamp(dir.dot(OCEAN_DIR), -1, 1));
  const theta = Math.atan2(dir.dot(E2), dir.dot(E1)) / DEG;
  return { d, theta };
}

/** Ocean-polar (d radians, theta degrees) -> unit direction. */
export function polarToDir(d, thetaDeg, out = new THREE.Vector3()) {
  const t = thetaDeg * DEG;
  // tangent direction at the ocean center along azimuth t, then rotate out by d
  const tx = E1.x * Math.cos(t) + E2.x * Math.sin(t);
  const ty = E1.y * Math.cos(t) + E2.y * Math.sin(t);
  const tz = E1.z * Math.cos(t) + E2.z * Math.sin(t);
  return out
    .set(
      OCEAN_DIR.x * Math.cos(d) + tx * Math.sin(d),
      OCEAN_DIR.y * Math.cos(d) + ty * Math.sin(d),
      OCEAN_DIR.z * Math.cos(d) + tz * Math.sin(d)
    )
    .normalize();
}

/** Ocean-polar -> { lat, lon } in degrees (for Anchors / zones). */
export function polarToLatLon(d, thetaDeg) {
  return dirToLatLon(polarToDir(d, thetaDeg));
}

// --- Kualoa ridges (the pali) ----------------------------------------------
// Each ridge is an arc of constant ocean-distance `d` running from azimuth t0
// to t1, with a slow wobble so it doesn't read as a perfect circle. H is crest
// height in meters. The front ridge stands right behind the coastal pasture
// (the classic Kualoa cliff wall you see from the beach); the back ridge closes
// the far side of the valley. Both leave their ends open so you can walk
// around them into the valley.
export const RIDGES = [
  { name: 'Kualoa Pali', d: 1.66, t0: -62, t1: 48, H: 13, wob: 0.035, wobK: 3.1, phase: 0.4 },
  { name: "Ka'a'awa Ridge", d: 2.32, t0: -95, t1: 85, H: 11.5, wob: 0.045, wobK: 2.3, phase: 1.7 },
];

// Cross-section (meters from the ridge centerline).
const CREST = 1.0; // flat-ish crest half-width
const WALL = 4.2; // sheer cliff ends here
const SKIRT = 8.5; // gentle talus skirt ends here
export const RIDGE_COLLIDE = 4.4; // no-walk half-width (cliff base), used by islandLayout
const FLUTE_PERIOD = 2.6; // meters between the vertical grooves in the cliff face

function ridgeCenterD(r, thetaDeg) {
  return r.d + r.wob * Math.sin(thetaDeg * DEG * r.wobK + r.phase);
}

// Precompute ridge endpoints + lengths.
for (const r of RIDGES) {
  r.p0 = polarToDir(ridgeCenterD(r, r.t0), r.t0);
  r.p1 = polarToDir(ridgeCenterD(r, r.t1), r.t1);
  r.length = (r.t1 - r.t0) * DEG * Math.sin(r.d) * R; // arc length, meters
}

/** Point on a ridge centerline at azimuth theta (degrees) -> unit direction. */
export function ridgePoint(r, thetaDeg) {
  return polarToDir(ridgeCenterD(r, thetaDeg), thetaDeg);
}

function smooth01(t) {
  return t * t * (3 - 2 * t);
}
function smoothstep(a, b, x) {
  return smooth01(THREE.MathUtils.clamp((x - a) / (b - a), 0, 1));
}

/**
 * Evaluate one ridge at (dir, polar). Returns { h, wall, flute, dist } where
 * dist is meters from the centerline, wall is 0..1 "on the cliff face".
 */
function evalRidge(r, dir, d, theta) {
  let dist;
  const inside = theta >= r.t0 && theta <= r.t1;
  const tc = inside ? theta : theta < r.t0 ? r.t0 : r.t1;
  if (inside) {
    dist = Math.abs(d - ridgeCenterD(r, theta)) * R;
  } else {
    const end = theta < r.t0 ? r.p0 : r.p1;
    dist = Math.acos(THREE.MathUtils.clamp(dir.dot(end), -1, 1)) * R;
  }
  if (dist >= SKIRT) return { h: 0, wall: 0, flute: 0, dist };

  const along = (tc - r.t0) * DEG * Math.sin(r.d) * R; // meters along the ridge
  // Jagged crest: two incommensurate sines along the ridge.
  let H = r.H * (1 + 0.14 * Math.sin(along * 0.55 + r.phase) + 0.09 * Math.sin(along * 1.37 + 2 * r.phase));
  // Ends taper into dramatic prows rather than vanishing.
  H *= 0.45 + 0.55 * smoothstep(0, 6, along) * smoothstep(0, 6, r.length - along);

  const wall = 1 - smooth01(THREE.MathUtils.clamp((dist - CREST) / (WALL - CREST), 0, 1));
  const skirt = 1 - smooth01(THREE.MathUtils.clamp((dist - CREST) / (SKIRT - CREST), 0, 1));
  // Vertical flutes: grooves carved into the middle of the cliff face.
  const flute = 0.5 + 0.5 * Math.cos((along * 2 * Math.PI) / FLUTE_PERIOD);
  const midWall = 4 * wall * (1 - wall); // 0 at crest & foot, 1 mid-face
  const h = H * (0.82 * wall + 0.18 * skirt) - H * 0.16 * flute * midWall;
  return { h: Math.max(0, h), wall: midWall, flute: flute * midWall, dist };
}

// --- Far-side peak ---------------------------------------------------------
// A tall green peak (Pu'u Kānehoalani-ish) at the antipode of the ocean —
// walkable, for a view back over the whole island.
export const PEAK_DIR = OCEAN_DIR.clone().negate();
export const PEAK = dirToLatLon(PEAK_DIR);
const PEAK_AMP = 12;
const PEAK_SIGMA = 0.36;

/** Low rolling ranch pasture — always >= 0. */
function pasture(dir) {
  const p =
    0.6 +
    0.5 * Math.sin(dir.x * 9.1) * Math.sin(dir.y * 8.3) * Math.sin(dir.z * 7.7) +
    0.35 * Math.sin(dir.x * 15.3 + dir.z * 3.0) * Math.sin(dir.y * 13.7);
  return Math.max(0, p);
}

function landHeight(dir, d, theta) {
  let h = pasture(dir);
  let ridge = 0;
  for (const r of RIDGES) {
    // cheap reject: ridges only live in a band of d
    if (Math.abs(d - r.d) * R > SKIRT + r.wob * R + 1 && theta >= r.t0 && theta <= r.t1) continue;
    ridge = Math.max(ridge, evalRidge(r, dir, d, theta).h);
  }
  h += ridge;
  // Peak: angular distance from the antipode is simply (PI - d).
  const t = (Math.PI - d) / PEAK_SIGMA;
  if (t < 3) {
    // slight radial ribbing so it reads craggy, not a smooth gaussian bump
    const rib = 1 + 0.08 * Math.sin(theta * DEG * 11);
    h += PEAK_AMP * Math.exp(-t * t) * rib;
  }
  return h;
}

/** Height above PLANET_RADIUS at unit direction `dir`. */
export function terrainHeight(dir) {
  const { d, theta } = oceanPolar(dir);
  // Water is flat at 0; the sand steps up just past the shoreline and stays
  // nearly flat across the beach (the villa-style flat mask), then the land
  // eases in with a smoothstep ramp.
  const beach =
    BEACH_HEIGHT * smoothstep(SHORE - 0.02, SHORE + 0.04, d) +
    BEACH_RISE * smoothstep(SHORE + 0.04, BEACH_END, d);
  const landT = smoothstep(BEACH_END, LAND_FULL, d);
  if (landT === 0) return beach;
  return beach + landT * landHeight(dir, d, theta);
}

/** Meters from `dir` to the nearest ridge centerline (Infinity if far). */
export function ridgeDistance(dir) {
  const { d, theta } = oceanPolar(dir);
  let min = Infinity;
  for (const r of RIDGES) min = Math.min(min, evalRidge(r, dir, d, theta).dist);
  return min;
}

/**
 * Coast color-blend factors (0..1) for the planet vertex colors:
 *   water   — 1 in the lagoon/ocean, 0 on land
 *   deep    — shallow turquoise -> deep blue toward the ocean center
 *   reef    — darker coral-reef patches in the shallows
 *   foam    — white surf line at the water's edge + a broken reef-break line
 *   sand    — the beach band (fades into grass at the back of the beach)
 *   wet     — darker wet sand just above the waterline
 */
export function coastFactors(dir) {
  const { d, theta } = oceanPolar(dir);
  const water = 1 - smoothstep(SHORE - 0.012, SHORE + 0.004, d);
  const deep = 1 - smoothstep(0.28, 0.7, d);
  const n1 = Math.sin(dir.x * 31.0 + dir.z * 17.0) * Math.sin(dir.y * 27.0 - dir.x * 11.0);
  const n2 = Math.sin(theta * DEG * 23.0 + d * 40.0);
  const reef = smoothstep(0.25, 0.6, n1) * smoothstep(0.5, 0.62, d) * (1 - smoothstep(0.8, 0.86, d));
  const surf = 1 - smoothstep(0.006, 0.022, Math.abs(d - (SHORE - 0.012)));
  const reefBreak = (1 - smoothstep(0.004, 0.016, Math.abs(d - 0.47))) * smoothstep(0.1, 0.5, n2);
  const foam = Math.max(surf, reefBreak * 0.85);
  const sand = (1 - water) * (1 - smoothstep(BEACH_END - 0.03, BEACH_END + 0.07, d));
  const wet = (1 - water) * (1 - smoothstep(SHORE + 0.01, SHORE + 0.045, d));
  return { water, deep, reef, foam, sand, wet };
}

/**
 * Cliff color factors: `wall` (0..1, mid cliff face) and `flute` (the groove
 * mask on the face) — used to paint the pali darker jungle-green with red-dirt
 * grooves, like Kualoa's fluted walls.
 */
export function cliffFactors(dir) {
  const { d, theta } = oceanPolar(dir);
  let wall = 0;
  let flute = 0;
  for (const r of RIDGES) {
    const e = evalRidge(r, dir, d, theta);
    if (e.wall > wall) {
      wall = e.wall;
      flute = e.flute;
    }
  }
  return { wall, flute };
}
