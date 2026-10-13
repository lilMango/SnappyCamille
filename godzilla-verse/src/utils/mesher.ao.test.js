import { describe, test, expect } from 'bun:test';
import { VoxelWorld } from './voxelWorld';
import { meshSection } from './mesher';
import { B } from '../constants/blocks';
import { PAD_VOLUME } from '../constants/worldConfig';

const pad = new Uint8Array(PAD_VOLUME);

function meshBoth(world, cx, cz, sy) {
  world.buildPadded(cx, cz, sy, pad);
  return meshSection(pad);
}
const meshOf = (world, cx, cz, sy) => meshBoth(world, cx, cz, sy).opaque;

// Every triangle must wind the same way as its quad (verts 0,1,2). The AO diagonal flip
// re-orders indices, so this guards against flipped (back-facing) triangles.
function expectTrianglesMatchQuads(r) {
  const p = r.position;
  const normal = (a, b, c) => {
    const e1 = [p[b * 3] - p[a * 3], p[b * 3 + 1] - p[a * 3 + 1], p[b * 3 + 2] - p[a * 3 + 2]];
    const e2 = [p[c * 3] - p[a * 3], p[c * 3 + 1] - p[a * 3 + 1], p[c * 3 + 2] - p[a * 3 + 2]];
    return [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  };
  for (let t = 0; t < r.index.length; t += 3) {
    const [a, b, c] = [r.index[t], r.index[t + 1], r.index[t + 2]];
    const q = a & ~3; // first vertex of this triangle's quad
    const qn = normal(q, q + 1, q + 2);
    const tn = normal(a, b, c);
    expect(qn[0] * tn[0] + qn[1] * tn[1] + qn[2] * tn[2]).toBeGreaterThan(0);
  }
}

// quads whose four vertices all satisfy `pred`, as arrays of {x,y,z,c}
function quadsWhere(r, pred) {
  const out = [];
  for (let q = 0; q < r.vertexCount; q += 4) {
    const vs = [];
    for (let k = 0; k < 4; k++) {
      const v = q + k;
      vs.push({ x: r.position[v * 3], y: r.position[v * 3 + 1], z: r.position[v * 3 + 2], c: r.color[v * 3] });
    }
    if (vs.every(pred)) out.push(vs);
  }
  return out;
}

describe('ambient occlusion', () => {
  test('an unobstructed block has uniform brightness on every face', () => {
    const w = new VoxelWorld();
    w.setBlock(8, 8, 8, B.STONE);
    const r = meshOf(w, 0, 0, 0);
    for (let q = 0; q < r.vertexCount; q += 4) {
      const c = r.color[q * 3];
      for (let k = 1; k < 4; k++) expect(r.color[(q + k) * 3]).toBe(c);
    }
  });

  test('a wall darkens the floor vertices that touch it', () => {
    const w = new VoxelWorld();
    w.fillBox(4, 5, 5, 6, 5, 5, B.STONE); // floor strip
    w.setBlock(6, 6, 5, B.STONE); // wall rising from its east end
    const r = meshOf(w, 0, 0, 0);
    // top face of the floor block at x=5: vertices at y=6, x in [5,6]
    const [top] = quadsWhere(r, (v) => v.y === 6 && v.x >= 5 && v.x <= 6 && v.z >= 5 && v.z <= 6);
    const east = top.filter((v) => v.x === 6).map((v) => v.c);
    const west = top.filter((v) => v.x === 5).map((v) => v.c);
    expect(Math.max(...east)).toBeLessThan(Math.min(...west)); // the wall side is darker
  });

  test('triangles keep the quad winding after the AO diagonal flip', () => {
    const w = new VoxelWorld();
    w.fillBox(2, 5, 2, 12, 5, 12, B.STONE); // slab
    w.fillBox(6, 6, 6, 8, 8, 8, B.STONE); // block on it: varied AO on the slab top
    w.setBlock(4, 6, 4, B.STONE);
    w.setBlock(10, 6, 9, B.STONE);
    expectTrianglesMatchQuads(meshOf(w, 0, 0, 0));
  });

  test('AO is computed across section borders', () => {
    // a block just over the x border darkens the edge vertices of the neighbour's floor
    const w = new VoxelWorld();
    w.fillBox(12, 5, 5, 15, 5, 5, B.STONE); // floor in column 0
    w.setBlock(16, 6, 5, B.STONE); // wall in column 1
    const r = meshOf(w, 0, 0, 0);
    const [top] = quadsWhere(r, (v) => v.y === 6 && v.x >= 15 && v.x <= 16 && v.z >= 5 && v.z <= 6);
    const edge = top.filter((v) => v.x === 16).map((v) => v.c);
    const inner = top.filter((v) => v.x === 15).map((v) => v.c);
    expect(Math.max(...edge)).toBeLessThan(Math.min(...inner));
  });

  test('builder growth keeps every quad intact (24 576 quads in one section)', () => {
    const w = new VoxelWorld();
    for (let y = 0; y < 32; y++)
      for (let z = 0; z < 16; z++)
        for (let x = 0; x < 16; x++) if ((x + y + z) % 2 === 0) w.setBlock(x, y, z, B.STONE);
    const r = meshOf(w, 0, 0, 0);
    expect(r.quadCount).toBe(4096 * 6);
    expectTrianglesMatchQuads(r);
  });
});

describe('cutout pass', () => {
  test('a fence meshes into the cutout part only', () => {
    const w = new VoxelWorld();
    w.setBlock(5, 5, 5, B.FENCE);
    const r = meshBoth(w, 0, 0, 0);
    expect(r.opaque).toBeNull();
    expect(r.cutout.quadCount).toBe(6);
  });

  test('adjacent fences hide their shared face', () => {
    const w = new VoxelWorld();
    w.setBlock(5, 5, 5, B.FENCE);
    w.setBlock(6, 5, 5, B.FENCE);
    expect(meshBoth(w, 0, 0, 0).cutout.quadCount).toBe(10);
  });

  test('a fence does not hide the opaque block behind it, but is hidden by it', () => {
    const w = new VoxelWorld();
    w.setBlock(5, 5, 5, B.STONE);
    w.setBlock(6, 5, 5, B.FENCE);
    const r = meshBoth(w, 0, 0, 0);
    expect(r.opaque.quadCount).toBe(6); // stone keeps its face toward the fence
    expect(r.cutout.quadCount).toBe(5); // fence loses the face against the stone
  });
});
