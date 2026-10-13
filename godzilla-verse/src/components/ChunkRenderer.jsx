import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { world } from '../utils/voxelWorld';
import { buildTestWorld } from '../utils/testWorld';
import { buildSyntheticCity } from '../utils/syntheticCity';
import { ChunkMeshManager } from '../utils/chunkMeshManager';
import { chunkWireframe } from '../utils/chunkMaterial';
import { stats } from '../store';
import { WORLD_KIND, USE_WORKERS, RENDER_DIST_OVERRIDE } from '../utils/worldSelect';

const CITY = WORLD_KIND === 'city';

// Renders the voxel world as ONE <group>; the manager adds/removes the section meshes
// imperatively, so a remesh never touches React.
export default function ChunkRenderer() {
  const groupRef = useRef();
  const manager = useRef(null);

  useEffect(() => {
    if (world.columns.size === 0) {
      // (StrictMode runs effects twice; HMR keeps the singleton world)
      const t0 = performance.now();
      if (CITY) buildSyntheticCity(world);
      else buildTestWorld(world);
      stats.genMs = performance.now() - t0;
    }
    manager.current = new ChunkMeshManager(world, groupRef.current, { workers: USE_WORKERS, renderDist: RENDER_DIST_OVERRIDE });
    stats.sections = world.sectionCount();
    stats.world = CITY ? 'synthetic city 384x384' : 'test world 64x64';
    return () => {
      manager.current?.dispose();
      manager.current = null;
    };
  }, []);

  useFrame(({ camera }) => {
    const m = manager.current;
    if (!m) return;
    m.update(camera.position);
    const s = m.stats;
    stats.meshes = s.meshes;
    stats.quads = s.quads;
    stats.gpuMB = s.gpuBytes / (1024 * 1024);
    stats.activeCols = s.activeCols;
    stats.inFlight = s.inFlight;
    stats.workers = s.workers;
    stats.latAvg = s.latAvg;
    stats.latMax = s.latMax;
    stats.uploads = s.uploads;
    stats.meshedTotal = s.meshedTotal;
    stats.meshMs = s.updateMs;
    stats.dirty = world.dirty.size;
    stats.wireframe = chunkWireframe();
  });

  return <group ref={groupRef} />;
}
