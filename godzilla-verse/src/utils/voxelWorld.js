import {
  CHUNK_X,
  CHUNK_Z,
  SECTION_H,
  SECTIONS,
  SECTION_VOLUME,
  WORLD_H,
  PAD_X,
  PAD_Z,
  PAD_Y,
} from '../constants/worldConfig';
import { SOLID } from '../constants/blocks';
import { colKey, sectionKey } from './blockIndex';

/**
 * Chunked voxel storage. The world is a Map of Columns (16 x 16 blocks, WORLD_H tall);
 * each Column holds SECTIONS lazily-allocated sections of 16 x 32 x 16 voxels. A section
 * is a flat Uint8Array of block ids (index x | z<<4 | y<<8); a null section is all air.
 *
 * Pure data + math: no THREE, no DOM, so the same class can later run inside the
 * city-generation worker.
 */

export class Column {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.sections = new Array(SECTIONS).fill(null);
    this.filled = new Uint16Array(SECTIONS); // non-air voxel count per section (0 => freed)
    // Highest solid y + 1 per (lx | lz<<4); 0 = no solid block. Ground queries / blob shadows.
    this.heightTop = new Uint8Array(CHUNK_X * CHUNK_Z);
  }
}

function recomputeHeight(col, lx, lz) {
  const hi = lx | (lz << 4);
  for (let sy = SECTIONS - 1; sy >= 0; sy--) {
    const sec = col.sections[sy];
    if (!sec) continue;
    for (let ly = SECTION_H - 1; ly >= 0; ly--) {
      if (SOLID[sec[lx | (lz << 4) | (ly << 8)]]) {
        col.heightTop[hi] = sy * SECTION_H + ly + 1;
        return;
      }
    }
  }
  col.heightTop[hi] = 0;
}

function countFilled(sec) {
  let n = 0;
  for (let i = 0; i < SECTION_VOLUME; i++) if (sec[i] !== 0) n++;
  return n;
}

export class VoxelWorld {
  constructor() {
    this.columns = new Map(); // colKey -> Column
    // Section keys needing a remesh. A Set, so a section edited 1000 times in a frame is
    // meshed once.
    this.dirty = new Set();
    this._nbr = new Array(9).fill(null); // scratch for buildPadded
  }

  clear() {
    this.columns.clear();
    this.dirty.clear();
  }

  getColumn(cx, cz) {
    return this.columns.get(colKey(cx, cz)) || null;
  }

  ensureColumn(cx, cz) {
    const k = colKey(cx, cz);
    let col = this.columns.get(k);
    if (!col) {
      col = new Column(cx, cz);
      this.columns.set(k, col);
    }
    return col;
  }

  getBlock(x, y, z) {
    if (y < 0 || y >= WORLD_H) return 0;
    const col = this.columns.get(colKey(x >> 4, z >> 4));
    if (!col) return 0;
    const sec = col.sections[y >> 5];
    return sec ? sec[(x & 15) | ((z & 15) << 4) | ((y & 31) << 8)] : 0;
  }

  isSolid(x, y, z) {
    return SOLID[this.getBlock(x, y, z)] === 1;
  }

  /** Highest solid y at (x, z), or -1 if the column there is empty. */
  topY(x, z) {
    const col = this.columns.get(colKey(x >> 4, z >> 4));
    return col ? col.heightTop[(x & 15) | ((z & 15) << 4)] - 1 : -1;
  }

  /** Returns the previous block id. Out-of-range y is ignored (returns 0). */
  setBlock(x, y, z, id) {
    if (y < 0 || y >= WORLD_H) return 0;
    const cx = x >> 4;
    const cz = z >> 4;
    const sy = y >> 5;
    const lx = x & 15;
    const lz = z & 15;
    const idx = lx | (lz << 4) | ((y & 31) << 8);

    let col = this.columns.get(colKey(cx, cz));
    let sec = col ? col.sections[sy] : null;
    const old = sec ? sec[idx] : 0;
    if (old === id) return old;

    if (!col) col = this.ensureColumn(cx, cz);
    if (!sec) sec = col.sections[sy] = new Uint8Array(SECTION_VOLUME);
    sec[idx] = id;

    col.filled[sy] += (id !== 0 ? 1 : 0) - (old !== 0 ? 1 : 0);
    if (col.filled[sy] === 0) col.sections[sy] = null; // free; the dirty mark removes the mesh

    const hi = lx | (lz << 4);
    if (SOLID[id]) {
      if (y + 1 > col.heightTop[hi]) col.heightTop[hi] = y + 1;
    } else if (SOLID[old] && y + 1 === col.heightTop[hi]) {
      recomputeHeight(col, lx, lz);
    }

    this.markDirtyAround(x, y, z);
    return old;
  }

  /**
   * Fill the inclusive box with one block id. The fast path used by generation: rows are
   * written with TypedArray.fill (x is the contiguous axis).
   */
  fillBox(x0, y0, z0, x1, y1, z1, id) {
    if (x0 > x1 || y0 > y1 || z0 > z1) return;
    y0 = Math.max(0, y0);
    y1 = Math.min(WORLD_H - 1, y1);
    if (y0 > y1) return;

    for (let cz = z0 >> 4; cz <= z1 >> 4; cz++) {
      for (let cx = x0 >> 4; cx <= x1 >> 4; cx++) {
        const lx0 = Math.max(x0, cx << 4) - (cx << 4);
        const lx1 = Math.min(x1, (cx << 4) + 15) - (cx << 4);
        const lz0 = Math.max(z0, cz << 4) - (cz << 4);
        const lz1 = Math.min(z1, (cz << 4) + 15) - (cz << 4);
        let col = id === 0 ? this.getColumn(cx, cz) : this.ensureColumn(cx, cz);
        if (!col) continue;

        for (let sy = y0 >> 5; sy <= y1 >> 5; sy++) {
          let sec = col.sections[sy];
          if (!sec) {
            if (id === 0) continue;
            sec = col.sections[sy] = new Uint8Array(SECTION_VOLUME);
          }
          const ly0 = Math.max(y0, sy * SECTION_H) - sy * SECTION_H;
          const ly1 = Math.min(y1, sy * SECTION_H + SECTION_H - 1) - sy * SECTION_H;
          for (let ly = ly0; ly <= ly1; ly++) {
            for (let lz = lz0; lz <= lz1; lz++) {
              const start = lx0 | (lz << 4) | (ly << 8);
              sec.fill(id, start, start + (lx1 - lx0 + 1));
            }
          }
          col.filled[sy] = countFilled(sec);
          if (col.filled[sy] === 0) col.sections[sy] = null;
        }

        for (let lz = lz0; lz <= lz1; lz++) {
          for (let lx = lx0; lx <= lx1; lx++) recomputeHeight(col, lx, lz);
        }
      }
    }
    this.markDirtyBox(x0 - 1, y0 - 1, z0 - 1, x1 + 1, y1 + 1, z1 + 1);
  }

  markDirty(key) {
    this.dirty.add(key);
  }

  /**
   * Mark the section holding (x, y, z) dirty, plus every neighbouring section (face, edge
   * and corner) when the voxel sits on a section border. Corner neighbours matter because
   * ambient occlusion (phase 2) samples diagonals: forgetting them gives the classic
   * "dark seam that only appears sometimes".
   */
  markDirtyAround(x, y, z) {
    const lx = x & 15;
    const lz = z & 15;
    const ly = y & 31;
    const cx = x >> 4;
    const cz = z >> 4;
    const sy = y >> 5;
    for (let dx = lx === 0 ? -1 : 0; dx <= (lx === 15 ? 1 : 0); dx++) {
      for (let dz = lz === 0 ? -1 : 0; dz <= (lz === 15 ? 1 : 0); dz++) {
        for (let dy = ly === 0 ? -1 : 0; dy <= (ly === 31 ? 1 : 0); dy++) {
          const nsy = sy + dy;
          if (nsy < 0 || nsy >= SECTIONS) continue;
          this.dirty.add(sectionKey(cx + dx, cz + dz, nsy));
        }
      }
    }
  }

  /** Mark every section overlapping the inclusive box (coordinates may be out of range). */
  markDirtyBox(x0, y0, z0, x1, y1, z1) {
    const sy0 = Math.max(0, y0) >> 5;
    const sy1 = Math.min(WORLD_H - 1, y1) >> 5;
    for (let cz = z0 >> 4; cz <= z1 >> 4; cz++) {
      for (let cx = x0 >> 4; cx <= x1 >> 4; cx++) {
        for (let sy = sy0; sy <= sy1; sy++) this.dirty.add(sectionKey(cx, cz, sy));
      }
    }
  }

  markAllDirty() {
    for (const col of this.columns.values()) {
      for (let sy = 0; sy < SECTIONS; sy++) {
        if (col.sections[sy]) this.dirty.add(sectionKey(col.cx, col.cz, sy));
      }
    }
  }

  /** Count of allocated (non-empty) sections — a cheap memory/draw-call indicator. */
  sectionCount() {
    let n = 0;
    for (const col of this.columns.values()) {
      for (let sy = 0; sy < SECTIONS; sy++) if (col.sections[sy]) n++;
    }
    return n;
  }

  /**
   * Fill `out` (a Uint8Array of PAD_VOLUME) with the section's voxels plus a 1-voxel shell
   * from its neighbours. Layout: index = px + PAD_X * (pz + PAD_Z * py), the section's own
   * voxel (x, y, z) at (x+1, y+1, z+1). The mesher reads only this array, so it needs no
   * access to the world — which is what lets it move into a worker unchanged.
   */
  buildPadded(cx, cz, sy, out) {
    const cols = this._nbr;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        cols[(dz + 1) * 3 + (dx + 1)] = this.columns.get(colKey(cx + dx, cz + dz)) || null;
      }
    }

    let o = 0;
    for (let py = 0; py < PAD_Y; py++) {
      const wy = sy * SECTION_H - 1 + py;
      if (wy < 0 || wy >= WORLD_H) {
        out.fill(0, o, o + PAD_X * PAD_Z);
        o += PAD_X * PAD_Z;
        continue;
      }
      const ssy = wy >> 5;
      const ly = wy & 31;
      for (let pz = 0; pz < PAD_Z; pz++) {
        const dz = pz === 0 ? -1 : pz === PAD_Z - 1 ? 1 : 0;
        const lz = pz === 0 ? CHUNK_Z - 1 : pz === PAD_Z - 1 ? 0 : pz - 1;
        const row = (lz << 4) | (ly << 8);
        const base = (dz + 1) * 3;

        // px = 0 (west neighbour, its last x)
        let c = cols[base];
        let s = c ? c.sections[ssy] : null;
        out[o] = s ? s[row | 15] : 0;

        // px = 1..16 (own column): one 16-byte row copy
        c = cols[base + 1];
        s = c ? c.sections[ssy] : null;
        if (s) out.set(s.subarray(row, row + CHUNK_X), o + 1);
        else out.fill(0, o + 1, o + 1 + CHUNK_X);

        // px = 17 (east neighbour, its first x)
        c = cols[base + 2];
        s = c ? c.sections[ssy] : null;
        out[o + PAD_X - 1] = s ? s[row] : 0;

        o += PAD_X;
      }
    }
  }
}

// Shared singleton, like the `player` object in the sibling projects.
export const world = new VoxelWorld();
