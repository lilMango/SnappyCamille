import * as THREE from 'three';
import { CHUNK_X, CHUNK_Z, SECTION_H, PAD_VOLUME } from '../constants/worldConfig';
import { sectionKeySy, sectionKeyCol, colKeyCx, colKeyCz } from './blockIndex';
import { meshSection } from './mesher';
import { buildChunkGeometry } from './chunkGeometry';
import { chunkMaterial } from './chunkMaterial';

/**
 * Owns the THREE.Mesh for every voxel section. Chunk meshes are NOT React children: a
 * city has thousands of them, created and destroyed continuously, and pushing that
 * through the reconciler would dominate the frame. React renders one <group>; this class
 * adds and removes meshes in it imperatively from a useFrame pump.
 *
 * Phase 1 meshes on the main thread under a per-frame time budget. Phase 2 moves
 * meshSection() into a worker pool behind this same interface.
 */
export class ChunkMeshManager {
  constructor(world, group) {
    this.world = world;
    this.group = group;
    this.meshes = new Map(); // sectionKey -> THREE.Mesh
    this.material = chunkMaterial();
    this.pad = new Uint8Array(PAD_VOLUME);
    this.stats = { meshes: 0, quads: 0, lastMeshMs: 0, remeshedThisFrame: 0 };
    this._quads = new Map(); // sectionKey -> quads, for the running total
  }

  /**
   * Remesh dirty sections nearest-first until `budgetMs` is spent. Call once per frame.
   * At least one section is always processed so a long queue can never stall.
   */
  update(camPos, budgetMs = 6) {
    const dirty = this.world.dirty;
    this.stats.remeshedThisFrame = 0;
    if (dirty.size === 0) return;

    const keys = Array.from(dirty);
    const dist = new Map();
    for (const k of keys) dist.set(k, this._distSq(k, camPos));
    keys.sort((a, b) => dist.get(a) - dist.get(b));

    const t0 = performance.now();
    for (let i = 0; i < keys.length; i++) {
      if (i > 0 && performance.now() - t0 > budgetMs) break;
      dirty.delete(keys[i]);
      this._remesh(keys[i]);
      this.stats.remeshedThisFrame++;
    }
    this.stats.lastMeshMs = performance.now() - t0;
  }

  _distSq(key, camPos) {
    const ck = sectionKeyCol(key);
    const x = colKeyCx(ck) * CHUNK_X + CHUNK_X / 2 - camPos.x;
    const y = sectionKeySy(key) * SECTION_H + SECTION_H / 2 - camPos.y;
    const z = colKeyCz(ck) * CHUNK_Z + CHUNK_Z / 2 - camPos.z;
    return x * x + y * y + z * z;
  }

  _remesh(key) {
    const ck = sectionKeyCol(key);
    const cx = colKeyCx(ck);
    const cz = colKeyCz(ck);
    const sy = sectionKeySy(key);

    const col = this.world.getColumn(cx, cz);
    if (!col || !col.sections[sy]) {
      this._remove(key);
      return;
    }

    this.world.buildPadded(cx, cz, sy, this.pad);
    const result = meshSection(this.pad);
    if (!result) {
      this._remove(key);
      return;
    }

    const geometry = buildChunkGeometry(result);
    let mesh = this.meshes.get(key);
    if (mesh) {
      mesh.geometry.dispose(); // swap, then free the old GPU buffers
      mesh.geometry = geometry;
    } else {
      mesh = new THREE.Mesh(geometry, this.material);
      mesh.position.set(cx * CHUNK_X, sy * SECTION_H, cz * CHUNK_Z);
      mesh.matrixAutoUpdate = false; // sections never move
      mesh.updateMatrix();
      this.group.add(mesh);
      this.meshes.set(key, mesh);
    }
    this.stats.quads += result.quadCount - (this._quads.get(key) || 0);
    this._quads.set(key, result.quadCount);
    this.stats.meshes = this.meshes.size;
  }

  _remove(key) {
    const mesh = this.meshes.get(key);
    if (!mesh) return;
    this.group.remove(mesh);
    mesh.geometry.dispose();
    this.meshes.delete(key);
    this.stats.quads -= this._quads.get(key) || 0;
    this._quads.delete(key);
    this.stats.meshes = this.meshes.size;
  }

  dispose() {
    for (const mesh of this.meshes.values()) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
    }
    this.meshes.clear();
    this._quads.clear();
    this.stats.meshes = 0;
    this.stats.quads = 0;
  }
}
