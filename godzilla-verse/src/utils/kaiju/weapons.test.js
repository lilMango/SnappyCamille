import { describe, test, expect } from 'bun:test';
import { VoxelWorld } from '../voxelWorld';
import { aimDir, beamEnd, sweepYaw, distToSegment, lightningBolt } from './weapons';
import { mulberry32 } from '../rng';
import { B } from '../../constants/blocks';

describe('aimDir', () => {
  test('yaw 0 looks toward -z, +90 degrees toward -x, pitch tilts up', () => {
    const d = aimDir(0, 0);
    expect(d.z).toBeCloseTo(-1, 6);
    const e = aimDir(Math.PI / 2, 0);
    expect(e.x).toBeCloseTo(-1, 6);
    const u = aimDir(0, 0.5);
    expect(u.y).toBeCloseTo(Math.sin(0.5), 6);
    expect(Math.hypot(u.x, u.y, u.z)).toBeCloseTo(1, 6);
  });
});

describe('beamEnd', () => {
  test('stops at the first solid block, with the end point on its face', () => {
    const w = new VoxelWorld();
    w.fillBox(50, 0, -20, 50, 100, 20, B.CONCRETE);
    const out = {};
    beamEnd(w, 10, 40, 0.5, 1, 0, 0, 140, out);
    expect(out.hit).toBe(true);
    expect(out.len).toBeCloseTo(40, 4);
    expect(out.x).toBeCloseTo(50, 4);
  });

  test('runs to full range through open air', () => {
    const w = new VoxelWorld();
    const out = {};
    beamEnd(w, 0, 40, 0, 0, 0, -1, 140, out);
    expect(out.hit).toBe(false);
    expect(out.len).toBe(140);
    expect(out.z).toBeCloseTo(-140, 4);
  });

  test('a wall beyond the range is not hit', () => {
    const w = new VoxelWorld();
    w.fillBox(200, 0, -20, 200, 100, 20, B.CONCRETE);
    const out = {};
    beamEnd(w, 10, 40, 0.5, 1, 0, 0, 140, out);
    expect(out.hit).toBe(false);
  });
});

describe('sweepYaw', () => {
  test('goes from -sweep to +sweep, monotonic, clamped', () => {
    const s = 0.5;
    expect(sweepYaw(0, 2.5, s)).toBeCloseTo(-s, 9);
    expect(sweepYaw(1.25, 2.5, s)).toBeCloseTo(0, 9);
    expect(sweepYaw(2.5, 2.5, s)).toBeCloseTo(s, 9);
    expect(sweepYaw(-1, 2.5, s)).toBeCloseTo(-s, 9);
    expect(sweepYaw(99, 2.5, s)).toBeCloseTo(s, 9);
    let prev = -1e9;
    for (let t = 0; t <= 2.5; t += 0.1) {
      const y = sweepYaw(t, 2.5, s);
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
    }
  });
});

describe('distToSegment', () => {
  test('perpendicular, past either end, and degenerate segments', () => {
    expect(distToSegment(5, 3, 0, 0, 0, 0, 10, 0, 0)).toBeCloseTo(3, 9);
    expect(distToSegment(-4, 3, 0, 0, 0, 0, 10, 0, 0)).toBeCloseTo(5, 9); // nearest point is the start
    expect(distToSegment(14, 3, 0, 0, 0, 0, 10, 0, 0)).toBeCloseTo(5, 9); // nearest point is the end
    expect(distToSegment(3, 4, 0, 0, 0, 0, 0, 0, 0)).toBeCloseTo(5, 9); // a point
  });
});

describe('lightningBolt', () => {
  const bolt = (seed = 1, levels = 5, jitter = 0.12) => lightningBolt(0, 80, 0, 60, 10, 40, levels, jitter, mulberry32(seed));

  test('has 2^levels + 1 points and exact end points', () => {
    const p = bolt();
    expect(p.length).toBe(33 * 3);
    expect([p[0], p[1], p[2]]).toEqual([0, 80, 0]);
    expect(p[32 * 3]).toBeCloseTo(60, 4);
    expect(p[32 * 3 + 1]).toBeCloseTo(10, 4);
    expect(p[32 * 3 + 2]).toBeCloseTo(40, 4);
  });

  test('is jagged (not a straight line) but stays a bolt: bounded sideways displacement', () => {
    const p = bolt(7);
    const len = Math.hypot(60, 70, 40);
    let maxOff = 0;
    for (let i = 0; i < 33; i++) {
      // distance from the straight A-B line
      const off = distToSegment(p[i * 3], p[i * 3 + 1], p[i * 3 + 2], 0, 80, 0, 60, 10, 40);
      maxOff = Math.max(maxOff, off);
    }
    expect(maxOff).toBeGreaterThan(0.5); // jagged
    expect(maxOff).toBeLessThan(len * 0.12 * 2.5); // bounded
  });

  test('the path never doubles back: it keeps making progress toward the target', () => {
    const p = bolt(3);
    const dir = [60, -70, 40].map((v) => v / Math.hypot(60, 70, 40));
    let last = -1e9;
    let back = 0;
    for (let i = 0; i < 33; i++) {
      const along = p[i * 3] * dir[0] + (p[i * 3 + 1] - 80) * dir[1] + p[i * 3 + 2] * dir[2];
      if (along < last - 3) back++;
      last = along;
    }
    expect(back).toBe(0);
  });

  test('a seeded bolt is reproducible and different seeds differ', () => {
    const a = bolt(5);
    const b = bolt(5);
    const c = bolt(6);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(c));
  });

  test('works for vertical bolts (straight down) without NaNs', () => {
    const p = lightningBolt(10, 100, 10, 10, 20, 10, 4, 0.1, mulberry32(2));
    for (const v of p) expect(Number.isFinite(v)).toBe(true);
    expect(p[0]).toBe(10);
    expect(p[16 * 3 + 1]).toBeCloseTo(20, 4);
  });
});
