import { describe, test, expect } from 'bun:test';
import { VoxelWorld } from './voxelWorld';
import { raycastVoxel, createHit } from './raycast';
import { B } from '../constants/blocks';

function world() {
  const w = new VoxelWorld();
  w.fillBox(-20, 0, -20, 60, 19, 60, B.STONE); // floor: top face at y = 20
  return w;
}

const cast = (w, o, d, max = 50) => {
  const hit = createHit();
  const ok = raycastVoxel(w, o[0], o[1], o[2], d[0], d[1], d[2], max, hit);
  return ok ? hit : null;
};

describe('raycastVoxel', () => {
  test('straight down hits the floor top with the right normal and distance', () => {
    const h = cast(world(), [5.5, 30.5, 5.5], [0, -1, 0]);
    expect(h).not.toBeNull();
    expect([h.x, h.y, h.z]).toEqual([5, 19, 5]);
    expect([h.nx, h.ny, h.nz]).toEqual([0, 1, 0]);
    expect(h.t).toBeCloseTo(10.5, 6);
    expect(h.py).toBeCloseTo(20, 6);
  });

  test('+x ray hits a wall on its near face', () => {
    const w = world();
    w.setBlock(10, 21, 5, B.BRICK);
    const h = cast(w, [5.5, 21.5, 5.5], [1, 0, 0]);
    expect([h.x, h.y, h.z]).toEqual([10, 21, 5]);
    expect([h.nx, h.ny, h.nz]).toEqual([-1, 0, 0]);
    expect(h.t).toBeCloseTo(4.5, 6);
    expect(h.px).toBeCloseTo(10, 6);
  });

  test('-x and -z rays report positive normals', () => {
    const w = world();
    w.setBlock(0, 21, 5, B.BRICK);
    const hx = cast(w, [5.5, 21.5, 5.5], [-1, 0, 0]);
    expect([hx.nx, hx.ny, hx.nz]).toEqual([1, 0, 0]);
    expect(hx.t).toBeCloseTo(4.5, 6);
    w.setBlock(5, 21, 0, B.BRICK);
    const hz = cast(w, [5.5, 21.5, 5.5], [0, 0, -1]);
    expect([hz.nx, hz.ny, hz.nz]).toEqual([0, 0, 1]);
  });

  test('misses beyond maxDist and in empty space', () => {
    const w = world();
    w.setBlock(10, 21, 5, B.BRICK);
    expect(cast(w, [5.5, 21.5, 5.5], [1, 0, 0], 4)).toBeNull();
    expect(cast(w, [5.5, 21.5, 5.5], [0, 1, 0], 50)).toBeNull(); // straight up: nothing there
    expect(cast(w, [5.5, 21.5, 5.5], [0, 0, 0])).toBeNull(); // no direction
  });

  test('a ray starting inside a block hits it at t = 0 with no normal', () => {
    const h = cast(world(), [5.5, 10.5, 5.5], [1, 0, 0]);
    expect(h.t).toBe(0);
    expect([h.nx, h.ny, h.nz]).toEqual([0, 0, 0]);
    expect([h.x, h.y, h.z]).toEqual([5, 10, 5]);
  });

  test('a diagonal ray lands in the expected cell', () => {
    const h = cast(world(), [5.2, 25.5, 5.5], [1, -1, 0]); // hits y=20 after dropping 5.5 -> x = 10.7
    expect([h.x, h.y, h.z]).toEqual([10, 19, 5]);
    expect(h.ny).toBe(1);
    expect(h.px).toBeCloseTo(10.7, 5);
    expect(h.t).toBeCloseTo(5.5 * Math.SQRT2, 5);
  });

  test('returns the nearest of several blocks', () => {
    const w = world();
    w.setBlock(12, 21, 5, B.BRICK);
    w.setBlock(8, 21, 5, B.BRICK);
    expect(cast(w, [5.5, 21.5, 5.5], [1, 0, 0]).x).toBe(8);
  });

  test('works across column borders and in negative coordinates', () => {
    const w = world();
    w.setBlock(40, 21, 5, B.STEEL); // 2+ columns away
    expect(cast(w, [2.5, 21.5, 5.5], [1, 0, 0]).x).toBe(40);
    const h = cast(w, [-3.5, 30, -3.5], [0, -1, 0]);
    expect([h.x, h.y, h.z]).toEqual([-4, 19, -4]);
  });

  test('an un-normalised direction gives the same answer', () => {
    const w = world();
    const a = cast(w, [5.5, 30.5, 5.5], [0, -1, 0]);
    const b = cast(w, [5.5, 30.5, 5.5], [0, -7, 0]);
    expect(b.t).toBeCloseTo(a.t, 9);
  });

  test('skimming along a face on an exact grid line still resolves', () => {
    const w = world();
    w.setBlock(10, 21, 5, B.BRICK);
    const h = cast(w, [5.5, 21.0, 5.5], [1, 0, 0]); // y exactly on a grid plane
    expect(h).not.toBeNull();
    expect(h.x).toBe(10);
  });
});
