import { describe, test, expect } from 'bun:test';
import { VoxelWorld } from './voxelWorld';
import { meshSection } from './mesher';
import { sectionKey, sectionKeySy, sectionKeyCol, colKeyCx, colKeyCz, padIndex } from './blockIndex';
import { B } from '../constants/blocks';
import { PAD_VOLUME, SECTION_H } from '../constants/worldConfig';

const pad = new Uint8Array(PAD_VOLUME);

// The mesher returns { opaque, cutout }; these tests are about the opaque part.
function meshOf(world, cx, cz, sy) {
  world.buildPadded(cx, cz, sy, pad);
  return meshSection(pad).opaque;
}

// Total quads emitted across every section the world has data in.
function totalQuads(world) {
  let n = 0;
  for (const col of world.columns.values()) {
    for (let sy = 0; sy < 4; sy++) {
      if (!col.sections[sy]) continue;
      const r = meshOf(world, col.cx, col.cz, sy);
      if (r) n += r.quadCount;
    }
  }
  return n;
}

describe('mesher', () => {
  test('a single block has 6 quads, 24 vertices, 36 indices', () => {
    const w = new VoxelWorld();
    w.setBlock(5, 5, 5, B.STONE);
    const r = meshOf(w, 0, 0, 0);
    expect(r.quadCount).toBe(6);
    expect(r.vertexCount).toBe(24);
    expect(r.index.length).toBe(36);
  });

  test('empty section meshes to null', () => {
    const w = new VoxelWorld();
    w.setBlock(5, 5, 5, B.STONE);
    expect(meshOf(w, 1, 0, 0)).toBeNull();
  });

  test('adjacent blocks cull their shared face (10 quads, not 12)', () => {
    const w = new VoxelWorld();
    w.setBlock(5, 5, 5, B.STONE);
    w.setBlock(6, 5, 5, B.STONE);
    expect(meshOf(w, 0, 0, 0).quadCount).toBe(10);
  });

  test('every triangle winds counter-clockwise seen from outside', () => {
    const w = new VoxelWorld();
    w.setBlock(8, 8, 8, B.STONE);
    const r = meshOf(w, 0, 0, 0);
    const p = r.position;
    const cx = 8.5;
    const cy = 8.5;
    const cz = 8.5; // block centre in section-local coords (section 0)
    for (let t = 0; t < r.index.length; t += 3) {
      const a = r.index[t] * 3;
      const b = r.index[t + 1] * 3;
      const c = r.index[t + 2] * 3;
      const e1 = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]];
      const e2 = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
      const n = [
        e1[1] * e2[2] - e1[2] * e2[1],
        e1[2] * e2[0] - e1[0] * e2[2],
        e1[0] * e2[1] - e1[1] * e2[0],
      ];
      const mid = [
        (p[a] + p[b] + p[c]) / 3 - cx,
        (p[a + 1] + p[b + 1] + p[c + 1]) / 3 - cy,
        (p[a + 2] + p[b + 2] + p[c + 2]) / 3 - cz,
      ];
      // normal must point away from the block centre
      expect(n[0] * mid[0] + n[1] * mid[1] + n[2] * mid[2]).toBeGreaterThan(0);
    }
  });

  test('vertex positions stay within the section and UVs within the atlas', () => {
    const w = new VoxelWorld();
    w.fillBox(0, 0, 0, 15, 31, 15, B.BRICK);
    w.setBlock(3, 3, 3, B.AIR);
    const r = meshOf(w, 0, 0, 0);
    for (let i = 0; i < r.position.length; i += 3) {
      expect(r.position[i]).toBeLessThanOrEqual(16);
      expect(r.position[i + 1]).toBeLessThanOrEqual(SECTION_H);
      expect(r.position[i + 2]).toBeLessThanOrEqual(16);
    }
    for (const u of r.uv) expect(u).toBeGreaterThan(0);
  });

  test('a face on a section border is culled by the neighbour section', () => {
    // two blocks stacked across the y=31/32 section boundary: 10 quads in total, 5 each
    const w = new VoxelWorld();
    w.setBlock(4, 31, 4, B.STONE);
    w.setBlock(4, 32, 4, B.STONE);
    expect(meshOf(w, 0, 0, 0).quadCount).toBe(5);
    expect(meshOf(w, 0, 0, 1).quadCount).toBe(5);
  });

  test('a 2x2x2 cube straddling x, y and z section borders has exactly 24 quads', () => {
    const w = new VoxelWorld();
    w.fillBox(15, 31, 15, 16, 32, 16, B.CONCRETE);
    // surface of a 2x2x2 cube = 6 faces * 4 unit quads
    expect(totalQuads(w)).toBe(24);
  });

  test('a block on the far edge of a section is visible to the neighbour column', () => {
    const w = new VoxelWorld();
    w.setBlock(16, 0, 0, B.STONE); // first x of column 1
    w.buildPadded(0, 0, 0, pad);
    expect(pad[padIndex(17, 1, 1)]).toBe(B.STONE); // east shell of column 0
  });

  test('sections over 65535 vertices switch to a 32-bit index', () => {
    // 3D checkerboard: maximal exposed faces
    const w = new VoxelWorld();
    for (let y = 0; y < 32; y++)
      for (let z = 0; z < 16; z++)
        for (let x = 0; x < 16; x++) if ((x + y + z) % 2 === 0) w.setBlock(x, y, z, B.STONE);
    const r = meshOf(w, 0, 0, 0);
    expect(r.vertexCount).toBeGreaterThan(65535);
    expect(r.index).toBeInstanceOf(Uint32Array);
  });
});

describe('voxel world', () => {
  test('set/get round trip, including negative and cross-column coordinates', () => {
    const w = new VoxelWorld();
    w.setBlock(-1, 10, -17, B.BRICK);
    w.setBlock(40, 100, 7, B.STEEL);
    expect(w.getBlock(-1, 10, -17)).toBe(B.BRICK);
    expect(w.getBlock(40, 100, 7)).toBe(B.STEEL);
    expect(w.getBlock(0, 0, 0)).toBe(B.AIR);
    expect(w.getBlock(0, -5, 0)).toBe(B.AIR);
    expect(w.getBlock(0, 999, 0)).toBe(B.AIR);
  });

  test('freeing the last block of a section frees the section', () => {
    const w = new VoxelWorld();
    w.setBlock(3, 3, 3, B.STONE);
    expect(w.sectionCount()).toBe(1);
    w.setBlock(3, 3, 3, B.AIR);
    expect(w.sectionCount()).toBe(0);
  });

  test('topY follows adds and removals', () => {
    const w = new VoxelWorld();
    expect(w.topY(2, 2)).toBe(-1);
    w.setBlock(2, 10, 2, B.STONE);
    w.setBlock(2, 40, 2, B.STONE);
    expect(w.topY(2, 2)).toBe(40);
    w.setBlock(2, 40, 2, B.AIR);
    expect(w.topY(2, 2)).toBe(10);
  });

  test('fillBox agrees with setBlock and tracks heights', () => {
    const w = new VoxelWorld();
    w.fillBox(-3, 4, -3, 20, 9, 20, B.DIRT);
    expect(w.getBlock(-3, 4, -3)).toBe(B.DIRT);
    expect(w.getBlock(20, 9, 20)).toBe(B.DIRT);
    expect(w.getBlock(21, 9, 20)).toBe(B.AIR);
    expect(w.getBlock(5, 10, 5)).toBe(B.AIR);
    expect(w.topY(5, 5)).toBe(9);
  });

  test('an edit on a section corner dirties all 8 touching sections', () => {
    const w = new VoxelWorld();
    w.dirty.clear();
    w.setBlock(16, 32, 16, B.STONE); // local (0,0,0) of column (1,1), section 1
    expect(w.dirty.size).toBe(8);
  });

  test('an interior edit dirties exactly one section', () => {
    const w = new VoxelWorld();
    w.dirty.clear();
    w.setBlock(8, 8, 8, B.STONE);
    expect(w.dirty.size).toBe(1);
  });

  test('section keys round-trip', () => {
    const k = sectionKey(-3, 7, 2);
    expect(sectionKeySy(k)).toBe(2);
    const ck = sectionKeyCol(k);
    expect(colKeyCx(ck)).toBe(-3);
    expect(colKeyCz(ck)).toBe(7);
  });
});
