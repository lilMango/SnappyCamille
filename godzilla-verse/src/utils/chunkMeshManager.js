import * as THREE from 'three';
import { CHUNK_X, CHUNK_Z, SECTION_H, SECTIONS, PAD_VOLUME, RENDER_DIST } from '../constants/worldConfig';
import { sectionKey, sectionKeySy, sectionKeyCol, colKey, colKeyCx, colKeyCz } from './blockIndex';
import { meshSection } from './mesher';
import { buildChunkGeometry } from './chunkGeometry';
import { chunkMaterial, cutoutMaterial } from './chunkMaterial';
import { MeshPool, defaultWorkerCount } from './meshPool';

/**
 * Owns the THREE.Mesh objects for every voxel section. Chunk meshes are NOT React
 * children: a city has thousands of them, created and destroyed continuously, and
 * pushing that through the reconciler would dominate the frame. React renders one
 * <group>; this class adds and removes meshes in it from a useFrame pump.
 *
 * Pipeline per section:  world.dirty -> (nearest first) -> padded copy -> worker ->
 *                        packed buffers -> BufferGeometry -> Mesh
 *
 * - Ring: only columns within `renderDist` chunks of the camera are meshed; columns that
 *   drift beyond renderDist + 2 are unmeshed (voxel data stays). The gap is hysteresis.
 * - Budgets: at most MAX_DISPATCH jobs sent and a time-boxed number of geometries
 *   uploaded per frame, so a burst of edits cannot stall a frame.
 * - Versioning: every job gets an id; a reply is applied only if it is still the latest
 *   job for its section, so a slow reply can never resurrect a removed section or
 *   overwrite a newer mesh.
 * - If workers are unavailable or fail, meshing falls back to the main thread under a
 *   per-frame time budget (same code path, same output).
 */

const MAX_DISPATCH = 24; // jobs sent per frame
const MAX_UPLOADS = 24; // geometries uploaded per frame (also time-boxed)
const UPLOAD_BUDGET_MS = 3;
const LOAD_UPLOAD_BUDGET_MS = 10; // a long queue (initial load) may use more of the frame
const INLINE_BUDGET_MS = 4; // main-thread fallback meshing per frame
const RESORT_MS = 200; // how stale the nearest-first order may get for a large queue
const SORT_EVERY_FRAME_MAX = 1024; // queues up to this size are re-sorted every frame
const RING_SCAN_MS = 500;

export class ChunkMeshManager {
  constructor(world, group, opts = {}) {
    this.world = world;
    this.group = group;
    this.renderDist = opts.renderDist ?? RENDER_DIST;
    // (materials are injectable so the manager can run in tests, which have no canvas)
    this.opaqueMat = opts.opaqueMaterial ?? chunkMaterial();
    this.cutoutMat = opts.cutoutMaterial ?? cutoutMaterial();

    this.entries = new Map(); // sectionKey -> { opaque: Mesh|null, cutout: Mesh|null, quads, bytes }
    this.active = new Set(); // colKeys inside the ring
    this.inFlight = new Map(); // sectionKey -> { id, t0 }
    this.latest = new Map(); // sectionKey -> latest job id
    this.ready = []; // worker replies waiting for upload
    this.nextId = 1;
    this.disposed = false;

    this.pad = new Uint8Array(PAD_VOLUME); // inline-fallback scratch
    this._sorted = [];
    this._sortedFor = -1;
    this._sortedAt = 0;
    this._ccx = NaN;
    this._ccz = NaN;
    this._scanAt = 0;

    this.totalQuads = 0;
    this.totalBytes = 0;
    this.latAvg = 0;
    this.latMax = 0;
    this.stats = {
      meshes: 0,
      quads: 0,
      gpuBytes: 0,
      activeCols: 0,
      inFlight: 0,
      workers: 0,
      latAvg: 0,
      latMax: 0,
      uploads: 0,
      updateMs: 0,
      meshedTotal: 0,
    };

    this.pool = null;
    const onResult = (r) => {
      if (!this.disposed) this.ready.push(r);
    };
    const onFail = (err) => this._poolFailed(err);
    if (opts.poolFactory) {
      this.pool = opts.poolFactory(onResult, onFail); // tests inject a controllable fake
    } else if (opts.workers !== false && typeof Worker !== 'undefined') {
      try {
        this.pool = new MeshPool(opts.workerCount ?? defaultWorkerCount(), onResult, onFail);
      } catch (err) {
        console.warn('[godzilla-verse] mesh workers unavailable, meshing on the main thread:', err);
        this.pool = null;
      }
    }
    this.stats.workers = this.pool ? this.pool.size : 0;
  }

  /** Call once per frame. */
  update(camPos) {
    const t0 = performance.now();
    this.stats.uploads = 0;
    this._scanRing(camPos, t0);
    this._upload();
    this._dispatch(camPos, t0);
    this._refreshStats(performance.now() - t0);
  }

  // ---- ring ------------------------------------------------------------------

  _scanRing(camPos, now) {
    const ccx = Math.floor(camPos.x / CHUNK_X);
    const ccz = Math.floor(camPos.z / CHUNK_Z);
    if (ccx === this._ccx && ccz === this._ccz && now - this._scanAt < RING_SCAN_MS) return;
    this._ccx = ccx;
    this._ccz = ccz;
    this._scanAt = now;

    const R = this.renderDist;
    const drop = R + 2;
    const dirty = this.world.dirty;
    for (const col of this.world.columns.values()) {
      const ck = colKey(col.cx, col.cz);
      const dist = Math.hypot(col.cx - ccx, col.cz - ccz);
      const isActive = this.active.has(ck);
      if (!isActive && dist <= R) {
        this._activateColumn(col);
      } else if (isActive && dist > drop) {
        this.active.delete(ck);
        for (let sy = 0; sy < SECTIONS; sy++) {
          const key = sectionKey(col.cx, col.cz, sy);
          this._forget(key);
          this._removeKey(key);
          dirty.delete(key);
        }
      }
    }

    // Generation (or a far-away edit) marks sections dirty that are outside the ring.
    // They will be remeshed in full when their column activates, so don't carry them
    // around, re-sorting thousands of keys every frame.
    for (const key of dirty) {
      if (!this.active.has(sectionKeyCol(key))) dirty.delete(key);
    }
  }

  // Bring a column into the ring: every non-empty section needs a (re)mesh.
  _activateColumn(col) {
    this.active.add(colKey(col.cx, col.cz));
    for (let sy = 0; sy < SECTIONS; sy++) {
      if (col.sections[sy]) this.world.dirty.add(sectionKey(col.cx, col.cz, sy));
    }
  }

  // ---- upload (worker replies -> meshes) ------------------------------------------

  _upload() {
    const loading = this.world.dirty.size + this.ready.length > 64;
    const budget = loading ? LOAD_UPLOAD_BUDGET_MS : UPLOAD_BUDGET_MS;
    const start = performance.now();
    let n = 0;
    while (this.ready.length > 0 && n < MAX_UPLOADS) {
      if (n > 0 && performance.now() - start > budget) break;
      this._applyResult(this.ready.shift());
      n++;
    }
    this.stats.uploads = n;
  }

  _applyResult(r) {
    // Stale: the section was re-sent, removed, or left the ring since this job started.
    if (this.latest.get(r.key) !== r.id) return;
    const f = this.inFlight.get(r.key);
    if (f && f.id === r.id) {
      this.inFlight.delete(r.key);
      const lat = performance.now() - f.t0;
      this.latAvg = this.latAvg === 0 ? lat : this.latAvg * 0.9 + lat * 0.1;
      this.latMax = Math.max(this.latMax * 0.99, lat);
    }
    this.stats.meshedTotal++;
    this._setParts(r.key, r.opaque, r.cutout);
  }

  // ---- dispatch (dirty sections -> workers) ---------------------------------------

  _sortedDirty(camPos, now) {
    const dirty = this.world.dirty;
    // Small queues (every normal edit) are re-sorted every frame, so a freshly dirtied
    // section is never missed. Only a big bulk queue (initial load, mass destruction) reuses
    // the cached order for RESORT_MS — a same-size-but-different-contents cache hit there
    // costs at most a 200 ms delay, and sorting thousands of keys per frame would cost more.
    if (dirty.size > SORT_EVERY_FRAME_MAX && dirty.size === this._sortedFor && now - this._sortedAt < RESORT_MS) {
      return this._sorted;
    }
    const keys = Array.from(dirty);
    const dist = new Map();
    for (const k of keys) dist.set(k, this._distSq(k, camPos));
    keys.sort((a, b) => dist.get(a) - dist.get(b));
    this._sorted = keys;
    this._sortedFor = dirty.size;
    this._sortedAt = now;
    return keys;
  }

  _distSq(key, camPos) {
    const ck = sectionKeyCol(key);
    const x = colKeyCx(ck) * CHUNK_X + CHUNK_X / 2 - camPos.x;
    const y = sectionKeySy(key) * SECTION_H + SECTION_H / 2 - camPos.y;
    const z = colKeyCz(ck) * CHUNK_Z + CHUNK_Z / 2 - camPos.z;
    return x * x + y * y + z * z;
  }

  _dispatch(camPos, now) {
    const dirty = this.world.dirty;
    if (dirty.size === 0) return;
    const sorted = this._sortedDirty(camPos, now);

    let sent = 0;
    for (let i = 0; i < sorted.length && sent < MAX_DISPATCH; i++) {
      const key = sorted[i];
      if (!dirty.has(key)) continue; // handled since the list was sorted
      const ck = sectionKeyCol(key);
      const col = this.world.columns.get(ck);
      if (!this.active.has(ck)) {
        // A column created since the last ring scan (an edit, or streamed-in generation)
        // that lies inside the ring joins it right away instead of waiting for the next scan.
        if (col && Math.hypot(col.cx - this._ccx, col.cz - this._ccz) <= this.renderDist) {
          this._activateColumn(col);
        } else {
          dirty.delete(key); // outside the ring: activation will remesh the whole column
          continue;
        }
      }
      if (this.inFlight.has(key)) continue; // wait for it; it stays dirty and is re-sent after

      const sy = sectionKeySy(key);
      if (!col || !col.sections[sy]) {
        dirty.delete(key); // emptied: drop the mesh without bothering a worker
        this._forget(key);
        this._removeKey(key);
        continue;
      }

      const cx = colKeyCx(ck);
      const cz = colKeyCz(ck);
      if (this.pool) {
        if (!this.pool.hasCapacity()) break;
        const pad = new Uint8Array(PAD_VOLUME); // transferred to the worker, so one per job
        this.world.buildPadded(cx, cz, sy, pad);
        const id = this.nextId++;
        this.latest.set(key, id);
        this.inFlight.set(key, { id, t0: performance.now() });
        dirty.delete(key);
        this.pool.submit(id, key, pad);
      } else {
        if (sent > 0 && performance.now() - now > INLINE_BUDGET_MS) break;
        this.world.buildPadded(cx, cz, sy, this.pad);
        const { opaque, cutout } = meshSection(this.pad);
        const id = this.nextId++;
        this.latest.set(key, id);
        dirty.delete(key);
        this.stats.meshedTotal++;
        this._setParts(key, opaque, cutout);
      }
      sent++;
    }
  }

  _poolFailed(err) {
    if (this.disposed) return;
    console.warn('[godzilla-verse] mesh worker failed, falling back to main-thread meshing:', err);
    this.pool?.dispose();
    this.pool = null;
    this.stats.workers = 0;
    // anything that was in flight is lost: queue it again
    for (const key of this.inFlight.keys()) {
      this.latest.delete(key);
      this.world.dirty.add(key);
    }
    this.inFlight.clear();
    this.ready.length = 0;
  }

  // ---- meshes ---------------------------------------------------------------------

  _setParts(key, opaque, cutout) {
    if (!opaque && !cutout) {
      this._removeKey(key);
      return;
    }
    const ck = sectionKeyCol(key);
    const ox = colKeyCx(ck) * CHUNK_X;
    const oy = sectionKeySy(key) * SECTION_H;
    const oz = colKeyCz(ck) * CHUNK_Z;

    let e = this.entries.get(key);
    if (!e) {
      e = { opaque: null, cutout: null, quads: 0, bytes: 0 };
      this.entries.set(key, e);
    }
    this._setPart(e, 'opaque', opaque, this.opaqueMat, ox, oy, oz);
    this._setPart(e, 'cutout', cutout, this.cutoutMat, ox, oy, oz);

    const quads = (opaque ? opaque.quadCount : 0) + (cutout ? cutout.quadCount : 0);
    const bytes = partBytes(opaque) + partBytes(cutout);
    this.totalQuads += quads - e.quads;
    this.totalBytes += bytes - e.bytes;
    e.quads = quads;
    e.bytes = bytes;
  }

  _setPart(entry, slot, part, material, ox, oy, oz) {
    const mesh = entry[slot];
    if (!part) {
      if (mesh) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        entry[slot] = null;
      }
      return;
    }
    const geometry = buildChunkGeometry(part);
    if (mesh) {
      mesh.geometry.dispose(); // swap, then free the old GPU buffers
      mesh.geometry = geometry;
      return;
    }
    const m = new THREE.Mesh(geometry, material);
    m.position.set(ox, oy, oz);
    m.matrixAutoUpdate = false; // sections never move
    m.updateMatrix();
    this.group.add(m);
    entry[slot] = m;
  }

  _removeKey(key) {
    const e = this.entries.get(key);
    if (!e) return;
    for (const slot of ['opaque', 'cutout']) {
      if (e[slot]) {
        this.group.remove(e[slot]);
        e[slot].geometry.dispose();
      }
    }
    this.totalQuads -= e.quads;
    this.totalBytes -= e.bytes;
    this.entries.delete(key);
  }

  // Invalidate any job still running for this section so its reply is dropped.
  _forget(key) {
    this.latest.delete(key);
    this.inFlight.delete(key);
  }

  _refreshStats(updateMs) {
    const s = this.stats;
    s.meshes = this.entries.size;
    s.quads = this.totalQuads;
    s.gpuBytes = this.totalBytes;
    s.activeCols = this.active.size;
    s.inFlight = this.inFlight.size;
    s.latAvg = this.latAvg;
    s.latMax = this.latMax;
    s.updateMs = updateMs;
  }

  dispose() {
    this.disposed = true;
    this.pool?.dispose();
    this.pool = null;
    for (const key of Array.from(this.entries.keys())) this._removeKey(key);
    this.entries.clear();
    this.inFlight.clear();
    this.latest.clear();
    this.active.clear();
    this.ready.length = 0;
  }
}

function partBytes(p) {
  return p ? p.position.byteLength + p.uv.byteLength + p.color.byteLength + p.index.byteLength : 0;
}
