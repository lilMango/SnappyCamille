import { describe, test, expect, beforeAll } from 'bun:test';
import { VoxelWorld } from './voxelWorld';
import { generateCity } from './cityGen';
import { createBody, moveBody } from './physics';
import * as C from '../constants/cityConfig';
import { B, SOLID } from '../constants/blocks';
import { GROUND_Y, SECTIONS } from '../constants/worldConfig';
import { PLAYER } from '../constants/playerConfig';

let world;
let city;

// FNV-1a over every section's bytes, in a stable column order
function checksum(w) {
  let h = 2166136261;
  const keys = [...w.columns.keys()].sort((a, b) => a - b);
  for (const k of keys) {
    const col = w.columns.get(k);
    for (let sy = 0; sy < SECTIONS; sy++) {
      const sec = col.sections[sy];
      if (!sec) continue;
      h = Math.imul(h ^ (k * 4 + sy), 16777619);
      for (let i = 0; i < sec.length; i += 7) h = Math.imul(h ^ sec[i], 16777619);
    }
  }
  return h >>> 0;
}

beforeAll(() => {
  world = new VoxelWorld();
  city = generateCity(world, {});
});

describe('city generator', () => {
  test('is deterministic: the same seed gives a byte-identical world, another seed does not', () => {
    const again = new VoxelWorld();
    generateCity(again, {});
    expect(checksum(again)).toBe(checksum(world));
    const other = new VoxelWorld();
    generateCity(other, { seed: 7 });
    expect(checksum(other)).not.toBe(checksum(world));
  });

  test('builds a real city: lots of buildings, every archetype, trees', () => {
    expect(city.buildings.length).toBeGreaterThan(150);
    for (const a of ['lowShop', 'boxTower', 'brickWalkup', 'glassSlab', 'parkingDeck', 'podiumTower', 'setbackDeco']) {
      expect(city.stats.archetypes[a]).toBeGreaterThan(0);
    }
    expect(city.stats.trees).toBeGreaterThan(20);
  });

  test('nothing rises above the height ceiling, spires included', () => {
    let top = 0;
    for (const col of world.columns.values()) for (let i = 0; i < 256; i++) top = Math.max(top, col.heightTop[i]);
    expect(top).toBeLessThanOrEqual(C.MAX_TOP + 1);
    expect(top).toBeGreaterThan(95); // ...but the skyline is genuinely tall
  });

  test('the spawn is on the park path with room to stand', () => {
    const { x, y, z } = C.CITY_SPAWN;
    const fx = Math.floor(x);
    const fz = Math.floor(z);
    expect(world.getBlock(fx, GROUND_Y, fz)).toBe(B.SIDEWALK); // the path
    expect(y).toBeCloseTo(GROUND_Y + 1, 1);
    for (let dy = 1; dy <= 3; dy++) expect(world.getBlock(fx, GROUND_Y + dy, fz)).toBe(B.AIR);
    // and it is clear for a couple of blocks all round
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) expect(world.isSolid(fx + dx, GROUND_Y + 1, fz + dz)).toBe(false);
  });

  test('the player can walk from the spawn along the path to the fountain', () => {
    const b = createBody({ x: C.CITY_SPAWN.x, y: C.CITY_SPAWN.y, z: C.CITY_SPAWN.z, halfWidth: PLAYER.halfWidth, height: PLAYER.height, stepHeight: PLAYER.stepHeight });
    for (let i = 0; i < 400; i++) {
      b.vz = -PLAYER.walkSpeed;
      b.vx = 0;
      moveBody(world, b, 1 / 60);
      if (b.z < C.PARK_CENTER.z + 4) break;
    }
    expect(b.z).toBeLessThan(C.PARK_CENTER.z + 5);
    expect(b.y).toBeGreaterThan(GROUND_Y + 0.9); // never fell through
    expect(b.y).toBeLessThan(GROUND_Y + 2.2); // (it may have stepped up onto the fountain rim)
  });

  test('buildings sit inside blocks, never on a road, and the lot map agrees', () => {
    const ids = new Set();
    for (const b of city.buildings) {
      expect(ids.has(b.id)).toBe(false);
      ids.add(b.id);
      for (let z = b.z0; z <= b.z1; z++) {
        for (let x = b.x0; x <= b.x1; x++) {
          expect(C.isAvenueX(x) || C.isStreetZ(z)).toBe(false);
          expect(C.inPark(x, z)).toBe(false);
          expect(city.lotMap[z * C.SIZE + x]).toBe(b.id);
        }
      }
    }
    // lot map has no ids that are not buildings
    for (let i = 0; i < city.lotMap.length; i += 13) if (city.lotMap[i]) expect(ids.has(city.lotMap[i])).toBe(true);
  });

  test('every enclosed building has a walkable door', () => {
    let checked = 0;
    for (const b of city.buildings) {
      if (b.archetype === 'parkingDeck') continue; // open-sided
      // find the doorway: three vertically-stacked air cells in the building's outer wall at the lowest row
      let found = false;
      const midX = (b.x0 + b.x1) >> 1;
      const midZ = (b.z0 + b.z1) >> 1;
      const candidates = [
        [midX, b.z0, 0, -1],
        [midX + 1, b.z0, 0, -1],
        [midX, b.z1, 0, 1],
        [midX + 1, b.z1, 0, 1],
        [b.x0, midZ, -1, 0],
        [b.x0, midZ + 1, -1, 0],
        [b.x1, midZ, 1, 0],
        [b.x1, midZ + 1, 1, 0],
      ];
      for (const [x, z, dx, dz] of candidates) {
        const open = [0, 1, 2].every((dy) => world.getBlock(x, C.BUILD_Y + dy, z) === B.AIR);
        const outside = [0, 1, 2].every((dy) => !world.isSolid(x + dx, C.BUILD_Y + dy, z + dz));
        const inside = [0, 1, 2].every((dy) => !world.isSolid(x - dx, C.BUILD_Y + dy, z - dz));
        if (open && outside && inside) found = true;
      }
      expect(found).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  test('windows are cut and a good share of them are lit', () => {
    let lit = 0;
    let dark = 0;
    for (const col of world.columns.values()) {
      for (let sy = 0; sy < SECTIONS; sy++) {
        const sec = col.sections[sy];
        if (!sec) continue;
        for (let i = 0; i < sec.length; i++) {
          if (sec[i] === B.GLASS_LIT) lit++;
          else if (sec[i] === B.GLASS) dark++;
        }
      }
    }
    expect(dark).toBeGreaterThan(5000);
    expect(lit / (lit + dark)).toBeGreaterThan(0.1);
    expect(lit / (lit + dark)).toBeLessThan(0.6);
  });

  test('the bridge is continuous from the street to the island, over open water', () => {
    for (let x = 300; x <= 380; x++) expect(world.isSolid(x, GROUND_Y, 195)).toBe(true);
    // open water beside the deck: the bay floor is the only solid, 9 blocks down
    expect(world.topY(350, 100)).toBe(C.BAY_FLOOR_Y);
    expect(world.topY(C.BRIDGE.towerX[0], 195)).toBeGreaterThan(GROUND_Y + 40); // the tower's cross-beams span the deck
    // cables: some steel hangs between the towers well above the deck
    let cable = 0;
    for (let y = GROUND_Y + 30; y < C.BRIDGE.towerTop + 2; y++) if (world.getBlock(354, y, C.BRIDGE.z0) === B.STEEL) cable++;
    expect(cable).toBeGreaterThan(0);
  });

  test('the perimeter wall closes the west, north and south edges but not the bay', () => {
    expect(world.isSolid(1, GROUND_Y + 10, 100)).toBe(true);
    expect(world.isSolid(100, GROUND_Y + 10, 1)).toBe(true);
    expect(world.isSolid(100, GROUND_Y + 10, 382)).toBe(true);
    expect(world.isSolid(100, GROUND_Y + 10, 50)).toBe(false);
    expect(world.isSolid(350, GROUND_Y + 5, 100)).toBe(false);
  });

  test('the park: grass, paved paths, a fountain with a pool, trees with leaves', () => {
    expect(world.getBlock(160, GROUND_Y, 175)).toBe(B.GRASS);
    expect(world.getBlock(196, GROUND_Y, 175)).toBe(B.SIDEWALK);
    expect(world.getBlock(197, GROUND_Y, 200)).toBe(B.POOL);
    let logs = 0;
    let leaves = 0;
    for (let z = C.PARK.z0; z <= C.PARK.z1; z++) {
      for (let x = C.PARK.x0; x <= C.PARK.x1; x++) {
        if (world.getBlock(x, GROUND_Y + 2, z) === B.LOG) logs++;
        if (world.getBlock(x, GROUND_Y + 6, z) === B.LEAVES) leaves++;
      }
    }
    expect(logs).toBeGreaterThan(10);
    expect(leaves).toBeGreaterThan(10);
  });

  test('roads have lane lines and crosswalks; sidewalks are one block above the road', () => {
    expect(world.getBlock(48 * 4 + 4, GROUND_Y, 120)).toBe(B.ASPHALT_LINE); // avenue centre line
    expect(world.getBlock(100, GROUND_Y, 32 * 3 + 3)).not.toBe(B.AIR);
    expect(world.getBlock(48 * 2 + 3, GROUND_Y, 32 * 4 - 2)).toBe(B.CROSSWALK_Z);
    expect(world.getBlock(48 * 2 - 2, GROUND_Y, 32 * 4 + 3)).toBe(B.CROSSWALK_X);
    expect(world.getBlock(11, C.BASE_Y, 20)).toBe(B.SIDEWALK); // a block's sidewalk ring (x = 10..11)
    expect(world.getBlock(11, GROUND_Y, 20)).toBe(B.CONCRETE); // ...sitting on the street-level surface
    expect(world.getBlock(5, C.BASE_Y, 20)).toBe(B.AIR); // the avenue beside it is a block lower
  });

  test('anchors for the grapple assist are roof corners', () => {
    expect(city.anchors.length).toBeGreaterThan(300);
    for (let i = 0; i < city.anchors.length; i += 3) {
      const [x, y, z] = [city.anchors[i], city.anchors[i + 1], city.anchors[i + 2]];
      expect(world.isSolid(x, y, z)).toBe(true); // a real roof corner, not a point in the air
      expect(y).toBeLessThanOrEqual(C.MAX_TOP);
    }
  });

  test('every solid block is a known block id', () => {
    for (const col of world.columns.values()) {
      for (let sy = 0; sy < SECTIONS; sy++) {
        const sec = col.sections[sy];
        if (!sec) continue;
        for (let i = 0; i < sec.length; i += 5) if (sec[i] !== 0) expect(SOLID[sec[i]]).toBe(1);
      }
    }
  });
});
