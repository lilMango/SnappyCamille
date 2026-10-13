import { describe, test, expect } from 'bun:test';
import { VoxelWorld } from './voxelWorld';
import { Destruction } from './destruction';
import { generateCity } from './cityGen';
import { B } from '../constants/blocks';
import { GROUND_Y } from '../constants/worldConfig';
import { BUILD_Y, SIZE } from '../constants/cityConfig';

// run update() until the queue and any collapsing buildings are done
function drain(d, dt = 1 / 60, max = 5000) {
  for (let i = 0; i < max && (d.jobs.length > 0 || d.topples.length > 0); i++) d.update(dt);
}

function slab() {
  const w = new VoxelWorld();
  w.fillBox(0, 0, 0, 80, 2, 80, B.BEDROCK);
  w.fillBox(0, 3, 0, 80, GROUND_Y, 80, B.STONE);
  w.fillBox(0, GROUND_Y + 1, 0, 80, 90, 80, B.CONCRETE); // a solid block of "city" above the street
  return w;
}

const count = (w, fn) => {
  let n = 0;
  for (let z = 0; z <= 80; z++) for (let y = 0; y <= 95; y++) for (let x = 0; x <= 80; x++) if (fn(x, y, z, w.getBlock(x, y, z))) n++;
  return n;
};

describe('carve shapes', () => {
  test('a sphere removes a ragged ball: most of the volume, nothing outside the radius', () => {
    const w = slab();
    const d = new Destruction(w, null, { voxelsPerFrame: 1e9 });
    const before = count(w, (x, y, z, id) => id !== B.AIR);
    d.applyDamage({ shape: 'sphere', cx: 40, cy: 50, cz: 40, radius: 8 });
    drain(d);
    const removed = before - count(w, (x, y, z, id) => id !== B.AIR);
    const ideal = (4 / 3) * Math.PI * 8 ** 3;
    expect(removed).toBeGreaterThan(ideal * 0.6);
    expect(removed).toBeLessThanOrEqual(ideal * 1.05);
    expect(w.getBlock(40 + 10, 50, 40)).toBe(B.CONCRETE); // outside the radius: untouched
    expect(w.getBlock(40, 50 + 9, 40)).toBe(B.CONCRETE);
    expect(w.getBlock(40, 50, 40)).toBe(B.AIR); // the centre is gone
  });

  test('the rim is ragged (not a perfect ball) but deterministic', () => {
    const run = () => {
      const w = slab();
      const d = new Destruction(w, null, { voxelsPerFrame: 1e9 });
      d.applyDamage({ shape: 'sphere', cx: 40, cy: 50, cz: 40, radius: 8, seed: 3 });
      drain(d);
      return count(w, (x, y, z, id) => id === B.AIR && y > GROUND_Y);
    };
    expect(run()).toBe(run());
    const w = slab();
    const d = new Destruction(w, null, { voxelsPerFrame: 1e9 });
    d.applyDamage({ shape: 'sphere', cx: 40, cy: 50, cz: 40, radius: 8, seed: 3 });
    drain(d);
    // some cells inside the radius survive near the edge
    let survivors = 0;
    for (let z = 32; z <= 48; z++) for (let y = 42; y <= 58; y++) for (let x = 32; x <= 48; x++) {
      const dist = Math.hypot(x + 0.5 - 40, y + 0.5 - 50, z + 0.5 - 40);
      if (dist > 6 && dist < 8 && w.getBlock(x, y, z) !== B.AIR) survivors++;
    }
    expect(survivors).toBeGreaterThan(5);
  });

  test('never carves the street surface, the ground beneath it, or bedrock', () => {
    const w = slab();
    const d = new Destruction(w, null, { voxelsPerFrame: 1e9 });
    d.applyDamage({ shape: 'sphere', cx: 40, cy: GROUND_Y, cz: 40, radius: 20 }); // default minY = GROUND_Y + 2
    drain(d);
    expect(count(w, (x, y, z, id) => y <= GROUND_Y + 1 && id === B.AIR)).toBe(0);
    // even with minY forced to 0 bedrock is unbreakable
    const d2 = new Destruction(w, null, { voxelsPerFrame: 1e9 });
    d2.applyDamage({ shape: 'sphere', cx: 40, cy: 2, cz: 40, radius: 12, minY: 0 });
    drain(d2);
    expect(w.getBlock(40, 1, 40)).toBe(B.BEDROCK);
    expect(w.getBlock(40, 10, 40)).toBe(B.AIR); // ...but the stone above it went
  });

  test('a capsule is a tube between two points', () => {
    const w = slab();
    const d = new Destruction(w, null, { voxelsPerFrame: 1e9 });
    d.applyDamage({ shape: 'capsule', cx: 10, cy: 50, cz: 40, ax: 70, ay: 50, az: 40, radius: 4 });
    drain(d);
    for (const x of [12, 30, 55, 68]) expect(w.getBlock(x, 50, 40)).toBe(B.AIR);
    expect(w.getBlock(40, 50, 40 + 6)).toBe(B.CONCRETE); // outside the tube
    expect(w.getBlock(40, 50 + 6, 40)).toBe(B.CONCRETE);
    expect(w.getBlock(5, 50, 40)).toBe(B.CONCRETE); // beyond the end cap
  });

  test('a cylinder bore respects its direction and length', () => {
    const w = slab();
    const d = new Destruction(w, null, { voxelsPerFrame: 1e9 });
    d.applyDamage({ shape: 'cylinder', cx: 20, cy: 50, cz: 40, dx: 1, dy: 0, dz: 0, length: 10, radius: 2 });
    drain(d);
    expect(w.getBlock(25, 50, 40)).toBe(B.AIR);
    expect(w.getBlock(29, 50, 40)).toBe(B.AIR);
    expect(w.getBlock(33, 50, 40)).toBe(B.CONCRETE); // past the length
    expect(w.getBlock(25, 50, 45)).toBe(B.CONCRETE); // off to the side
    expect(w.getBlock(15, 50, 40)).toBe(B.CONCRETE); // behind the start
  });

  test('flatten levels the centre and only trims further out', () => {
    const w = slab();
    const d = new Destruction(w, null, { voxelsPerFrame: 1e9 });
    d.applyDamage({ shape: 'flatten', cx: 40, cz: 40, radius: 30, falloff: 0.6 });
    drain(d);
    expect(w.topY(40, 40)).toBeLessThanOrEqual(GROUND_Y + 2); // levelled
    const far = w.topY(40 + 25, 40);
    expect(far).toBeGreaterThan(GROUND_Y + 10); // 25 out: cap is ~15 above the street
    expect(far).toBeLessThan(90);
    expect(w.topY(40 + 35, 40)).toBe(90); // beyond the radius: untouched
  });

  test('an unknown shape is an error', () => {
    const d = new Destruction(slab(), null);
    expect(() => d.applyDamage({ shape: 'nuke' })).toThrow();
  });
});

describe('budget', () => {
  test('removes at most voxelsPerFrame per update, finishes the oldest request first', () => {
    const w = slab();
    const d = new Destruction(w, null, { voxelsPerFrame: 100 });
    d.applyDamage({ shape: 'sphere', cx: 20, cy: 50, cz: 20, radius: 9, seed: 1 });
    d.applyDamage({ shape: 'sphere', cx: 60, cy: 50, cz: 60, radius: 9, seed: 1 });
    expect(d.jobs.length).toBe(2);
    d.update(1 / 60);
    expect(d.stats.removed).toBe(100);
    expect(d.removedCount).toBe(100);
    // everything removed so far is from the FIRST request
    expect(w.getBlock(60, 50, 60)).toBe(B.CONCRETE);
    const total = d.pendingCells + 100;
    drain(d);
    expect(d.stats.removed).toBe(total);
    expect(w.getBlock(60, 50, 60)).toBe(B.AIR); // and then the second
    expect(d.pendingCells).toBe(0);
  });

  test('a 3000-voxel request over a 1500 budget takes two updates', () => {
    const w = slab();
    const d = new Destruction(w, null, { voxelsPerFrame: 1500 });
    const n = d.applyDamage({ shape: 'capsule', cx: 5, cy: 50, cz: 40, ax: 75, ay: 50, az: 40, radius: 5 });
    expect(n).toBeGreaterThan(3000);
    d.update(1 / 60);
    expect(d.stats.removed).toBe(1500);
    expect(d.pendingCells).toBe(n - 1500);
  });

  test('carving marks the touched sections dirty so they remesh', () => {
    const w = slab();
    w.dirty.clear();
    const d = new Destruction(w, null, { voxelsPerFrame: 1e9 });
    d.applyDamage({ shape: 'sphere', cx: 40, cy: 50, cz: 40, radius: 6 });
    expect(w.dirty.size).toBe(0); // queued, not yet applied
    d.update(1 / 60);
    expect(w.dirty.size).toBeGreaterThan(0);
  });

  test('removed voxels are exposed with their block id, for debris', () => {
    const w = slab();
    w.setBlock(40, 50, 40, B.BRICK);
    const d = new Destruction(w, null, { voxelsPerFrame: 1e9 });
    d.applyDamage({ shape: 'sphere', cx: 40, cy: 50, cz: 40, radius: 3, seed: 1 });
    d.update(1 / 60);
    expect(d.removedCount).toBeGreaterThan(10);
    let sawBrick = false;
    for (let i = 0; i < d.removedCount; i++) {
      expect(d.rid[i]).not.toBe(0);
      if (d.rid[i] === B.BRICK && d.rx[i] === 40 && d.ry[i] === 50 && d.rz[i] === 40) sawBrick = true;
    }
    expect(sawBrick).toBe(true);
  });

  test('effect events are queued and drained', () => {
    const d = new Destruction(slab(), null);
    d.applyDamage({ shape: 'sphere', cx: 40, cy: 50, cz: 40, radius: 4, source: 'stomp' });
    const ev = d.drainEvents();
    expect(ev.length).toBe(1);
    expect(ev[0].type).toBe('carve');
    expect(ev[0].source).toBe('stomp');
    expect(d.drainEvents().length).toBe(0);
  });
});

describe('collapse', () => {
  function tower() {
    const w = new VoxelWorld();
    w.fillBox(0, 0, 0, SIZE - 1, GROUND_Y, 60, B.STONE);
    w.fillBox(10, BUILD_Y, 10, 19, BUILD_Y + 39, 19, B.CONCRETE); // a solid 10x10x40 tower
    const lotMap = new Uint16Array(SIZE * SIZE);
    for (let z = 10; z <= 19; z++) lotMap.fill(1, z * SIZE + 10, z * SIZE + 20);
    const buildings = [{ id: 1, x0: 10, z0: 10, x1: 19, z1: 19, y0: BUILD_Y, y1: BUILD_Y + 39 }];
    return { w, city: { lotMap, buildings } };
  }

  test('counts its voxels and tracks integrity as it is carved', () => {
    const { w, city } = tower();
    const d = new Destruction(w, city, { voxelsPerFrame: 1e9 });
    expect(city.buildings[0].voxelsOrig).toBe(10 * 10 * 40);
    expect(d.integrity(1)).toBe(1);
    d.applyDamage({ shape: 'sphere', cx: 14.5, cy: BUILD_Y + 5, cz: 14.5, radius: 4 });
    d.update(1 / 60);
    expect(d.integrity(1)).toBeLessThan(1);
    expect(d.integrity(1)).toBeGreaterThan(0.8);
    expect(d.stats.collapsed).toBe(0);
  });

  test('below 35% the building comes down: once, completely, top-down', () => {
    const { w, city } = tower();
    const d = new Destruction(w, city, { voxelsPerFrame: 1e9 });
    d.applyDamage({ shape: 'sphere', cx: 14.5, cy: BUILD_Y + 20, cz: 14.5, radius: 22, seed: 5 }); // gut it
    d.update(1 / 60);
    const events = d.drainEvents().filter((e) => e.type === 'collapse');
    expect(events.length).toBe(1);
    expect(events[0].building).toBe(1);
    expect(d.stats.collapsed).toBe(1);
    drain(d);
    // nothing of it is left above the base
    let left = 0;
    for (let z = 10; z <= 19; z++) for (let x = 10; x <= 19; x++) for (let y = BUILD_Y; y <= BUILD_Y + 45; y++) if (w.getBlock(x, y, z) !== B.AIR) left++;
    expect(left).toBe(0);
    expect(d.integrity(1)).toBeLessThan(0.05);
    // and it does not collapse twice
    d.applyDamage({ shape: 'sphere', cx: 14.5, cy: BUILD_Y + 5, cz: 14.5, radius: 5 });
    drain(d);
    expect(d.stats.collapsed).toBe(1);
  });

  test('a collapse is spread over frames (it takes time, not one frame)', () => {
    const { w, city } = tower();
    const d = new Destruction(w, city, { voxelsPerFrame: 1e9, toppleSeconds: 0.5 });
    d.applyDamage({ shape: 'sphere', cx: 14.5, cy: BUILD_Y + 20, cz: 14.5, radius: 22, seed: 5 });
    d.update(1 / 60);
    expect(d.topples.length).toBe(1);
    let frames = 0;
    while (d.topples.length > 0 && frames < 200) {
      d.update(1 / 60);
      frames++;
    }
    expect(frames).toBeGreaterThan(10);
    expect(frames).toBeLessThan(60); // ~0.5 s at 60 fps
  });
});

describe('against the real generated city', () => {
  test('carving a tall building lowers its integrity and eventually brings it down', () => {
    const w = new VoxelWorld();
    const city = generateCity(w, {});
    const d = new Destruction(w, { lotMap: city.lotMap, buildings: city.buildings });
    const tall = [...city.buildings].sort((a, b) => b.y1 - a.y1)[0];
    expect(tall.voxelsOrig).toBeGreaterThan(1000);
    const cx = (tall.x0 + tall.x1) / 2;
    const cz = (tall.z0 + tall.z1) / 2;
    d.applyDamage({ shape: 'sphere', cx, cy: tall.y1 - 10, cz, radius: 14, seed: 2 });
    drain(d);
    expect(d.integrity(tall.id)).toBeLessThan(1);
    // keep punching holes up the building until it falls
    for (let y = BUILD_Y + 4; y < tall.y1 && d.stats.collapsed === 0; y += 8) {
      d.applyDamage({ shape: 'sphere', cx, cy: y, cz, radius: 16, seed: y });
      drain(d);
    }
    expect(d.stats.collapsed).toBeGreaterThanOrEqual(1);
    // the street in front of it is untouched
    expect(w.isSolid(Math.floor(tall.x0 - 4), GROUND_Y, Math.floor(cz))).toBe(true);
  });
});
