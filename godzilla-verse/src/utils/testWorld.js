import { B } from '../constants/blocks';
import { GROUND_Y } from '../constants/worldConfig';
import { hash3 } from './rng';

/**
 * Phase-1 test world: 64 x 64 blocks (4 x 4 columns) with a crossroads and a handful of
 * hollow towers. Built to exercise the engine rather than to look like the final city:
 * the towers cross section borders (y = 32 and 64), one has an open door so the floor
 * slabs show through, and a floating cube straddles x, y and z section borders at once.
 */

export const TEST_SIZE = 64;

export function hollowTower(world, x0, z0, w, d, h, wall, { windows = true, door = true } = {}) {
  const y0 = GROUND_Y + 1;
  const y1 = GROUND_Y + h;
  const x1 = x0 + w - 1;
  const z1 = z0 + d - 1;

  // 1-thick shell
  world.fillBox(x0, y0, z0, x1, y1, z0, wall);
  world.fillBox(x0, y0, z1, x1, y1, z1, wall);
  world.fillBox(x0, y0, z0, x0, y1, z1, wall);
  world.fillBox(x1, y0, z0, x1, y1, z1, wall);
  // floor slabs every 4 levels, and a roof
  for (let y = y0; y < y1; y += 4) world.fillBox(x0 + 1, y, z0 + 1, x1 - 1, y, z1 - 1, B.CONCRETE_LIGHT);
  world.fillBox(x0, y1, z0, x1, y1, z1, B.CONCRETE_DARK);

  if (windows) {
    // two window rows per floor, every other column; some lit (clustered by hash, so it
    // looks like occupied floors rather than TV static)
    for (let y = y0 + 1; y < y1; y++) {
      if ((y - y0) % 4 !== 1 && (y - y0) % 4 !== 2) continue;
      const lit = (x, z) => hash3(x >> 1, y >> 2, z >> 1, 7) < 0.3;
      for (let x = x0 + 1; x < x1; x += 2) {
        world.setBlock(x, y, z0, lit(x, z0) ? B.GLASS_LIT : B.GLASS);
        world.setBlock(x, y, z1, lit(x, z1) ? B.GLASS_LIT : B.GLASS);
      }
      for (let z = z0 + 1; z < z1; z += 2) {
        world.setBlock(x0, y, z, lit(x0, z) ? B.GLASS_LIT : B.GLASS);
        world.setBlock(x1, y, z, lit(x1, z) ? B.GLASS_LIT : B.GLASS);
      }
    }
  }

  if (door) {
    const mx = x0 + (w >> 1);
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 3; dy++) world.setBlock(mx + dx, y0 + dy, z1, B.AIR);
  }
}

export function buildTestWorld(world) {
  const N = TEST_SIZE - 1;

  // ground
  world.fillBox(0, 0, 0, N, 2, N, B.BEDROCK);
  world.fillBox(0, 3, 0, N, GROUND_Y - 4, N, B.STONE);
  world.fillBox(0, GROUND_Y - 3, 0, N, GROUND_Y - 1, N, B.DIRT);
  world.fillBox(0, GROUND_Y, 0, N, GROUND_Y, N, B.GRASS);

  // crossroads: asphalt, centre lines, raised sidewalks
  world.fillBox(26, GROUND_Y, 0, 37, GROUND_Y, N, B.ASPHALT);
  world.fillBox(0, GROUND_Y, 26, N, GROUND_Y, 37, B.ASPHALT);
  world.fillBox(31, GROUND_Y, 0, 32, GROUND_Y, 25, B.ASPHALT_LINE);
  world.fillBox(31, GROUND_Y, 38, 32, GROUND_Y, N, B.ASPHALT_LINE);
  world.fillBox(0, GROUND_Y, 31, 25, GROUND_Y, 32, B.ASPHALT_LINE);
  world.fillBox(38, GROUND_Y, 31, N, GROUND_Y, 32, B.ASPHALT_LINE);
  world.fillBox(24, GROUND_Y + 1, 0, 25, GROUND_Y + 1, N, B.SIDEWALK);
  world.fillBox(38, GROUND_Y + 1, 0, 39, GROUND_Y + 1, N, B.SIDEWALK);
  world.fillBox(0, GROUND_Y + 1, 24, N, GROUND_Y + 1, 25, B.SIDEWALK);
  world.fillBox(0, GROUND_Y + 1, 38, N, GROUND_Y + 1, 39, B.SIDEWALK);
  world.fillBox(26, GROUND_Y + 1, 26, 37, GROUND_Y + 1, 37, B.AIR); // keep the junction clear

  // towers, one per quadrant
  hollowTower(world, 5, 5, 14, 14, 16, B.BRICK); // walk-up, stays in section 0
  // see-through fence ring on its roof (exercises the alpha-tested cutout pass)
  const fy = GROUND_Y + 17;
  world.fillBox(5, fy, 5, 18, fy + 1, 5, B.FENCE);
  world.fillBox(5, fy, 18, 18, fy + 1, 18, B.FENCE);
  world.fillBox(5, fy, 6, 5, fy + 1, 17, B.FENCE);
  world.fillBox(18, fy, 6, 18, fy + 1, 17, B.FENCE);
  hollowTower(world, 46, 5, 12, 12, 60, B.CONCRETE_DARK); // crosses y=32 and y=64
  hollowTower(world, 4, 44, 16, 12, 36, B.CONCRETE); // crosses y=32
  // stepped tower with a spire (setbacks)
  hollowTower(world, 44, 44, 16, 16, 30, B.CONCRETE_LIGHT);
  hollowTower(world, 47, 47, 10, 10, 52, B.STEEL, { door: false });
  world.fillBox(51, GROUND_Y + 53, 51, 52, GROUND_Y + 66, 52, B.STEEL);
  world.fillBox(51, GROUND_Y + 67, 51, 51, GROUND_Y + 76, 51, B.STEEL);

  // rubble heap in the junction
  for (let i = 0; i < 40; i++) {
    const x = 29 + ((hash3(i, 0, 0, 3) * 6) | 0);
    const z = 29 + ((hash3(i, 1, 0, 3) * 6) | 0);
    const h = 1 + ((hash3(i, 2, 0, 3) * 3) | 0);
    for (let y = 0; y < h; y++) world.setBlock(x, GROUND_Y + 1 + y, z, B.RUBBLE);
  }

  // seam test: a floating cube over the road straddling the x=15/16, y=31/32 and
  // z=31/32 section borders (8 sections meet at its centre)
  world.fillBox(15, 31, 31, 16, 32, 32, B.STEEL);
}
