import { B } from '../constants/blocks';
import { BASE_Y, BUILD_Y, MAX_TOP } from '../constants/cityConfig';
import { hash2, hash3 } from './rng';

/**
 * Building archetypes for the city generator. Pure: everything is written through
 * `world.fillBox` / `world.setBlock`, so it runs in the generation worker, in bun tests
 * and in the benchmark unchanged.
 *
 * Vertical rhythm: ground slab at y = BASE_Y (the raised sidewalk layer), then a floor slab
 * every 4 blocks: BASE_Y + 4k. A building of `n` floors has its roof slab at BASE_Y + 4n and
 * walls from BUILD_Y to the row below. Air rows between slabs are 3 high (rel = 1, 2, 3), so
 * a 1.8 m player walks around inside, and a 3-high door fits the lowest row.
 *
 * Hollow shells (1-thick walls, interiors empty) are mandatory: they cut the voxel count 5-10x
 * and a tower torn open shows floor plates in cross-section.
 */

// ---- rect helpers ---------------------------------------------------------------

const inset = (r, l, rt, t, bt) => ({ x0: r.x0 + l, x1: r.x1 - rt, z0: r.z0 + t, z1: r.z1 - bt });
const width = (r) => r.x1 - r.x0 + 1;
const depth = (r) => r.z1 - r.z0 + 1;

/** Walls only (hollow): the four sides from yBot to yTop inclusive. */
function shell(world, r, yBot, yTop, id) {
  world.fillBox(r.x0, yBot, r.z0, r.x1, yTop, r.z0, id); // north (-z)
  world.fillBox(r.x0, yBot, r.z1, r.x1, yTop, r.z1, id); // south (+z)
  world.fillBox(r.x0, yBot, r.z0 + 1, r.x0, yTop, r.z1 - 1, id); // west (-x)
  world.fillBox(r.x1, yBot, r.z0 + 1, r.x1, yTop, r.z1 - 1, id); // east (+x)
}

// perimeter cells with the wall name, position along it (u) and its length
function forEachWallCell(r, fn) {
  const w = width(r);
  const d = depth(r);
  for (let x = r.x0; x <= r.x1; x++) {
    fn(x, r.z0, 'N', x - r.x0, w);
    fn(x, r.z1, 'S', x - r.x0, w);
  }
  for (let z = r.z0 + 1; z <= r.z1 - 1; z++) {
    fn(r.x0, z, 'W', z - r.z0, d);
    fn(r.x1, z, 'E', z - r.z0, d);
  }
}

// ---- windows --------------------------------------------------------------------

/**
 * Is the window at (x, y, z) lit? Lit windows must CLUSTER or the facade looks like TV static:
 * each building picks one pattern, so some have whole lit floors, some lit stairwell columns,
 * some a bright crown, some scattered 2x2 lit groups.
 */
function isLit(b, x, y, z, u, topY) {
  const floor = (y - BASE_Y) >> 2;
  switch (b.lit) {
    case 0: // scattered 2x2 clusters
      return hash3(x >> 1, y >> 2, z >> 1, b.id) < b.occ;
    case 1: // whole floors
      return hash2(floor, b.id) < b.occ * 1.6 && hash3(x >> 2, floor, z >> 2, b.id + 1) < 0.92;
    case 2: // lit stairwell / office columns
      return hash2(u >> 2, b.id + 2) < b.occ * 1.2 && hash3(0, floor, u, b.id) < 0.9;
    default: // bright crown, quiet below
      return y > topY - 12 ? hash3(x, y >> 2, z, b.id) < 0.85 : hash3(x >> 1, y >> 2, z >> 1, b.id) < b.occ * 0.4;
  }
}

/**
 * Punch windows into a rect's walls between yBot and yTop (inclusive).
 *   strip    a continuous band, a mullion every 6
 *   punched  paired windows on a 3-grid (brick walk-ups, deco)
 *   curtain  glass in every air row except steel mullions every 4 (glass towers)
 */
function windows(world, b, r, yBot, yTop, style, topY) {
  forEachWallCell(r, (x, z, side, u, len) => {
    if (u === 0 || u === len - 1) return; // corners stay solid
    for (let y = yBot; y <= yTop; y++) {
      const rel = (y - BASE_Y) & 3; // 0 = slab row
      let win = false;
      if (style === 'strip') win = (rel === 1 || rel === 2) && u % 6 !== 0;
      else if (style === 'punched') win = (rel === 1 || rel === 2) && u % 3 !== 0;
      else win = rel !== 0 && u % 4 !== 0; // curtain
      if (win) world.setBlock(x, y, z, isLit(b, x, y, z, u, topY) ? B.GLASS_LIT : B.GLASS);
    }
  });
}

/** Carve a 2-wide, 3-high doorway in the middle of the wall that faces `b.facing`. */
function door(world, b, r) {
  const f = b.facing;
  const y0 = BUILD_Y;
  if (f === 'N' || f === 'S') {
    const z = f === 'N' ? r.z0 : r.z1;
    const x = r.x0 + (width(r) >> 1);
    world.fillBox(x, y0, z, x + 1, y0 + 2, z, B.AIR);
  } else {
    const x = f === 'W' ? r.x0 : r.x1;
    const z = r.z0 + (depth(r) >> 1);
    world.fillBox(x, y0, z, x, y0 + 2, z + 1, B.AIR);
  }
}

// ---- one storey-stack (a "segment") ----------------------------------------------

/**
 * Floors f0..f1 of one footprint: walls, floor slabs, roof slab, windows. A segment above a
 * setback sits on the lower segment's roof slab, which is its floor.
 */
function segment(world, b, r, f0, f1, wall, style, roofId = B.CONCRETE_DARK) {
  const yStart = BASE_Y + 4 * f0 + 1;
  const top = BASE_Y + 4 * f1;
  shell(world, r, yStart, top - 1, wall);
  for (let k = f0 + 1; k < f1; k++) {
    world.fillBox(r.x0 + 1, BASE_Y + 4 * k, r.z0 + 1, r.x1 - 1, BASE_Y + 4 * k, r.z1 - 1, B.CONCRETE_LIGHT);
  }
  world.fillBox(r.x0, top, r.z0, r.x1, top, r.z1, roofId);
  windows(world, b, r, yStart, top - 1, style, b.topY ?? top);
  return top;
}

// a 3x3 concrete core up the middle of tall buildings (the elevator shaft; also the structural spine)
function core(world, r, yBot, yTop) {
  if (width(r) < 9 || depth(r) < 9) return;
  const cx = (r.x0 + r.x1) >> 1;
  const cz = (r.z0 + r.z1) >> 1;
  world.fillBox(cx - 1, yBot, cz - 1, cx + 1, yTop, cz + 1, B.CONCRETE);
}

// ---- roof clutter ---------------------------------------------------------------

function roofClutter(world, b, r, topY, rnd, { helipad = false, mastMax = 12 } = {}) {
  const w = width(r);
  const d = depth(r);
  if (w < 6 || d < 6) return;
  const used = [];
  const free = (x, z, iw, id) => {
    if (x < r.x0 + 1 || z < r.z0 + 1 || x + iw - 1 > r.x1 - 1 || z + id - 1 > r.z1 - 1) return false;
    return used.every((u) => x + iw < u.x0 || x > u.x1 + 1 || z + id < u.z0 || z > u.z1 + 1);
  };
  const place = (iw, id, fn) => {
    for (let a = 0; a < 10; a++) {
      const x = r.x0 + 1 + Math.floor(rnd() * Math.max(1, w - 2 - iw + 1));
      const z = r.z0 + 1 + Math.floor(rnd() * Math.max(1, d - 2 - id + 1));
      if (free(x, z, iw, id)) {
        used.push({ x0: x, x1: x + iw - 1, z0: z, z1: z + id - 1 });
        fn(x, z);
        return true;
      }
    }
    return false;
  };
  const y = topY + 1;

  if (helipad && w >= 11 && d >= 11) {
    place(7, 7, (x, z) => {
      world.fillBox(x, topY, z, x + 6, topY, z + 6, B.CONCRETE_LIGHT);
      // the H
      world.fillBox(x + 2, topY, z + 1, x + 2, topY, z + 5, B.STEEL);
      world.fillBox(x + 4, topY, z + 1, x + 4, topY, z + 5, B.STEEL);
      world.fillBox(x + 2, topY, z + 3, x + 4, topY, z + 3, B.STEEL);
      for (const [cx, cz] of [[x, z], [x + 6, z], [x, z + 6], [x + 6, z + 6]]) world.setBlock(cx, topY, cz, B.GLASS_LIT);
    });
  }
  if (w >= 9 && d >= 9 && rnd() < 0.3) {
    place(5, 5, (x, z) => {
      world.fillBox(x, y, z, x + 4, y + 2, z + 4, B.CONCRETE);
      world.fillBox(x + 1, y + 1, z, x + 3, y + 1, z, B.GLASS_LIT);
      world.fillBox(x, y + 3, z, x + 4, y + 3, z + 4, B.CONCRETE_DARK);
    });
  }
  const acs = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < acs; i++) {
    place(2, 2, (x, z) => {
      world.fillBox(x, y, z, x + 1, y, z + 1, B.CONCRETE_DARK);
      world.setBlock(x, y + 1, z, B.STEEL);
    });
  }
  if (rnd() < 0.45 && w >= 7 && d >= 7) {
    place(3, 3, (x, z) => {
      for (const [lx, lz] of [[x, z], [x + 2, z], [x, z + 2], [x + 2, z + 2]]) world.fillBox(lx, y, lz, lx, y + 2, lz, B.STEEL);
      world.fillBox(x, y + 3, z, x + 2, y + 5, z + 2, B.PLANKS);
      world.setBlock(x + 1, y + 6, z + 1, B.PLANKS);
    });
  }
  if (rnd() < 0.7) {
    place(1, 1, (x, z) => {
      const h = Math.min(mastMax, 6 + Math.floor(rnd() * 8), MAX_TOP - y - 1);
      if (h < 3) return;
      world.fillBox(x, y, z, x, y + h - 1, z, B.STEEL);
      world.setBlock(x, y + h, z, B.NEON_PINK); // aircraft warning light
    });
  }
}

// ---- storefront signage ---------------------------------------------------------

function storefront(world, b, r, rnd, band = true) {
  const f = b.facing;
  const horiz = f === 'N' || f === 'S';
  const len = horiz ? width(r) : depth(r);
  const fixed = f === 'N' ? r.z0 : f === 'S' ? r.z1 : f === 'W' ? r.x0 : r.x1;
  const start = horiz ? r.x0 : r.z0;
  const put = (u, y, id) => (horiz ? world.setBlock(start + u, y, fixed, id) : world.setBlock(fixed, y, start + u, id));
  if (band) {
    for (let u = 2; u < len - 2; u++) {
      if (u % 5 === 0) continue; // mullion
      for (let y = BUILD_Y; y <= BUILD_Y + 1; y++) put(u, y, hash3(start + u, y, fixed, b.id) < b.occ * 1.5 ? B.GLASS_LIT : B.GLASS);
    }
  }
  // neon sign across the top of the ground floor
  const sign = rnd() < 0.5 ? B.NEON_PINK : B.NEON_CYAN;
  const s0 = Math.max(2, (len >> 1) - Math.floor(len * 0.3));
  const s1 = Math.min(len - 3, (len >> 1) + Math.floor(len * 0.3));
  for (let u = s0; u <= s1; u++) put(u, BUILD_Y + 3, sign);
}

// ---- the archetypes -------------------------------------------------------------

export const ARCHETYPES = {
  /** Stacked boxes with 0-2 setbacks. */
  boxTower(world, b, r, floors, rnd) {
    const walls = [B.CONCRETE, B.CONCRETE_LIGHT, B.CONCRETE_DARK, B.CONCRETE];
    const wall = walls[Math.floor(rnd() * walls.length)];
    const style = rnd() < 0.5 ? 'strip' : 'punched';
    const cuts = floors >= 14 ? 2 : floors >= 8 ? 1 : 0;
    const f1 = cuts >= 1 ? Math.round(floors * (0.5 + rnd() * 0.2)) : floors;
    const f2 = cuts >= 2 ? Math.round(floors * (0.78 + rnd() * 0.12)) : floors;
    b.topY = BASE_Y + 4 * floors;
    let rect = r;
    segment(world, b, rect, 0, f1, wall, style);
    let top = BASE_Y + 4 * f1;
    if (f1 < floors) {
      const s = 2 + Math.floor(rnd() * 2);
      rect = inset(rect, rnd() < 0.5 ? s : 1, rnd() < 0.5 ? s : 1, rnd() < 0.5 ? s : 1, rnd() < 0.5 ? s : 1);
      if (width(rect) < 7 || depth(rect) < 7) rect = inset(r, 2, 2, 2, 2);
      top = segment(world, b, rect, f1, f2, wall, style);
      if (f2 < floors) {
        rect = inset(rect, 2, 2, 2, 2);
        if (width(rect) >= 5 && depth(rect) >= 5) top = segment(world, b, rect, f2, floors, wall, style);
      }
    }
    core(world, r, BUILD_Y, BASE_Y + 4 * f1 - 1);
    door(world, b, r);
    roofClutter(world, b, rect, top, rnd, { helipad: floors >= 14 && rnd() < 0.25 });
    return top;
  },

  /** A slab of glass: steel frame, curtain wall, bright crown. */
  glassSlab(world, b, r, floors, rnd) {
    b.topY = BASE_Y + 4 * floors;
    const top = segment(world, b, r, 0, floors, B.STEEL, 'curtain', B.CONCRETE_DARK);
    core(world, r, BUILD_Y, top - 1);
    // crown band
    world.fillBox(r.x0, top + 1, r.z0, r.x1, top + 1, r.z0, B.CONCRETE_LIGHT);
    world.fillBox(r.x0, top + 1, r.z1, r.x1, top + 1, r.z1, B.CONCRETE_LIGHT);
    world.fillBox(r.x0, top + 1, r.z0, r.x0, top + 1, r.z1, B.CONCRETE_LIGHT);
    world.fillBox(r.x1, top + 1, r.z0, r.x1, top + 1, r.z1, B.CONCRETE_LIGHT);
    door(world, b, r);
    roofClutter(world, b, r, top, rnd, { helipad: floors >= 12 && rnd() < 0.3 });
    return top;
  },

  /** Art-deco stepped tower with pilasters, a lit crown and a spire. */
  setbackDeco(world, b, r, floors, rnd) {
    const f1 = Math.max(2, Math.round(floors * 0.4));
    const f2 = Math.max(f1 + 1, Math.round(floors * 0.72));
    b.topY = BASE_Y + 4 * floors;
    b.lit = 3; // crown
    let rect = r;
    segment(world, b, rect, 0, f1, B.CONCRETE_LIGHT, 'punched');
    rect = inset(rect, 2, 2, 2, 2);
    segment(world, b, rect, f1, f2, B.CONCRETE_LIGHT, 'punched');
    rect = inset(rect, 2, 2, 2, 2);
    if (width(rect) < 5 || depth(rect) < 5) rect = inset(rect, -1, -1, -1, -1);
    const top = segment(world, b, rect, f2, floors, B.CONCRETE_LIGHT, 'punched');
    // pilasters up each corner of the base
    for (const [x, z] of [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]]) {
      world.fillBox(x, BUILD_Y, z, x, BASE_Y + 4 * f1, z, B.CONCRETE);
    }
    core(world, r, BUILD_Y, BASE_Y + 4 * f1 - 1);
    door(world, b, r);
    // spire
    const cx = (rect.x0 + rect.x1) >> 1;
    const cz = (rect.z0 + rect.z1) >> 1;
    const h = Math.min(14, MAX_TOP - top - 2);
    if (h >= 4) {
      world.fillBox(cx - 1, top + 1, cz - 1, cx + 1, top + 2, cz + 1, B.STEEL);
      world.fillBox(cx, top + 3, cz, cx, top + h - 1, cz, B.STEEL);
      world.setBlock(cx, top + h, cz, B.NEON_PINK);
    }
    return top;
  },

  /** Brick walk-up: punched windows, cornice, parapet, often a water tower. */
  brickWalkup(world, b, r, floors, rnd) {
    b.topY = BASE_Y + 4 * floors;
    const top = segment(world, b, r, 0, floors, B.BRICK, 'punched', B.CONCRETE_LIGHT);
    // parapet
    world.fillBox(r.x0, top + 1, r.z0, r.x1, top + 1, r.z0, B.BRICK);
    world.fillBox(r.x0, top + 1, r.z1, r.x1, top + 1, r.z1, B.BRICK);
    world.fillBox(r.x0, top + 1, r.z0, r.x0, top + 1, r.z1, B.BRICK);
    world.fillBox(r.x1, top + 1, r.z0, r.x1, top + 1, r.z1, B.BRICK);
    door(world, b, r);
    roofClutter(world, b, r, top, rnd, { mastMax: 8 });
    return top;
  },

  /** A 2-storey glass-and-concrete podium carrying a tower, with a fenced terrace. */
  podiumTower(world, b, r, floors, rnd) {
    b.topY = BASE_Y + 4 * floors;
    const podiumTop = segment(world, b, r, 0, 2, B.CONCRETE_DARK, 'strip', B.CONCRETE_LIGHT);
    storefront(world, b, r, rnd);
    const s = 3 + Math.floor(rnd() * 2);
    let tr = inset(r, s, s, s, s);
    if (width(tr) < 9 || depth(tr) < 9) tr = inset(r, 2, 2, 2, 2);
    // terrace fence round the podium roof
    world.fillBox(r.x0, podiumTop + 1, r.z0, r.x1, podiumTop + 1, r.z0, B.FENCE);
    world.fillBox(r.x0, podiumTop + 1, r.z1, r.x1, podiumTop + 1, r.z1, B.FENCE);
    world.fillBox(r.x0, podiumTop + 1, r.z0 + 1, r.x0, podiumTop + 1, r.z1 - 1, B.FENCE);
    world.fillBox(r.x1, podiumTop + 1, r.z0 + 1, r.x1, podiumTop + 1, r.z1 - 1, B.FENCE);
    let rect = tr;
    const fMid = floors >= 12 ? Math.round(floors * 0.8) : floors;
    segment(world, b, rect, 2, fMid, B.STEEL, 'curtain');
    let top = BASE_Y + 4 * fMid;
    if (fMid < floors) {
      rect = inset(rect, 2, 2, 2, 2);
      top = segment(world, b, rect, fMid, floors, B.STEEL, 'curtain');
    }
    core(world, tr, BUILD_Y, BASE_Y + 4 * fMid - 1);
    door(world, b, r);
    roofClutter(world, b, rect, top, rnd, { helipad: floors >= 12 && rnd() < 0.3 });
    return top;
  },

  /** Open-sided parking structure: slabs, chest-high parapets, columns, a neon sign. */
  parkingDeck(world, b, r, floors, rnd) {
    const top = BASE_Y + 4 * floors;
    for (let k = 1; k <= floors; k++) {
      const y = BASE_Y + 4 * k;
      world.fillBox(r.x0, y, r.z0, r.x1, y, r.z1, B.CONCRETE);
      const py = y + 1;
      world.fillBox(r.x0, py, r.z0, r.x1, py, r.z0, B.CONCRETE_LIGHT);
      world.fillBox(r.x0, py, r.z1, r.x1, py, r.z1, B.CONCRETE_LIGHT);
      world.fillBox(r.x0, py, r.z0, r.x0, py, r.z1, B.CONCRETE_LIGHT);
      world.fillBox(r.x1, py, r.z0, r.x1, py, r.z1, B.CONCRETE_LIGHT);
    }
    for (let x = r.x0 + 2; x <= r.x1 - 1; x += 5) {
      for (let z = r.z0 + 2; z <= r.z1 - 1; z += 5) world.fillBox(x, BUILD_Y, z, x, top - 1, z, B.CONCRETE_LIGHT);
    }
    // stair core in a corner
    world.fillBox(r.x0, BUILD_Y, r.z0, r.x0 + 2, top, r.z0 + 2, B.CONCRETE);
    // a neon "P" panel on the street-facing side of the roof edge
    const f = b.facing;
    const nx = f === 'W' ? r.x0 : f === 'E' ? r.x1 : (r.x0 + r.x1) >> 1;
    const nz = f === 'N' ? r.z0 : f === 'S' ? r.z1 : (r.z0 + r.z1) >> 1;
    world.fillBox(nx, top + 2, nz, nx + (f === 'N' || f === 'S' ? 2 : 0), top + 4, nz + (f === 'W' || f === 'E' ? 2 : 0), B.NEON_CYAN);
    return top;
  },

  /** A low shop: storefront glass, neon sign, flat roof with clutter. */
  lowShop(world, b, r, floors, rnd) {
    b.topY = BASE_Y + 4 * floors;
    const walls = [B.BRICK, B.CONCRETE, B.CONCRETE_LIGHT];
    const wall = walls[Math.floor(rnd() * walls.length)];
    const top = segment(world, b, r, 0, floors, wall, 'punched', B.CONCRETE_DARK);
    storefront(world, b, r, rnd);
    door(world, b, r);
    roofClutter(world, b, r, top, rnd, { mastMax: 6 });
    return top;
  },
};
