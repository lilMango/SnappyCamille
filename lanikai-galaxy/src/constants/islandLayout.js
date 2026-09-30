import { PLANET_RADIUS } from './worldConfig';
import {
  OCEAN,
  SHORE,
  BEACH_END,
  RIDGES,
  RIDGE_COLLIDE,
  ridgePoint,
  ridgeDistance,
  polarToDir,
  PEAK_DIR,
  OCEAN_DIR,
} from '../utils/terrain';
import { dirToLatLon, latLonToDir, angularDistance, yawToward } from '../utils/sphere';

// Convert an offset in surface-meters (north, east) from the spawn on the beach
// (lat 0, lon 0) into a {lat, lon} in degrees for anchoring scattered props.
const DEG = 180 / Math.PI;
export function offset(northMeters, eastMeters) {
  return {
    lat: (northMeters / PLANET_RADIUS) * DEG,
    lon: (eastMeters / PLANET_RADIUS) * DEG,
  };
}

// No-walk zones. RECT_COLLIDERS are axis-aligned rectangles in spawn-local
// surface meters (north/east from lat0,lon0) — kept for parity with
// camille-galaxy's walker, but nothing on the island needs one yet.
// CIRCLE_COLLIDERS are { lat, lon, radius (radians) }.
export const RECT_COLLIDERS = [];

export const CIRCLE_COLLIDERS = (() => {
  const out = [];
  // The ocean: one big cap. Its radius sits a hair inside the waterline so she
  // can stand in the surf, but never wade out (the islets stay backdrop-only).
  out.push({ ...OCEAN, radius: SHORE - 0.015 });

  // Cliff bases: a chain of circles along each ridge centerline (~2m apart),
  // each RIDGE_COLLIDE meters in radius — the union is a capsule hugging the
  // foot of the pali, so the walker slides along the cliff instead of climbing.
  for (const r of RIDGES) {
    const n = Math.max(2, Math.ceil(r.length / 2));
    for (let i = 0; i <= n; i++) {
      const theta = r.t0 + ((r.t1 - r.t0) * i) / n;
      out.push({ ...dirToLatLon(ridgePoint(r, theta)), radius: RIDGE_COLLIDE / PLANET_RADIUS });
    }
  }
  return out;
})();

// Deterministic 0..1 hash (stable across reloads).
function hash(i) {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

const SPAWN_DIR = latLonToDir(0, 0);

/**
 * Tree scatter: { lat, lon, kind: 'palm' | 'ironwood', scale, yaw }.
 * - Palms crowd the back of the beach / edge of the pasture (the
 *   beach -> valley transition), leaning out toward the water.
 * - Ironwoods form a loose windbreak line just behind the palms (like the
 *   casuarinas lining Lanikai), with a few more dotted into the valley.
 * - A handful of palms on the far-side uplands around the peak.
 * Trees stay off the cliffs (ridgeDistance) and out of the spawn's face.
 */
export const TREES = (() => {
  const out = [];
  let idx = 0;
  const push = (d, theta, kind, jitterD, jitterT) => {
    idx++;
    const h1 = hash(idx);
    const h2 = hash(idx + 991);
    const h3 = hash(idx + 4513);
    const dd = d + (h1 - 0.5) * jitterD;
    const tt = theta + (h2 - 0.5) * jitterT;
    const dir = polarToDir(dd, tt);
    if (ridgeDistance(dir) < 7) return; // not on the pali
    if (angularDistance(dir, SPAWN_DIR) * PLANET_RADIUS < 9.5) return; // keep the spawn + camera clear
    const ll = dirToLatLon(dir);
    out.push({
      lat: ll.lat,
      lon: ll.lon,
      kind,
      scale: kind === 'palm' ? 0.85 + h3 * 0.45 : 0.9 + h3 * 0.35,
      // Palms near the bay lean out over the water (an Anchor's local +Z
      // points along `yaw`, and the palm model leans toward +Z); everything
      // else just gets a random spin.
      yaw:
        kind === 'palm' && dd < BEACH_END + 0.25
          ? yawToward(dir, OCEAN_DIR) + (h2 - 0.5) * 50
          : h3 * 360,
    });
  };

  // Palm fringe: two staggered rows at the back of the sand + one looser row
  // in the pasture, all the way around the bay.
  for (let theta = -180; theta < 180; theta += 7) {
    if (hash(theta + 100) > 0.25) push(BEACH_END + 0.02, theta, 'palm', 0.04, 5);
    if (hash(theta + 300) > 0.35) push(BEACH_END + 0.1, theta + 3.5, 'palm', 0.05, 5);
    if (hash(theta + 700) > 0.6) push(BEACH_END + 0.22, theta + 1.5, 'palm', 0.08, 6);
  }
  // Ironwood windbreak behind the palms.
  for (let theta = -180; theta < 180; theta += 11) {
    if (hash(theta + 1200) > 0.3) push(BEACH_END + 0.32, theta, 'ironwood', 0.1, 7);
  }
  // Scattered trees on the valley floor between the two ridges.
  for (let theta = -150; theta < 150; theta += 14) {
    if (hash(theta + 2100) > 0.45) push(1.99, theta, hash(theta + 5) > 0.5 ? 'ironwood' : 'palm', 0.1, 8);
  }
  // Far-side uplands: a loose ring of palms around the peak.
  for (let theta = -180; theta < 180; theta += 24) {
    push(2.55, theta, 'palm', 0.12, 10);
  }
  return out;
})();

// Offshore landmark islets (backdrop only — they sit in the blocked ocean).
// Mokoli'i ("Chinaman's Hat") is the steep cone; Na Mokulua are the twin
// rounded islets off Lanikai.
export const ISLETS = [
  { ...dirToLatLon(polarToDir(0.36, 55)), kind: 'mokolii' },
  { ...dirToLatLon(polarToDir(0.4, -30)), kind: 'mokunui' },
  { ...dirToLatLon(polarToDir(0.42, -48)), kind: 'mokuiki' },
];

export const PEAK_LATLON = dirToLatLon(PEAK_DIR);
