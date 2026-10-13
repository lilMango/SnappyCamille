import { B, UNBREAKABLE } from '../constants/blocks';
import { GROUND_Y } from '../constants/worldConfig';
import { BUILD_Y, SIZE } from '../constants/cityConfig';
import { KAIJU } from '../constants/kaijuConfig';
import { hash3 } from './rng';

/**
 * Voxel destruction behind ONE seam:
 *
 *   destruction.applyDamage({ shape, ... })
 *
 * Phase 6 implements it with simple carving (this file). Phase 10 swaps in real block physics
 * behind the same signature, so none of the kaiju code changes.
 *
 * Shapes (all coordinates are world blocks, y up):
 *   sphere    { cx, cy, cz, radius }                       ragged rim (skips more cells toward the edge)
 *   capsule   { cx, cy, cz, ax, ay, az, radius }           a tube between two points (a kaiju's body)
 *   cylinder  { cx, cy, cz, dx, dy, dz, length, radius }   along a direction (a beam bore)
 *   flatten   { cx, cz, radius, falloff }                  shockwave: everything above a rising cap
 * Common: minY (never carve below it), source (a label for effects), seed.
 *
 * Budget: a request becomes a queue of cells; update() removes at most `voxelsPerFrame` per
 * frame, FIFO. A big carve therefore trails the beam by a few frames, which reads as the beam
 * eating through the building, and a burst of requests can never stall a frame.
 *
 * Buildings: removals are counted against the building they belong to (via the city's lot
 * map). When one falls below `toppleThreshold` of its original voxels it is scripted to
 * collapse: its remaining layers are removed top-down over ~0.5 s.
 *
 * Pure: depends only on the world's getBlock/setBlock.
 */

const MAX_REMOVED = 4096; // ring of removed voxels exposed to the debris spawner each frame

export class Destruction {
  /**
   * @param world       VoxelWorld
   * @param city        { lotMap: Uint16Array, buildings: [{id,x0,z0,x1,z1,y0,y1,voxelsOrig?}] } | null
   * @param cfg         overrides for KAIJU.destruction (tests use a small budget)
   */
  constructor(world, city = null, cfg = {}) {
    this.world = world;
    this.lotMap = city ? city.lotMap : null;
    this.buildings = city ? city.buildings : [];
    this.cfg = { ...KAIJU.destruction, ...cfg };
    this.jobs = []; // { cells: Int32Array (x,y,z triples), i, source }
    this.topples = []; // { b, y }  y = the next layer to remove, descending
    this.events = []; // { type: 'collapse'|'carve', x, y, z, building? } for effects; the consumer drains them
    this.stats = { removed: 0, queued: 0, collapsed: 0, requests: 0 };

    // voxels removed during the last update(), for debris
    this.rx = new Int16Array(MAX_REMOVED);
    this.ry = new Int16Array(MAX_REMOVED);
    this.rz = new Int16Array(MAX_REMOVED);
    this.rid = new Uint8Array(MAX_REMOVED);
    this.removedCount = 0;

    // per-building bookkeeping
    this.remaining = new Map(); // id -> voxels left
    for (const b of this.buildings) {
      this.remaining.set(b.id, b.voxelsOrig ?? this._count(b));
      if (b.voxelsOrig === undefined) b.voxelsOrig = this.remaining.get(b.id);
    }
    this.collapsed = new Set();
  }

  _count(b) {
    let n = 0;
    for (let z = b.z0; z <= b.z1; z++) {
      for (let x = b.x0; x <= b.x1; x++) {
        for (let y = BUILD_Y; y <= b.y1 + 30; y++) if (this.world.getBlock(x, y, z) !== B.AIR) n++;
      }
    }
    return n;
  }

  /** Hand the queued effect events to the caller and clear them. */
  drainEvents(out = []) {
    for (const e of this.events) out.push(e);
    this.events.length = 0;
    return out;
  }

  get pendingCells() {
    let n = 0;
    for (const j of this.jobs) n += j.cells.length / 3 - j.i;
    return n;
  }

  // ---- the seam -------------------------------------------------------------------

  /** Queue damage. Returns the number of cells queued. */
  applyDamage(req) {
    const minY = req.minY ?? this.cfg.minY;
    const seed = req.seed ?? 1;
    let cells;
    switch (req.shape) {
      case 'sphere':
        cells = this._sphere(req, minY, seed);
        break;
      case 'capsule':
        cells = this._capsule(req, minY, seed);
        break;
      case 'cylinder':
        cells = this._cylinder(req, minY);
        break;
      case 'flatten':
        cells = this._flatten(req, minY);
        break;
      default:
        throw new Error(`unknown damage shape: ${req.shape}`);
    }
    this.stats.requests++;
    if (cells.length === 0) return 0;
    this.jobs.push({ cells, i: 0, source: req.source || '' });
    this.stats.queued += cells.length / 3;
    this.events.push({ type: 'carve', x: req.cx, y: req.cy ?? minY, z: req.cz, source: req.source || '', radius: req.radius || 0 });
    return cells.length / 3;
  }

  // Enumerate the solid, carvable cells of a shape (so the budget can spread them over frames).
  _collect(x0, y0, z0, x1, y1, z1, minY, keep) {
    const out = [];
    const w = this.world;
    for (let y = Math.max(y0, minY); y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          const id = w.getBlock(x, y, z);
          if (id === B.AIR || UNBREAKABLE[id]) continue;
          if (keep(x, y, z)) out.push(x, y, z);
        }
      }
    }
    return Int32Array.from(out);
  }

  _sphere(r, minY, seed) {
    const R = r.radius;
    return this._collect(
      Math.floor(r.cx - R), Math.floor(r.cy - R), Math.floor(r.cz - R),
      Math.ceil(r.cx + R), Math.ceil(r.cy + R), Math.ceil(r.cz + R),
      minY,
      (x, y, z) => {
        const d = Math.hypot(x + 0.5 - r.cx, y + 0.5 - r.cy, z + 0.5 - r.cz);
        if (d > R) return false;
        // ragged rim: a block survives with probability 0.6 * (d/R)^6 — essentially only in the outer
        // fifth of the radius, so you get a clean hole with a jagged edge, not a sprinkle of blocks
        return hash3(x, y, z, seed) >= (d / R) ** 6 * 0.6;
      },
    );
  }

  _capsule(r, minY, seed) {
    const R = r.radius;
    const { cx, cy, cz, ax, ay, az } = r;
    const abx = ax - cx;
    const aby = ay - cy;
    const abz = az - cz;
    const ab2 = abx * abx + aby * aby + abz * abz || 1;
    return this._collect(
      Math.floor(Math.min(cx, ax) - R), Math.floor(Math.min(cy, ay) - R), Math.floor(Math.min(cz, az) - R),
      Math.ceil(Math.max(cx, ax) + R), Math.ceil(Math.max(cy, ay) + R), Math.ceil(Math.max(cz, az) + R),
      minY,
      (x, y, z) => {
        const px = x + 0.5 - cx;
        const py = y + 0.5 - cy;
        const pz = z + 0.5 - cz;
        const t = Math.max(0, Math.min(1, (px * abx + py * aby + pz * abz) / ab2));
        const d = Math.hypot(px - abx * t, py - aby * t, pz - abz * t);
        if (d > R) return false;
        return hash3(x, y, z, seed) >= (d / R) ** 4 * 0.6;
      },
    );
  }

  _cylinder(r, minY) {
    const R = r.radius;
    const len = Math.hypot(r.dx, r.dy, r.dz) || 1;
    const dx = r.dx / len;
    const dy = r.dy / len;
    const dz = r.dz / len;
    const L = r.length;
    const ex = r.cx + dx * L;
    const ey = r.cy + dy * L;
    const ez = r.cz + dz * L;
    return this._collect(
      Math.floor(Math.min(r.cx, ex) - R), Math.floor(Math.min(r.cy, ey) - R), Math.floor(Math.min(r.cz, ez) - R),
      Math.ceil(Math.max(r.cx, ex) + R), Math.ceil(Math.max(r.cy, ey) + R), Math.ceil(Math.max(r.cz, ez) + R),
      minY,
      (x, y, z) => {
        const px = x + 0.5 - r.cx;
        const py = y + 0.5 - r.cy;
        const pz = z + 0.5 - r.cz;
        const t = px * dx + py * dy + pz * dz;
        if (t < 0 || t > L) return false;
        return Math.hypot(px - dx * t, py - dy * t, pz - dz * t) <= R;
      },
    );
  }

  // Shockwave: remove everything above a cap that rises with distance from the centre, so the
  // city is levelled near the blast and merely trimmed further out.
  _flatten(r, minY) {
    const R = r.radius;
    const falloff = r.falloff ?? 0.6;
    const out = [];
    const w = this.world;
    for (let z = Math.floor(r.cz - R); z <= Math.ceil(r.cz + R); z++) {
      for (let x = Math.floor(r.cx - R); x <= Math.ceil(r.cx + R); x++) {
        const d = Math.hypot(x + 0.5 - r.cx, z + 0.5 - r.cz);
        if (d > R) continue;
        const cap = GROUND_Y + 1 + Math.floor(d * falloff);
        for (let y = Math.max(cap, minY); y < 128; y++) {
          const id = w.getBlock(x, y, z);
          if (id !== B.AIR && !UNBREAKABLE[id]) out.push(x, y, z);
        }
      }
    }
    return Int32Array.from(out);
  }

  // ---- per frame --------------------------------------------------------------------

  /** Process the queue under the voxel budget, advance collapsing buildings. dt in seconds. */
  update(dt) {
    this.removedCount = 0;
    let budget = this.cfg.voxelsPerFrame;

    // FIFO: finish the oldest request before starting the next
    while (budget > 0 && this.jobs.length > 0) {
      const job = this.jobs[0];
      const total = job.cells.length / 3;
      while (job.i < total && budget > 0) {
        const o = job.i * 3;
        this._remove(job.cells[o], job.cells[o + 1], job.cells[o + 2]);
        job.i++;
        budget--;
      }
      if (job.i >= total) this.jobs.shift();
    }

    // collapsing buildings come down top-down, spread over toppleSeconds
    for (let t = this.topples.length - 1; t >= 0 && budget > 0; t--) {
      const tp = this.topples[t];
      const layers = Math.max(1, Math.ceil((tp.total * dt) / this.cfg.toppleSeconds));
      for (let l = 0; l < layers && tp.y >= BUILD_Y && budget > 0; l++, tp.y--) {
        const b = tp.b;
        for (let z = b.z0; z <= b.z1; z++) {
          for (let x = b.x0; x <= b.x1; x++) {
            if (this.world.getBlock(x, tp.y, z) !== B.AIR) {
              this._remove(x, tp.y, z);
              budget--;
            }
          }
        }
      }
      if (tp.y < BUILD_Y) this.topples.splice(t, 1);
    }
  }

  _remove(x, y, z) {
    const id = this.world.getBlock(x, y, z);
    if (id === B.AIR || UNBREAKABLE[id]) return;
    this.world.setBlock(x, y, z, B.AIR);
    this.stats.removed++;
    if (this.removedCount < MAX_REMOVED) {
      const k = this.removedCount++;
      this.rx[k] = x;
      this.ry[k] = y;
      this.rz[k] = z;
      this.rid[k] = id;
    }
    // building bookkeeping
    if (this.lotMap && y >= BUILD_Y) {
      const bid = this.lotMap[z * SIZE + x];
      if (bid > 0) {
        const left = (this.remaining.get(bid) ?? 0) - 1;
        this.remaining.set(bid, left); // keep counting through a collapse so integrity() stays honest
        const b = this.buildings[bid - 1];
        if (b && !this.collapsed.has(bid) && left < b.voxelsOrig * this.cfg.toppleThreshold) this._startTopple(b);
      }
    }
  }

  _startTopple(b) {
    this.collapsed.add(b.id);
    this.stats.collapsed++;
    // start from the highest remaining layer
    let top = b.y1 + 30;
    while (top > BUILD_Y) {
      let any = false;
      for (let z = b.z0; z <= b.z1 && !any; z++) for (let x = b.x0; x <= b.x1; x++) if (this.world.getBlock(x, top, z) !== B.AIR) { any = true; break; }
      if (any) break;
      top--;
    }
    this.topples.push({ b, y: top, total: top - BUILD_Y + 1 });
    this.events.push({ type: 'collapse', x: (b.x0 + b.x1) / 2, y: top, z: (b.z0 + b.z1) / 2, building: b.id, height: top - BUILD_Y });
  }

  /** How much of a building is left, 0..1. */
  integrity(id) {
    const b = this.buildings[id - 1];
    if (!b) return 0;
    return Math.max(0, (this.remaining.get(id) ?? 0) / b.voxelsOrig);
  }
}
