import { B } from '../constants/blocks';
import { GROUND_Y } from '../constants/worldConfig';
import * as C from '../constants/cityConfig';
import { mulberry32, hash3 } from './rng';
import { ARCHETYPES } from './cityBuild';

/**
 * The city generator. Deterministic (same seed -> byte-identical world) and pure: it writes
 * into a VoxelWorld, so it runs in the generation Web Worker, in bun tests and in the
 * benchmark unchanged.
 *
 *   generateCity(world, { seed, onProgress }) -> { lotMap, buildings, anchors, stats }
 *
 * Output besides the voxels:
 *   lotMap     Uint16Array(SIZE*SIZE)  building id per (x, z) column, 0 = none. Buildings are
 *              vertical prisms, so this replaces a per-voxel id array (used for scoring now
 *              and for collapse in phase 10).
 *   buildings  [{ id, x0,z0,x1,z1, y0, y1, floors, archetype, district }]
 *   anchors    Int16Array of (x, y, z) triples: roof corners, for the phase-5 grapple assist.
 */

const { SIZE } = C;
const N = SIZE - 1;

// ---- small drawing helpers --------------------------------------------------------

function line3d(world, ax, ay, az, bx, by, bz, id) {
  const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), Math.abs(bz - az), 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    world.setBlock(Math.round(ax + (bx - ax) * t), Math.round(ay + (by - ay) * t), Math.round(az + (bz - az) * t), id);
  }
}

const ROAD_END_X = C.LAND_END; // roads run to the seawall

// ---- ground ---------------------------------------------------------------------

function ground(world) {
  world.fillBox(0, 0, 0, N, 2, N, B.BEDROCK);
  world.fillBox(0, 3, 0, N, C.BAY_FLOOR_Y, N, B.STONE); // everything, up to the bay floor
  // land (and the 2-wide seawall strip): up to street level
  const landX1 = C.BAY_X0 - 1;
  world.fillBox(0, C.BAY_FLOOR_Y + 1, 0, landX1, GROUND_Y - 4, N, B.STONE);
  world.fillBox(0, GROUND_Y - 3, 0, landX1, GROUND_Y - 1, N, B.DIRT);
  world.fillBox(0, GROUND_Y, 0, landX1, GROUND_Y, N, B.CONCRETE);
}

// ---- roads ----------------------------------------------------------------------

function roads(world) {
  for (let k = 0; k < C.AVENUES; k++) {
    const x = C.AVENUE_PERIOD * k;
    world.fillBox(x, C.ROAD_Y, 0, x + C.AVENUE_W - 1, C.ROAD_Y, N, B.ASPHALT);
  }
  for (let m = 0; m < C.STREETS; m++) {
    const z = C.STREET_PERIOD * m;
    world.fillBox(0, C.ROAD_Y, z, ROAD_END_X, C.ROAD_Y, z + C.STREET_W - 1, B.ASPHALT);
  }
  // centre lines: double yellow down the avenues, dashed along the streets; none through junctions
  for (let k = 0; k < C.AVENUES; k++) {
    const x = C.AVENUE_PERIOD * k + 4;
    for (let z = 0; z <= N; z++) {
      if (C.isStreetZ(z)) continue;
      world.setBlock(x, C.ROAD_Y, z, B.ASPHALT_LINE);
      world.setBlock(x + 1, C.ROAD_Y, z, B.ASPHALT_LINE);
    }
  }
  for (let m = 0; m < C.STREETS; m++) {
    const z = C.STREET_PERIOD * m + 3;
    for (let x = 0; x <= ROAD_END_X; x++) {
      if (C.isAvenueX(x) || x % 8 > 4) continue;
      world.setBlock(x, C.ROAD_Y, z, B.ASPHALT_LINE_X);
      world.setBlock(x, C.ROAD_Y, z + 1, B.ASPHALT_LINE_X);
    }
  }
  // zebra crossings on all four arms of every junction
  for (let k = 0; k < C.AVENUES; k++) {
    for (let m = 0; m < C.STREETS; m++) {
      const ax = C.AVENUE_PERIOD * k;
      const sz = C.STREET_PERIOD * m;
      if (m > 0) world.fillBox(ax, C.ROAD_Y, sz - 3, ax + C.AVENUE_W - 1, C.ROAD_Y, sz - 1, B.CROSSWALK_Z);
      if (sz + C.STREET_W + 2 <= N) world.fillBox(ax, C.ROAD_Y, sz + C.STREET_W, ax + C.AVENUE_W - 1, C.ROAD_Y, sz + C.STREET_W + 2, B.CROSSWALK_Z);
      if (k > 0) world.fillBox(ax - 3, C.ROAD_Y, sz, ax - 1, C.ROAD_Y, sz + C.STREET_W - 1, B.CROSSWALK_X);
      if (ax + C.AVENUE_W + 2 <= ROAD_END_X) world.fillBox(ax + C.AVENUE_W, C.ROAD_Y, sz, ax + C.AVENUE_W + 2, C.ROAD_Y, sz + C.STREET_W - 1, B.CROSSWALK_X);
    }
  }
}

// ---- blocks: raised sidewalk ring + lot ground --------------------------------------

function blockGround(world, blocks) {
  for (const R of blocks) {
    const sw = C.SIDEWALK_W;
    world.fillBox(R.x0 - sw, C.BASE_Y, R.z0 - sw, R.x1 + sw, C.BASE_Y, R.z1 + sw, B.SIDEWALK);
    world.fillBox(R.x0, C.BASE_Y, R.z0, R.x1, C.BASE_Y, R.z1, B.CONCRETE);
  }
}

// street lamps along each block's outer sidewalk edge, with an arm over the road
function streetLights(world, blocks) {
  const sw = C.SIDEWALK_W;
  const pole = (x, z, dx, dz) => {
    world.fillBox(x, C.BASE_Y + 1, z, x, C.BASE_Y + 5, z, B.STEEL);
    world.setBlock(x + dx, C.BASE_Y + 5, z + dz, B.STEEL);
    world.setBlock(x + dx, C.BASE_Y + 4, z + dz, B.GLASS_LIT);
  };
  for (const R of blocks) {
    const x0 = R.x0 - sw;
    const x1 = R.x1 + sw;
    const z0 = R.z0 - sw;
    const z1 = R.z1 + sw;
    for (let x = x0 + 4; x <= x1 - 4; x += 12) {
      pole(x, z0, 0, -1);
      pole(x, z1, 0, 1);
    }
    for (let z = z0 + 4; z <= z1 - 4; z += 12) {
      pole(x0, z, -1, 0);
      if (x1 <= C.LAND_END - 1) pole(x1, z, 1, 0);
    }
  }
}

// ---- the park ---------------------------------------------------------------------

const onPath = (x, z, margin = 0) =>
  (x >= C.PATH_X[0] - margin && x <= C.PATH_X[1] + margin) || (z >= C.PATH_Z[0] - margin && z <= C.PATH_Z[1] + margin);
const distToCentre = (x, z) => Math.hypot(x + 0.5 - C.PARK_CENTER.x, z + 0.5 - C.PARK_CENTER.z);

function park(world, seed) {
  const P = C.PARK;
  world.fillBox(P.x0, GROUND_Y, P.z0, P.x1, GROUND_Y, P.z1, B.GRASS);

  // paved: the two paths, the central plaza, and a promenade round the edge
  for (let z = P.z0; z <= P.z1; z++) {
    for (let x = P.x0; x <= P.x1; x++) {
      const edge = x <= P.x0 + 1 || x >= P.x1 - 1 || z <= P.z0 + 1 || z >= P.z1 - 1;
      if (edge || onPath(x, z) || distToCentre(x, z) <= C.PLAZA_R) world.setBlock(x, GROUND_Y, z, B.SIDEWALK);
    }
  }

  // fountain: stone rim, recessed pool, a lit spout
  const cx = C.PARK_CENTER.x;
  const cz = C.PARK_CENTER.z;
  for (let z = cz - 7; z <= cz + 6; z++) {
    for (let x = cx - 7; x <= cx + 6; x++) {
      const d = distToCentre(x, z);
      if (d > 5 && d <= C.FOUNTAIN_R) world.fillBox(x, GROUND_Y, z, x, GROUND_Y + 1, z, B.STONE);
      else if (d <= 5) world.setBlock(x, GROUND_Y, z, B.POOL);
    }
  }
  world.fillBox(cx - 1, GROUND_Y + 1, cz - 1, cx, GROUND_Y + 4, cz, B.STEEL);
  world.fillBox(cx - 1, GROUND_Y + 5, cz - 1, cx, GROUND_Y + 5, cz, B.GLASS_LIT);

  // lamps and benches along the paths
  for (let z = P.z0 + 4; z <= P.z1 - 4; z += 9) {
    if (distToCentre(C.PATH_X[0] - 1, z) < C.PLAZA_R + 1) continue;
    for (const x of [C.PATH_X[0] - 1, C.PATH_X[1] + 1]) {
      world.fillBox(x, GROUND_Y + 1, z, x, GROUND_Y + 4, z, B.STEEL);
      world.setBlock(x, GROUND_Y + 5, z, B.GLASS_LIT);
    }
  }
  for (let z = P.z0 + 8; z <= P.z1 - 8; z += 14) {
    if (distToCentre(C.PATH_X[0] - 2, z) < C.PLAZA_R + 2) continue;
    for (const [x, back] of [[C.PATH_X[0] - 2, -1], [C.PATH_X[1] + 2, 1]]) {
      world.fillBox(x, GROUND_Y + 1, z, x, GROUND_Y + 1, z + 2, B.PLANKS);
      world.fillBox(x + back, GROUND_Y + 1, z, x + back, GROUND_Y + 2, z + 2, B.FENCE);
    }
  }

  // trees: log + a blob of cutout leaves, scattered by hash, kept off paths, plaza and each other
  const trees = [];
  for (let i = 0; i < 160 && trees.length < 64; i++) {
    const x = P.x0 + 4 + Math.floor(hash3(i, 1, 0, seed) * (P.x1 - P.x0 - 8));
    const z = P.z0 + 4 + Math.floor(hash3(i, 2, 0, seed) * (P.z1 - P.z0 - 8));
    if (onPath(x, z, 4) || distToCentre(x, z) < C.PLAZA_R + 4) continue; // canopies must clear a player's head
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 5)) continue;
    trees.push({ x, z });
    const h = 4 + Math.floor(hash3(i, 3, 0, seed) * 3);
    const r = 2.4 + hash3(i, 4, 0, seed) * 0.9;
    world.fillBox(x, GROUND_Y + 1, z, x, GROUND_Y + h, z, B.LOG);
    const top = GROUND_Y + h;
    for (let dy = -2; dy <= 3; dy++) {
      for (let dz = -3; dz <= 3; dz++) {
        for (let dx = -3; dx <= 3; dx++) {
          if (Math.hypot(dx, dy * 1.2, dz) > r) continue;
          const lx = x + dx;
          const ly = top + dy;
          const lz = z + dz;
          if (world.getBlock(lx, ly, lz) === B.AIR) world.setBlock(lx, ly, lz, B.LEAVES);
        }
      }
    }
  }
  return trees.length;
}

// ---- bay, seawall, harbour island, bridge ------------------------------------------

function bay(world) {
  // seawall strip: promenade + a chest-high parapet on the water side, bollards, a gap for the bridge
  const x0 = C.LAND_END + 1;
  world.fillBox(x0, GROUND_Y, 0, C.BAY_X0 - 1, GROUND_Y, N, B.SIDEWALK);
  world.fillBox(C.BAY_X0 - 1, GROUND_Y + 1, 3, C.BAY_X0 - 1, GROUND_Y + 1, N - 3, B.STONE);
  for (let z = 8; z < N - 8; z += 8) world.fillBox(C.BAY_X0 - 1, GROUND_Y + 2, z, C.BAY_X0 - 1, GROUND_Y + 3, z, B.STEEL);
  world.fillBox(x0, GROUND_Y, C.BRIDGE.z0, C.BAY_X0 - 1, GROUND_Y + 3, C.BRIDGE.z1, B.AIR); // bridge opening
  world.fillBox(x0, GROUND_Y, C.BRIDGE.z0, C.BAY_X0 - 1, GROUND_Y, C.BRIDGE.z1, B.ASPHALT);

  // harbour island
  const I = C.ISLAND;
  world.fillBox(I.x0, C.BAY_FLOOR_Y + 1, I.z0, I.x1, GROUND_Y - 1, I.z1, B.STONE);
  world.fillBox(I.x0, GROUND_Y, I.z0, I.x1, GROUND_Y, I.z1, B.CONCRETE);
  // lighthouse
  const lx = 376;
  const lz = (I.z0 + I.z1) >> 1;
  world.fillBox(lx - 3, GROUND_Y + 1, lz - 3, lx + 3, GROUND_Y + 4, lz + 3, B.CONCRETE_DARK);
  world.fillBox(lx - 2, GROUND_Y + 5, lz - 2, lx + 2, GROUND_Y + 15, lz + 2, B.CONCRETE_LIGHT);
  world.fillBox(lx - 1, GROUND_Y + 16, lz - 1, lx + 1, GROUND_Y + 19, lz + 1, B.GLASS_LIT);
  world.fillBox(lx - 2, GROUND_Y + 20, lz - 2, lx + 2, GROUND_Y + 20, lz + 2, B.CONCRETE_DARK);
  world.fillBox(lx, GROUND_Y + 21, lz, lx, GROUND_Y + 25, lz, B.STEEL);
  world.setBlock(lx, GROUND_Y + 26, lz, B.NEON_PINK);
}

function bridge(world) {
  const Br = C.BRIDGE;
  const yDeck = GROUND_Y;
  // deck: road lanes, centre dashes, lit sidewalks, rails
  world.fillBox(Br.x0, yDeck, Br.z0, Br.x1, yDeck, Br.z1, B.ASPHALT);
  world.fillBox(Br.x0, yDeck - 1, Br.z0, Br.x1, yDeck - 1, Br.z1, B.STEEL); // under-beams
  for (const zs of [[Br.z0, Br.z0 + 1], [Br.z1 - 1, Br.z1]]) world.fillBox(Br.x0, yDeck, zs[0], Br.x1, yDeck, zs[1], B.CONCRETE_LIGHT);
  for (let x = Br.x0; x <= Br.x1; x++) {
    if (x % 8 > 4) continue;
    world.setBlock(x, yDeck, 195, B.ASPHALT_LINE_X);
    world.setBlock(x, yDeck, 196, B.ASPHALT_LINE_X);
  }
  world.fillBox(Br.x0 + 2, yDeck + 1, Br.z0, Br.x1, yDeck + 1, Br.z0, B.FENCE);
  world.fillBox(Br.x0 + 2, yDeck + 1, Br.z1, Br.x1, yDeck + 1, Br.z1, B.FENCE);
  for (let x = Br.x0 + 4; x <= Br.x1; x += 8) {
    for (const z of [Br.z0, Br.z1]) world.setBlock(x, yDeck + 2, z, B.GLASS_LIT);
  }
  // piers under the deck
  for (const x of [340, 351, 357]) {
    for (const z of [194, 197]) world.fillBox(x, C.BAY_FLOOR_Y + 1, z, x + 1, yDeck - 2, z + 1, B.STEEL);
  }
  // towers: two legs each, cross-beams, cap
  for (const tx of Br.towerX) {
    for (const z of [Br.z0, Br.z1 - 1]) world.fillBox(tx, C.BAY_FLOOR_Y + 1, z, tx + 1, Br.towerTop, z + 1, B.STEEL);
    for (const y of [GROUND_Y + 30, Br.towerTop - 1]) world.fillBox(tx, y, Br.z0, tx + 1, y, Br.z1, B.STEEL);
    world.fillBox(tx, Br.towerTop + 1, Br.z0, tx + 1, Br.towerTop + 1, Br.z1, B.CONCRETE_DARK);
    for (const z of [Br.z0, Br.z1]) world.setBlock(tx, Br.towerTop + 2, z, B.NEON_PINK); // warning lights
  }
  // cables on both sides: back-stay, catenary main span, back-stay; suspenders down to the deck
  const [t1, t2] = Br.towerX;
  const yTop = Br.towerTop + 1;
  const mid = (t1 + t2) / 2;
  const half = (t2 - t1) / 2;
  const sagAt = (x) => Math.round(yTop - Br.sag * (1 - ((x - mid) / half) ** 2));
  for (const z of [Br.z0, Br.z1]) {
    for (const [ax, ay] of [[Br.anchorW.x, Br.anchorW.y], [Br.anchorE.x, Br.anchorE.y]]) {
      world.fillBox(ax, yDeck + 1, z, ax, ay, z, B.STEEL); // anchor post
    }
    line3d(world, Br.anchorW.x, Br.anchorW.y, z, t1, yTop, z, B.STEEL);
    line3d(world, t2 + 1, yTop, z, Br.anchorE.x, Br.anchorE.y, z, B.STEEL);
    for (let x = t1; x < t2; x++) {
      const y0 = sagAt(x);
      const y1 = sagAt(x + 1);
      line3d(world, x, y0, z, x + 1, y1, z, B.STEEL);
    }
    for (let x = t1 + 3; x < t2; x += 3) world.fillBox(x, yDeck + 2, z, x, sagAt(x) - 1, z, B.STEEL);
  }
}

// ---- the wall ---------------------------------------------------------------------

function perimeterWall(world) {
  const top = GROUND_Y + C.WALL_H;
  const x1 = C.BAY_X0 - 1;
  const mat = (x, y, z) => (hash3(x >> 2, y >> 2, z >> 2, 7) < 0.3 ? B.STONE : B.CONCRETE_DARK);
  const col = (x, z, merlon) => {
    for (let y = GROUND_Y + 1; y < top; y++) world.setBlock(x, y, z, mat(x, y, z));
    if (merlon) world.setBlock(x, top, z, mat(x, top, z));
  };
  for (let t = 0; t < C.WALL_THICK; t++) {
    for (let z = 0; z <= N; z++) col(t, z, ((z >> 1) & 1) === 0); // west
    for (let x = C.WALL_THICK; x <= x1; x++) {
      col(x, t, ((x >> 1) & 1) === 0); // north
      col(x, N - t, ((x >> 1) & 1) === 0); // south
    }
  }
}

// ---- lots ---------------------------------------------------------------------------

const wOf = (r) => r.x1 - r.x0 + 1;
const dOf = (r) => r.z1 - r.z0 + 1;
const MIN_LOT = 8;

function subdivide(r, rnd, level, out) {
  const w = wOf(r);
  const d = dOf(r);
  const canX = w >= 2 * MIN_LOT + 1;
  const canZ = d >= 2 * MIN_LOT + 1;
  let axis = null;
  if (level === 0) axis = canX ? 'x' : canZ ? 'z' : null;
  else if (level === 1) {
    if (canZ && d >= w * 0.9 && rnd() < 0.5) axis = 'z';
    else if (canX && rnd() < 0.3) axis = 'x';
  }
  if (!axis) {
    out.push(r);
    return;
  }
  const frac = 0.38 + rnd() * 0.24;
  if (axis === 'x') {
    const at = r.x0 + Math.floor(w * frac); // column `at` is an alley
    subdivide({ ...r, x1: at - 1 }, rnd, level + 1, out);
    subdivide({ ...r, x0: at + 1 }, rnd, level + 1, out);
  } else {
    const at = r.z0 + Math.floor(d * frac);
    subdivide({ ...r, z1: at - 1 }, rnd, level + 1, out);
    subdivide({ ...r, z0: at + 1 }, rnd, level + 1, out);
  }
}

function pickArchetype(district, lot, rnd) {
  const wts = C.ARCHETYPE_WEIGHTS[district];
  let r = rnd();
  let pick = 'lowShop';
  for (const [name, w] of Object.entries(wts)) {
    if (w <= 0) continue;
    if (r < w) {
      pick = name;
      break;
    }
    r -= w;
  }
  const w = wOf(lot);
  const d = dOf(lot);
  const small = Math.min(w, d);
  // archetypes have minimum footprints
  if (pick === 'podiumTower' && small < 14) pick = 'boxTower';
  if (pick === 'setbackDeco' && small < 15) pick = 'boxTower';
  if (pick === 'parkingDeck' && small < 11) pick = 'lowShop';
  if ((pick === 'boxTower' || pick === 'glassSlab') && small < 9) pick = 'brickWalkup';
  return pick;
}

function floorsFor(archetype, district, lot, rnd) {
  const [lo, hi] = C.HEIGHT_RANGE[district];
  const skew = rnd() ** 1.4;
  let floors = Math.round((lo + (hi - lo) * skew) / 4);
  if (archetype === 'lowShop') floors = 1 + Math.floor(rnd() * 2);
  else if (archetype === 'brickWalkup') floors = 3 + Math.floor(rnd() * 6);
  else if (archetype === 'parkingDeck') floors = 3 + Math.floor(rnd() * 4);
  else if (archetype === 'podiumTower') floors = Math.max(7, floors);
  else if (archetype === 'setbackDeco') floors = Math.max(12, floors);
  if (Math.min(wOf(lot), dOf(lot)) < 10 && archetype !== 'lowShop') floors = Math.min(floors, 10);
  const cap = Math.floor((C.MAX_TOP - 16 - C.BASE_Y) / 4);
  return Math.max(2, Math.min(cap, floors));
}

// ---- the whole city -------------------------------------------------------------------

export function generateCity(world, { seed = C.SEED, onProgress = () => {} } = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  world.beginBulk();
  const lotMap = new Uint16Array(SIZE * SIZE);
  const buildings = [];
  const anchors = [];
  const blocks = C.blockRects();

  onProgress('ground', 0.02);
  ground(world);
  onProgress('roads', 0.08);
  roads(world);
  onProgress('blocks', 0.14);
  blockGround(world, blocks);
  onProgress('park', 0.18);
  const trees = park(world, seed);
  onProgress('bay', 0.22);
  bay(world);
  bridge(world);
  onProgress('wall', 0.26);
  perimeterWall(world);

  // lots
  const lots = [];
  for (const R of blocks) {
    const rnd = mulberry32((seed ^ (R.k * 7919 + R.m * 104729)) >>> 0);
    const out = [];
    subdivide({ x0: R.x0 + 1, x1: R.x1 - 1, z0: R.z0 + 1, z1: R.z1 - 1 }, rnd, 0, out);
    for (const lot of out) lots.push({ ...lot, block: R });
  }
  // landmarks: the two roomiest lots nearest the park become art-deco spires
  const landmarks = new Set(
    lots
      .filter((l) => Math.min(wOf(l), dOf(l)) >= 15)
      .sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - C.PARK_CENTER.x, (a.z0 + a.z1) / 2 - C.PARK_CENTER.z) - Math.hypot((b.x0 + b.x1) / 2 - C.PARK_CENTER.x, (b.z0 + b.z1) / 2 - C.PARK_CENTER.z))
      .slice(0, 2),
  );

  // buildings
  const counts = {};
  let id = 0;
  for (let li = 0; li < lots.length; li++) {
    const lot = lots[li];
    if (wOf(lot) < MIN_LOT || dOf(lot) < MIN_LOT) continue;
    id++;
    const rnd = mulberry32((seed + id * 2654435761) >>> 0);
    const district = C.districtAt((lot.x0 + lot.x1) / 2, (lot.z0 + lot.z1) / 2);
    const archetype = landmarks.has(lot) ? 'setbackDeco' : pickArchetype(district, lot, rnd);
    let floors = floorsFor(archetype, district, lot, rnd);
    if (landmarks.has(lot)) floors = Math.max(floors, 20);

    // which side faces a street: any side that touches the block's edge
    const R = lot.block;
    const sides = [];
    if (lot.x0 === R.x0 + 1) sides.push('W');
    if (lot.x1 === R.x1 - 1) sides.push('E');
    if (lot.z0 === R.z0 + 1) sides.push('N');
    if (lot.z1 === R.z1 - 1) sides.push('S');
    const b = {
      id,
      facing: sides.length ? sides[Math.floor(rnd() * sides.length)] : 'S',
      district,
      lit: Math.floor(rnd() * 4),
      occ: 0.14 + rnd() * 0.32,
    };
    const rect = { x0: lot.x0, x1: lot.x1, z0: lot.z0, z1: lot.z1 };
    const top = ARCHETYPES[archetype](world, b, rect, floors, rnd);

    for (let z = rect.z0; z <= rect.z1; z++) lotMap.fill(id, z * SIZE + rect.x0, z * SIZE + rect.x1 + 1);
    buildings.push({ id, x0: rect.x0, z0: rect.z0, x1: rect.x1, z1: rect.z1, y0: C.BUILD_Y, y1: top, floors, archetype, district });
    counts[archetype] = (counts[archetype] || 0) + 1;
    if (top > C.BASE_Y + 12) {
      // roof corners for the grapple assist: the highest solid block of each footprint corner
      // (a setback tower's upper roof sits inside the lot, so the corner is lower than `top`)
      for (const [ax, az] of [[rect.x0, rect.z0], [rect.x1, rect.z0], [rect.x0, rect.z1], [rect.x1, rect.z1]]) {
        let ay = top + 2;
        while (ay > C.BASE_Y + 8 && !world.isSolid(ax, ay, az)) ay--;
        if (ay > C.BASE_Y + 8) anchors.push(ax, ay, az);
      }
    }
    if (li % 8 === 0) onProgress('buildings', 0.26 + 0.6 * (li / lots.length));
  }

  onProgress('lights', 0.9);
  streetLights(world, blocks);
  onProgress('finishing', 0.96);
  world.endBulk();

  // Original voxel count per building (for destruction: a building below 35% of this collapses).
  // Counted here, in the generation worker, so the main thread never has to scan the city.
  for (const b of buildings) {
    let n = 0;
    for (let z = b.z0; z <= b.z1; z++) {
      for (let x = b.x0; x <= b.x1; x++) {
        for (let y = C.BUILD_Y; y <= b.y1 + 30; y++) if (world.getBlock(x, y, z) !== B.AIR) n++;
      }
    }
    b.voxelsOrig = n;
  }

  const t1 = typeof performance !== 'undefined' ? performance.now() : 0;
  return {
    lotMap,
    buildings,
    anchors: Int16Array.from(anchors),
    stats: { genMs: t1 - t0, buildings: buildings.length, trees, blocks: blocks.length, archetypes: counts },
  };
}
