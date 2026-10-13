import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { world } from '../utils/voxelWorld';
import { buildTestWorld } from '../utils/testWorld';
import { buildSyntheticCity } from '../utils/syntheticCity';
import { ChunkMeshManager } from '../utils/chunkMeshManager';
import { chunkWireframe } from '../utils/chunkMaterial';
import { stats, city } from '../store';
import { loadCity } from '../utils/cityLoader';
import { WORLD_KIND, USE_WORKERS, RENDER_DIST_OVERRIDE } from '../utils/worldSelect';

const CITY = WORLD_KIND === 'city';
const WORLD_LABEL = { city: 'city 384x384', synthetic: 'synthetic city 384x384', test: 'test world 64x64' }[WORLD_KIND];

let loadStarted = false; // StrictMode runs effects twice: the load must start exactly once

// Renders the voxel world as ONE <group>; the manager adds/removes the section meshes
// imperatively, so a remesh never touches React.
export default function ChunkRenderer() {
  const groupRef = useRef();
  const manager = useRef(null);
  const settled = useRef(0);

  useEffect(() => {
    if (!loadStarted) {
      loadStarted = true;
      const t0 = performance.now();
      if (CITY) {
        city.state = 'loading';
        loadCity(world, {
          useWorker: USE_WORKERS,
          onProgress: (phase, pct) => {
            city.label = phase;
            city.pct = pct;
          },
        })
          .then((r) => {
            Object.assign(city, { lotMap: r.lotMap, buildings: r.buildings, anchors: r.anchors, stats: r.stats, via: r.via });
            city.generated = true;
            city.state = 'generated';
            stats.genMs = performance.now() - t0;
            stats.sections = world.sectionCount();
          })
          .catch((err) => {
            city.state = 'error';
            city.error = String(err && err.message ? err.message : err);
            console.error('[godzilla-verse] city generation failed:', err);
          });
      } else {
        if (WORLD_KIND === 'synthetic') buildSyntheticCity(world);
        else buildTestWorld(world);
        stats.genMs = performance.now() - t0;
        stats.sections = world.sectionCount();
        city.generated = true;
        city.state = 'generated';
      }
    }
    manager.current = new ChunkMeshManager(world, groupRef.current, { workers: USE_WORKERS, renderDist: RENDER_DIST_OVERRIDE });
    stats.world = WORLD_LABEL;
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
    stats.sections = world.sectionCount();

    // "ready": the data is in and the ring around the camera is meshed and quiet
    if (city.generated && !city.ready) {
      settled.current = world.dirty.size === 0 && s.inFlight === 0 && s.meshes > 0 ? settled.current + 1 : 0;
      if (settled.current > 8) city.ready = true;
    }
  });

  return <group ref={groupRef} />;
}
