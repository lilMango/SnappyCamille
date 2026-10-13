import { B } from '../constants/blocks';
import { GROUND_Y, WORLD_H } from '../constants/worldConfig';
import { hash2, hash3 } from './rng';
import { hollowTower } from './testWorld';

/**
 * Phase-2 PERFORMANCE GATE world: a dumb 24 x 24-column (384 x 384 block) grid of hollow
 * box towers. It is deliberately not the real generator (phase 4): its only job is to put
 * a city-sized, city-dense load on the mesher and renderer *now*, so draw-call count, GPU
 * memory and remesh latency can be measured while changing SECTION_H / packing / hollowness
 * is still a config tweak rather than a rewrite.
 *
 * Layout (all deterministic): avenues every 48 blocks (10 wide), streets every 24 (8 wide);
 * each block holds two lots; every lot gets one hollow tower of hashed height 8..90.
 */

const AVENUE = 48;
const STREET = 24;
const AVENUE_W = 10;
const STREET_W = 8;
const WALLS = [B.BRICK, B.CONCRETE, B.CONCRETE_DARK, B.CONCRETE_LIGHT, B.STEEL];

export function buildSyntheticCity(world, chunks = 24, seed = 1954) {
  const size = chunks * 16;
  const N = size - 1;

  // ground + roads
  world.fillBox(0, 0, 0, N, 2, N, B.BEDROCK);
  world.fillBox(0, 3, 0, N, GROUND_Y - 4, N, B.STONE);
  world.fillBox(0, GROUND_Y - 3, 0, N, GROUND_Y - 1, N, B.DIRT);
  world.fillBox(0, GROUND_Y, 0, N, GROUND_Y, N, B.SIDEWALK);
  for (let a = 0; a < size; a += AVENUE) {
    world.fillBox(a, GROUND_Y, 0, Math.min(N, a + AVENUE_W - 1), GROUND_Y, N, B.ASPHALT);
    world.fillBox(a + 4, GROUND_Y, 0, a + 5, GROUND_Y, N, B.ASPHALT_LINE);
  }
  for (let s = 0; s < size; s += STREET) {
    world.fillBox(0, GROUND_Y, s, N, GROUND_Y, Math.min(N, s + STREET_W - 1), B.ASPHALT);
  }

  // towers: two lots per block
  let towers = 0;
  for (let bx = 0; bx < size; bx += AVENUE) {
    for (let bz = 0; bz < size; bz += STREET) {
      const x0 = bx + AVENUE_W + 1; // block interior
      const z0 = bz + STREET_W + 1;
      const lotW = 17;
      const lotD = STREET - STREET_W - 2; // 14
      for (let lot = 0; lot < 2; lot++) {
        const lx = x0 + lot * (lotW + 2);
        if (lx + lotW > N || z0 + lotD > N) continue;
        const r = hash3(lx, 0, z0, seed);
        const h = Math.min(WORLD_H - GROUND_Y - 2, 8 + Math.floor(r * r * 82)); // skews low, a few spires
        const wall = WALLS[Math.floor(hash2(lx, z0, seed + 1) * WALLS.length)];
        hollowTower(world, lx, z0, lotW, lotD, h, wall);
        towers++;
      }
    }
  }
  return { size, towers };
}
