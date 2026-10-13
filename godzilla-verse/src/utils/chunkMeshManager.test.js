import { describe, test, expect } from 'bun:test';
import * as THREE from 'three';
import { VoxelWorld } from './voxelWorld';
import { ChunkMeshManager } from './chunkMeshManager';
import { meshSection } from './mesher';
import { B } from '../constants/blocks';

// A pool whose replies the test delivers by hand, so ordering races can be staged.
class FakePool {
  constructor(onResult, onFail, capacity = 8) {
    this.onResult = onResult;
    this.onFail = onFail;
    this.capacity = capacity;
    this.jobs = [];
    this.size = 1;
    this.disposed = false;
  }
  get inFlight() {
    return this.jobs.length;
  }
  hasCapacity() {
    return this.jobs.length < this.capacity;
  }
  submit(id, key, pad) {
    this.jobs.push({ id, key, pad });
  }
  // deliver every queued job's reply (in submit order)
  flush() {
    const jobs = this.jobs.splice(0);
    for (const j of jobs) {
      const { opaque, cutout } = meshSection(j.pad);
      this.onResult({ id: j.id, key: j.key, opaque, cutout });
    }
  }
  dispose() {
    this.disposed = true;
  }
}

function setup(world, { renderDist = 10, workers = true } = {}) {
  const group = new THREE.Group();
  let pool = null;
  const manager = new ChunkMeshManager(world, group, {
    renderDist,
    opaqueMaterial: new THREE.MeshBasicMaterial(),
    cutoutMaterial: new THREE.MeshBasicMaterial(),
    workers: false,
    poolFactory: workers
      ? (onResult, onFail) => (pool = new FakePool(onResult, onFail))
      : undefined,
  });
  return { manager, group, getPool: () => pool };
}

const cam = (x = 8, y = 8, z = 8) => ({ x, y, z });

describe('ChunkMeshManager', () => {
  test('main-thread fallback meshes every section in the ring', () => {
    const w = new VoxelWorld();
    w.fillBox(0, 0, 0, 40, 40, 40, B.STONE); // 3x3 columns, 2 sections tall
    const { manager, group } = setup(w, { workers: false });
    for (let i = 0; i < 20 && w.dirty.size > 0; i++) manager.update(cam(20, 60, 20));
    expect(w.dirty.size).toBe(0);
    expect(manager.entries.size).toBe(w.sectionCount());
    expect(group.children.length).toBe(w.sectionCount());
    expect(manager.totalBytes).toBeGreaterThan(0);
  });

  test('with a pool, geometry only appears after the reply is delivered', () => {
    const w = new VoxelWorld();
    w.setBlock(3, 3, 3, B.STONE);
    const { manager, group, getPool } = setup(w);
    manager.update(cam());
    expect(getPool().inFlight).toBe(1);
    expect(group.children.length).toBe(0);
    getPool().flush();
    manager.update(cam());
    expect(group.children.length).toBe(1);
    expect(manager.stats.quads).toBe(6);
  });

  test('a reply for a section that left the ring is dropped (no resurrected mesh)', () => {
    const w = new VoxelWorld();
    w.setBlock(3, 3, 3, B.STONE); // column (0,0)
    const { manager, group, getPool } = setup(w, { renderDist: 2 });
    manager.update(cam());
    expect(getPool().inFlight).toBe(1);

    manager.update(cam(16 * 20, 8, 8)); // fly far away: column deactivates, job is forgotten
    getPool().flush(); // the slow reply finally arrives
    manager.update(cam(16 * 20, 8, 8));
    expect(manager.entries.size).toBe(0);
    expect(group.children.length).toBe(0);
  });

  test('a reply for a section emptied meanwhile never leaves a stale mesh behind', () => {
    const w = new VoxelWorld();
    w.setBlock(3, 3, 3, B.STONE);
    const { manager, group, getPool } = setup(w);
    manager.update(cam());
    w.setBlock(3, 3, 3, B.AIR); // section freed while its job is out
    manager.update(cam()); // in flight: stays dirty, waits
    getPool().flush();
    for (let i = 0; i < 3; i++) manager.update(cam()); // reply applied, then the dirty pass removes it
    expect(manager.entries.size).toBe(0);
    expect(group.children.length).toBe(0);
    expect(manager.totalBytes).toBe(0);
    expect(manager.totalQuads).toBe(0);
  });

  test('an edit while a job is in flight is re-sent afterwards', () => {
    const w = new VoxelWorld();
    w.setBlock(2, 2, 2, B.STONE);
    const { manager, getPool } = setup(w);
    manager.update(cam());
    w.setBlock(6, 2, 6, B.STONE); // second, non-adjacent block in the same section
    manager.update(cam());
    expect(getPool().inFlight).toBe(1); // not duplicated while the first is out

    getPool().flush();
    manager.update(cam()); // applies job 1 (one block), then dispatches job 2
    expect(manager.stats.quads).toBe(6);
    expect(getPool().inFlight).toBe(1);

    getPool().flush();
    manager.update(cam());
    expect(manager.stats.quads).toBe(12); // both blocks
  });

  test('the ring meshes nearby columns and unmeshes far ones (with hysteresis)', () => {
    const w = new VoxelWorld();
    w.setBlock(3, 3, 3, B.STONE); // column (0,0)
    w.setBlock(16 * 8 + 3, 3, 3, B.STONE); // column (8,0)
    const { manager } = setup(w, { renderDist: 3, workers: false });

    manager.update(cam(8, 8, 8));
    expect([...manager.entries.keys()].length).toBe(1); // only column 0

    manager.update(cam(16 * 8 + 8, 8, 8)); // move over to column 8
    for (let i = 0; i < 5; i++) manager.update(cam(16 * 8 + 8, 8, 8));
    expect(manager.entries.size).toBe(1); // column 8 in, column 0 dropped (8 > 3+2)
    expect(manager.active.size).toBe(1);

    // hysteresis: a column just past renderDist but within renderDist+2 is not dropped
    const w2 = new VoxelWorld();
    w2.setBlock(3, 3, 3, B.STONE);
    const { manager: m2 } = setup(w2, { renderDist: 3, workers: false });
    m2.update(cam(8, 8, 8)); // active
    m2.update(cam(16 * 4 + 8, 8, 8)); // 4 chunks away: > R(3) but <= R+2(5)
    expect(m2.entries.size).toBe(1);
  });

  test('a new section in an already-active column is meshed on the next update', () => {
    // isolates the sort cache: no new column involved, only a same-size queue
    const w = new VoxelWorld();
    w.setBlock(3, 3, 3, B.STONE); // column (0,0), section 0
    const { manager } = setup(w, { workers: false });
    manager.update(cam());
    expect(manager.entries.size).toBe(1);

    w.setBlock(3, 40, 3, B.STONE); // same column, section 1: queue is again exactly 1 key
    manager.update(cam());
    expect(manager.entries.size).toBe(2);
  });

  test('a section in a brand-new column inside the ring is meshed without waiting for a scan', () => {
    // Regression: the nearest-first order was cached by queue *size*, so after one section
    // was handled, a different section becoming dirty (same size) was missed for ~200 ms.
    const w = new VoxelWorld();
    w.setBlock(3, 3, 3, B.STONE); // column (0,0): the queue holds exactly 1 section
    const { manager } = setup(w, { workers: false });
    manager.update(cam()); // sorts a 1-key queue, meshes it, queue now empty
    expect(manager.entries.size).toBe(1);

    w.setBlock(40, 3, 3, B.STONE); // a different section: the queue is again exactly 1 key
    manager.update(cam()); // one update must be enough to mesh it
    expect(manager.entries.size).toBe(2);
  });

  test('a worker failure falls back to the main thread and re-queues lost jobs', () => {
    const w = new VoxelWorld();
    w.setBlock(3, 3, 3, B.STONE);
    const group = new THREE.Group();
    let fail;
    const manager = new ChunkMeshManager(w, group, {
      opaqueMaterial: new THREE.MeshBasicMaterial(),
      cutoutMaterial: new THREE.MeshBasicMaterial(),
      poolFactory: (onResult, onFail) => {
        fail = onFail;
        return new FakePool(onResult, onFail);
      },
    });
    manager.update(cam());
    expect(manager.inFlight.size).toBe(1);

    fail(new Error('worker crashed'));
    expect(manager.pool).toBeNull();
    for (let i = 0; i < 3; i++) manager.update(cam());
    expect(group.children.length).toBe(1); // meshed inline instead
    expect(manager.stats.workers).toBe(0);
  });

  test('dispose releases everything', () => {
    const w = new VoxelWorld();
    w.fillBox(0, 0, 0, 20, 10, 20, B.STONE);
    const { manager, group } = setup(w, { workers: false });
    for (let i = 0; i < 10; i++) manager.update(cam());
    expect(group.children.length).toBeGreaterThan(0);
    manager.dispose();
    expect(group.children.length).toBe(0);
    expect(manager.entries.size).toBe(0);
  });
});
