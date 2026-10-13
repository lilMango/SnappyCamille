import { GROUND_Y } from './worldConfig';

// The city layout. Everything the generator, the loader, the spawn logic and the tests need
// to agree on lives here. Pure data + tiny helpers: no THREE, importable from workers.
//
//   x ->  avenue k covers [48k, 48k+9] (k = 0..6); each block's lots start 12 in
//   z \   street m covers [32m, 32m+7] (m = 0..11); each block's lots start 10 in
//         2-wide raised sidewalks ring every block; lots are inset a further block
//
//   west / north / south edges: a 3-thick perimeter wall (Wall Maria)
//   east edge: seawall + the bay, a bridge on street m=6 to a harbour island

export const SIZE = 384; // blocks per side (24 chunks)
export const SEED = 1954;

export const AVENUE_PERIOD = 48;
export const AVENUE_W = 10;
export const AVENUES = 7; // k = 0..6
export const STREET_PERIOD = 32;
export const STREET_W = 8;
export const STREETS = 12; // m = 0..11
export const SIDEWALK_W = 2;

// the raised sidewalk / lot layer sits one block above the road surface
export const ROAD_Y = GROUND_Y; // asphalt cells
export const BASE_Y = GROUND_Y + 1; // sidewalk + lot ground cells
export const BUILD_Y = GROUND_Y + 2; // first cell of a building's walls
export const MAX_TOP = 126; // nothing (spire tips included) may reach above this

export const LAND_END = 335; // last land x; the seawall is 336..337
export const WALL_THICK = 3;
export const WALL_H = 28;

// Central park: the arena. Replaces the 2x2 blocks and the avenue/street between them.
// (it includes the 2-wide sidewalk rings of the swallowed blocks, so its edges meet the avenues/streets)
export const PARK = { x0: 154, x1: 239, z0: 168, z1: 223 };
export const PARK_CENTER = { x: 197, z: 196 }; // centre of the fountain and of both paths
export const PATH_X = [194, 199]; // the north-south path (6 wide, centred on x = 197)
export const PATH_Z = [193, 198]; // the east-west path (6 wide, centred on z = 196)
export const FOUNTAIN_R = 6;
export const PLAZA_R = 13;

// Player spawn: on the park's north-south path, 13 blocks south of the fountain, facing it (yaw 0 looks toward -z).
// Feet y = the top face of the path (a road-level cell at GROUND_Y), i.e. GROUND_Y + 1 = BASE_Y.
export const CITY_SPAWN = { x: 197, y: BASE_Y + 0.01, z: 209, yaw: 0 };

// Bay
export const SEA_Y = GROUND_Y - 3; // water surface height (top of the last water cell)
export const BAY_FLOOR_Y = 8; // top cell of the bay floor
export const BAY_X0 = 338;
export const ISLAND = { x0: 366, x1: 383, z0: 168, z1: 222 };

// Bridge: street m=6 continues over the water to the island.
export const BRIDGE = {
  z0: 192,
  z1: 199,
  x0: 336,
  x1: 365,
  towerX: [346, 362],
  towerTop: GROUND_Y + 55,
  anchorW: { x: 326, y: GROUND_Y + 4 },
  anchorE: { x: 380, y: GROUND_Y + 4 },
  sag: 22,
};

// ---- grid helpers -------------------------------------------------------------

export const isAvenueX = (x) => x <= LAND_END && x % AVENUE_PERIOD < AVENUE_W;
export const isStreetZ = (z) => z % STREET_PERIOD < STREET_W;

export const inPark = (x, z) => x >= PARK.x0 && x <= PARK.x1 && z >= PARK.z0 && z <= PARK.z1;

/** Every city block's lot rectangle (before the 1-block inset), minus the 4 swallowed by the park. */
export function blockRects() {
  const out = [];
  for (let k = 0; k < AVENUES; k++) {
    for (let m = 0; m < STREETS; m++) {
      const r = {
        k,
        m,
        x0: AVENUE_PERIOD * k + AVENUE_W + SIDEWALK_W,
        x1: AVENUE_PERIOD * (k + 1) - SIDEWALK_W - 1,
        z0: STREET_PERIOD * m + STREET_W + SIDEWALK_W,
        z1: STREET_PERIOD * (m + 1) - SIDEWALK_W - 1,
      };
      r.z1 = Math.min(r.z1, SIZE - WALL_THICK - 3); // keep clear of the south wall
      if (r.x1 > LAND_END - SIDEWALK_W) r.x1 = LAND_END - SIDEWALK_W;
      // the whole block (lots + sidewalk ring) inside the park -> the park replaces it
      if (inPark(r.x0 - SIDEWALK_W, r.z0 - SIDEWALK_W) && inPark(r.x1 + SIDEWALK_W, r.z1 + SIDEWALK_W)) continue;
      out.push(r);
    }
  }
  return out;
}

export function districtAt(x, z) {
  if (x >= 296) return 'waterfront';
  const d = Math.hypot(x - PARK_CENTER.x, z - PARK_CENTER.z);
  if (d < 85) return 'downtown';
  if (d < 160) return 'midtown';
  return 'outskirts';
}

export const HEIGHT_RANGE = {
  downtown: [48, 88],
  midtown: [30, 66],
  outskirts: [12, 36],
  waterfront: [14, 44],
};

export const ARCHETYPE_WEIGHTS = {
  downtown: { podiumTower: 0.3, glassSlab: 0.25, boxTower: 0.25, setbackDeco: 0.15, brickWalkup: 0.0, parkingDeck: 0.03, lowShop: 0.02 },
  midtown: { boxTower: 0.25, glassSlab: 0.2, podiumTower: 0.15, brickWalkup: 0.2, setbackDeco: 0.05, parkingDeck: 0.1, lowShop: 0.05 },
  outskirts: { brickWalkup: 0.35, lowShop: 0.3, parkingDeck: 0.15, boxTower: 0.15, glassSlab: 0.05, podiumTower: 0, setbackDeco: 0 },
  waterfront: { boxTower: 0.25, lowShop: 0.25, parkingDeck: 0.1, glassSlab: 0.2, brickWalkup: 0.2, podiumTower: 0, setbackDeco: 0 },
};
